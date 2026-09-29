"""
Riassume backend/data/calendar.csv (centinaia di MB) in un file piccolo:
backend/data/calendar_summary.csv  ->  una riga per (data, quartiere) + una per tutta Milano.

Uso, dalla cartella backend:
    python summarize_calendar.py
oppure indicando un altro file:
    python summarize_calendar.py percorso/calendar.csv

Cosa calcola
  unavailable_pct : % di annunci comparabili NON disponibili quella notte (prenotati OPPURE bloccati
                    dall'host: il calendario di Airbnb non li distingue).
  demand_index    : unavailable_pct diviso per la sua mediana mobile di 29 giorni. Toglie l'effetto
                    "le date lontane sono ancora poco prenotate" e lascia i picchi: >1 = giorno più
                    richiesto del suo periodo, <1 = meno richiesto.
Non contiene prezzi: il calendario scaricato non li ha.
"""
import os
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
# Trova la cartella "data" sia se lo script sta accanto a "app/" e "data/",
# sia se sta nella cartella principale del repo (che contiene "backend/data").
DATA = next((d for d in (os.path.join(HERE, "data"), os.path.join(HERE, "backend", "data"))
             if os.path.isdir(d)), os.path.join(HERE, "data"))
CAL_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DATA, "calendar.csv")
LISTINGS_PATH = os.path.join(DATA, "listings.csv")
OUT_PATH = os.path.join(DATA, "calendar_summary.csv")
CHUNK_ROWS = int(os.environ.get("CHUNK_ROWS", 1_000_000))
CITY = "TUTTA MILANO"

# Eventi già presenti nell'app (main.py): li confrontiamo con la domanda reale
EVENTS = [
    ("GP Monza", "2026-09-04", "2026-09-06"),
    ("Fashion Week Donna", "2026-09-22", "2026-09-28"),
    ("EICMA 2026", "2026-11-03", "2026-11-08"),
    ("Milano Games Week", "2026-11-27", "2026-11-29"),
    ("Artigiano in Fiera", "2026-12-05", "2026-12-13"),
    ("Fashion Week Uomo", "2027-01-15", "2027-01-19"),
    ("Fashion Week Donna", "2027-02-23", "2027-03-01"),
    ("Salone del Mobile 2027", "2027-04-13", "2027-04-18"),
    ("Fashion Week Uomo", "2027-06-18", "2027-06-22"),
]


def load_comparables():
    """Stessi criteri del motore prezzi: appartamenti interi, attivi, soggiorno breve."""
    cols = ["id", "neighbourhood_cleansed", "room_type", "minimum_nights", "number_of_reviews_ltm",
            "price", "accommodates"]
    df = pd.read_csv(LISTINGS_PATH, usecols=cols, low_memory=False)
    df["price"] = pd.to_numeric(df["price"].astype(str).str.replace(r"[^\d\.]", "", regex=True), errors="coerce")
    df = df.dropna(subset=["neighbourhood_cleansed", "price", "accommodates"])
    df = df[df["price"].between(20, 2500)]
    df = df[(df["room_type"] == "Entire home/apt")
            & (df["minimum_nights"].fillna(1) <= 29)
            & (df["number_of_reviews_ltm"].fillna(0) > 0)]
    return df.set_index("id")["neighbourhood_cleansed"].astype(str)


def main():
    for p in (CAL_PATH, LISTINGS_PATH):
        if not os.path.exists(p):
            sys.exit(f"File non trovato: {p}\n"
                     "Cerca dov'è con:  Get-ChildItem -Path . -Recurse -Filter calendar.csv | Select-Object FullName\n"
                     "poi rilancia indicando il percorso:  python summarize_calendar.py \"percorso\\calendar.csv\"")

    comps = load_comparables()
    print(f"Annunci comparabili: {len(comps)}")
    print(f"Leggo {CAL_PATH} a blocchi di {CHUNK_ROWS:,} righe...")

    parts, rows_read = [], 0
    reader = pd.read_csv(CAL_PATH, usecols=["listing_id", "date", "available"],
                         chunksize=CHUNK_ROWS, dtype={"date": "string", "available": "string"})
    for chunk in reader:
        rows_read += len(chunk)
        chunk = chunk[chunk["listing_id"].isin(comps.index)].copy()
        if chunk.empty:
            continue
        chunk["neigh"] = chunk["listing_id"].map(comps)
        chunk["unavail"] = (chunk["available"] == "f").astype("int8")
        parts.append(chunk.groupby(["date", "neigh"])["unavail"].agg(["size", "sum"]))
        print(f"  {rows_read:>12,} righe lette", end="\r")
    print()

    if not parts:
        sys.exit("Nessuna riga del calendario corrisponde agli annunci comparabili (controlla gli id).")

    res = pd.concat(parts).groupby(level=[0, 1]).sum()
    res.columns = ["n_listings", "n_unavailable"]
    res = res.reset_index().rename(columns={"neigh": "neighbourhood"})

    city = res.groupby("date")[["n_listings", "n_unavailable"]].sum().reset_index()
    city["neighbourhood"] = CITY
    res = pd.concat([res, city], ignore_index=True)

    res["unavailable_pct"] = (100 * res["n_unavailable"] / res["n_listings"]).round(2)
    res = res.sort_values(["neighbourhood", "date"]).reset_index(drop=True)

    roll = res.groupby("neighbourhood")["unavailable_pct"].transform(
        lambda s: s.rolling(29, center=True, min_periods=15).median())
    res["demand_index"] = (res["unavailable_pct"] / roll.where(roll > 0)).round(3)
    res.to_csv(OUT_PATH, index=False)
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nScritto {OUT_PATH}  ({len(res):,} righe, {size_kb:.0f} KB)")

    report(res[res["neighbourhood"] == CITY].copy())


def report(c):
    c["dt"] = pd.to_datetime(c["date"])
    print("\n=== RIEPILOGO (tutta Milano) ===")
    print(f"Periodo: {c['date'].min()} -> {c['date'].max()}   annunci per notte: ~{int(c['n_listings'].median())}")

    print("\nDomanda per giorno della settimana (1.00 = media; notte indicata):")
    names = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    wd = c.groupby(c["dt"].dt.dayofweek)["demand_index"].mean()
    for i, n in enumerate(names):
        if i in wd.index:
            print(f"  {n}  {wd[i]:.2f}")

    print("\nDomanda per mese (% non disponibile, media; le date lontane risultano meno prenotate):")
    m = c.groupby(c["dt"].dt.strftime("%Y-%m"))["unavailable_pct"].mean()
    for k, v in m.items():
        print(f"  {k}  {v:5.1f}%")

    print("\nEventi già nell'app: indice medio di domanda nel periodo (1.00 = normale):")
    for name, a, b in EVENTS:
        w = c[(c["date"] >= a) & (c["date"] <= b)]
        if len(w):
            print(f"  {name:<26} {a} -> {b}   {w['demand_index'].mean():.2f}")
        else:
            print(f"  {name:<26} {a} -> {b}   (fuori dal calendario)")

    print("\nGiorni più forti (indice più alto), possibili eventi che non sono nell'app:")
    top = c.dropna(subset=["demand_index"]).sort_values("demand_index", ascending=False).head(15)
    for _, r in top.sort_values("date").iterrows():
        print(f"  {r['date']}  {names[r['dt'].dayofweek]}  indice {r['demand_index']:.2f}   non disp. {r['unavailable_pct']:.1f}%")


if __name__ == "__main__":
    main()