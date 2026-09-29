"""
Confronta due snapshot del calendario di Inside Airbnb per stimare le PRENOTAZIONI avvenute in mezzo.

Idea: una notte che era disponibile nello snapshot vecchio e non lo è più in quello nuovo è quasi
sempre stata prenotata nel frattempo (può anche essere stata bloccata dall'host: il calendario non li
distingue). Si parte solo dalle notti disponibili all'inizio, quindi i calendari "non ancora aperti"
non falsano il conteggio.

Uso, dalla cartella in cui hai lo script (accetta anche file .csv.gz senza decomprimerli):
    python compare_calendars.py calendar_2026-03.csv.gz calendar.csv
      1° argomento = snapshot PIÙ VECCHIO, 2° argomento = snapshot PIÙ RECENTE.

Risultato: data/calendar_pickup_<vecchio>_<nuovo>.csv + un riepilogo a schermo.

  pickup_rate  : % delle notti disponibili all'inizio che risultano non disponibili alla fine
  demand_index : pickup_rate diviso per la sua mediana mobile di 29 giorni.
                 >1 = notte più richiesta delle notti vicine (weekend, eventi), <1 = meno richiesta.
"""
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = next((d for d in (os.path.join(HERE, "data"), os.path.join(HERE, "backend", "data"))
             if os.path.isdir(d)), os.path.join(HERE, "data"))
LISTINGS_PATH = os.path.join(DATA, "listings.csv")
CHUNK_ROWS = int(os.environ.get("CHUNK_ROWS", 1_000_000))
EPOCH = pd.Timestamp("2025-01-01")
KEY_MUL = 4096           # chiave = listing_id * 4096 + giorni dall'EPOCH
MIN_AVAILABLE = 100      # sotto questa soglia la notte non è affidabile

EVENTS = [
    ("Salone del Mobile 2026", "2026-04-21", "2026-04-26"),
    ("GP Monza", "2026-09-04", "2026-09-06"),
    ("Fashion Week Donna", "2026-09-22", "2026-09-28"),
    ("Fiata World Congress", "2026-10-05", "2026-10-08"),
    ("EICMA 2026", "2026-11-03", "2026-11-08"),
    ("Milano Games Week", "2026-11-27", "2026-11-29"),
    ("Artigiano in Fiera", "2026-12-05", "2026-12-13"),
    ("Fashion Week Uomo", "2027-01-15", "2027-01-19"),
    ("Fashion Week Donna", "2027-02-23", "2027-03-01"),
]


def comparable_ids():
    cols = ["id", "room_type", "minimum_nights", "number_of_reviews_ltm", "price", "accommodates",
            "neighbourhood_cleansed"]
    df = pd.read_csv(LISTINGS_PATH, usecols=cols, low_memory=False)
    df["price"] = pd.to_numeric(df["price"].astype(str).str.replace(r"[^\d\.]", "", regex=True), errors="coerce")
    df = df.dropna(subset=["neighbourhood_cleansed", "price", "accommodates"])
    df = df[df["price"].between(20, 2500)]
    df = df[(df["room_type"] == "Entire home/apt")
            & (df["minimum_nights"].fillna(1) <= 29)
            & (df["number_of_reviews_ltm"].fillna(0) > 0)]
    return set(df["id"].astype("int64"))


def load_calendar(path, ids):
    parts, rows = [], 0
    reader = pd.read_csv(path, usecols=["listing_id", "date", "available"], chunksize=CHUNK_ROWS,
                         dtype={"date": "string", "available": "string"})
    for chunk in reader:
        rows += len(chunk)
        chunk = chunk[chunk["listing_id"].isin(ids)]
        if chunk.empty:
            continue
        day = (pd.to_datetime(chunk["date"], format="%Y-%m-%d") - EPOCH).dt.days.to_numpy()
        key = chunk["listing_id"].to_numpy(dtype="int64") * KEY_MUL + day
        parts.append(pd.DataFrame({"key": key, "avail": (chunk["available"] == "t").to_numpy()}))
        print(f"   {rows:>12,} righe lette", end="\r")
    print()
    df = pd.concat(parts, ignore_index=True).drop_duplicates("key")
    first_day = int((df["key"] % KEY_MUL).min())
    return df, (EPOCH + pd.Timedelta(days=first_day)).strftime("%Y-%m-%d")


def main():
    if len(sys.argv) < 3:
        sys.exit("Uso: python compare_calendars.py <calendario_più_vecchio> <calendario_più_recente>")
    old_path, new_path = sys.argv[1], sys.argv[2]
    for p in (old_path, new_path, LISTINGS_PATH):
        if not os.path.exists(p):
            sys.exit(f"File non trovato: {p}")

    ids = comparable_ids()
    print(f"Annunci comparabili: {len(ids)}")
    print(f"Leggo il calendario vecchio: {old_path}")
    a, date_a = load_calendar(old_path, ids)
    print(f"Leggo il calendario recente: {new_path}")
    b, date_b = load_calendar(new_path, ids)
    if date_a >= date_b:
        sys.exit(f"Ordine invertito: il primo file parte dal {date_a}, il secondo dal {date_b}. "
                 "Il primo deve essere il più vecchio.")

    m = a.merge(b, on="key", suffixes=("_a", "_b"))
    del a, b
    if m.empty:
        sys.exit("Nessuna notte in comune tra i due calendari.")
    m["day"] = (m["key"] % KEY_MUL).astype("int32")
    m["pickup"] = m["avail_a"] & ~m["avail_b"]
    m["release"] = ~m["avail_a"] & m["avail_b"]
    m["unavail_b"] = ~m["avail_b"]
    m["listing"] = m["key"] // KEY_MUL

    g = m.groupby("day").agg(n_listings=("key", "size"), avail_a=("avail_a", "sum"),
                             pickups=("pickup", "sum"), releases=("release", "sum"),
                             unavail_b=("unavail_b", "sum"))
    n_common = m["listing"].nunique()
    g["date"] = (EPOCH + pd.to_timedelta(g.index, unit="D")).strftime("%Y-%m-%d")
    g = g.reset_index(drop=True)
    g["unavail_a"] = g["n_listings"] - g["avail_a"]
    g["pickup_rate"] = (100 * g["pickups"] / g["avail_a"].where(g["avail_a"] >= MIN_AVAILABLE)).round(2)
    g["release_rate"] = (100 * g["releases"] / g["unavail_a"].where(g["unavail_a"] >= MIN_AVAILABLE)).round(2)
    g["unavailable_b_pct"] = (100 * g["unavail_b"] / g["n_listings"]).round(2)
    roll = g["pickup_rate"].rolling(29, center=True, min_periods=15).median()
    g["demand_index"] = (g["pickup_rate"] / roll.where(roll > 0)).round(3)

    out = g[["date", "n_listings", "avail_a", "pickups", "pickup_rate", "release_rate",
             "unavailable_b_pct", "demand_index"]]
    out_path = os.path.join(DATA, f"calendar_pickup_{date_a}_{date_b}.csv")
    out.to_csv(out_path, index=False)
    print(f"\nScritto {out_path} ({len(out)} notti, {os.path.getsize(out_path)/1024:.0f} KB)")
    report(out, date_a, date_b, n_common)


def report(c, date_a, date_b, n_common):
    c = c.copy()
    c["dt"] = pd.to_datetime(c["date"])
    names = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    print(f"\n=== CONFRONTO {date_a} -> {date_b}  ({(pd.Timestamp(date_b)-pd.Timestamp(date_a)).days} giorni) ===")
    print(f"Annunci presenti in entrambi: {n_common}   notti confrontabili: {len(c)} "
          f"({c['date'].min()} -> {c['date'].max()})")
    print(f"Tasso medio di prenotazione nel periodo: {c['pickup_rate'].mean():.1f}% delle notti che erano libere")

    print("\nDomanda per giorno della settimana (1.00 = normale; notte indicata):")
    wd = c.groupby(c["dt"].dt.dayofweek)["demand_index"].mean()
    for i, n in enumerate(names):
        if i in wd.index:
            print(f"  {n}  {wd[i]:.2f}")

    print("\nTasso di prenotazione per mese (% delle notti libere all'inizio poi occupate):")
    for k, v in c.groupby(c["dt"].dt.strftime("%Y-%m"))["pickup_rate"].mean().items():
        print(f"  {k}  {v:5.1f}%")

    print("\nEventi: indice medio di domanda nelle notti dell'evento (1.00 = normale):")
    for name, s, e in EVENTS:
        w = c[(c["date"] >= s) & (c["date"] <= e)].dropna(subset=["demand_index"])
        if len(w):
            print(f"  {name:<26} {s} -> {e}   {w['demand_index'].mean():.2f}   ({len(w)} notti)")

    print("\nNotti più forti (possibili eventi):")
    top = c.dropna(subset=["demand_index"]).sort_values("demand_index", ascending=False).head(15)
    for _, r in top.sort_values("date").iterrows():
        print(f"  {r['date']}  {names[r['dt'].dayofweek]}  indice {r['demand_index']:.2f}   prenotato {r['pickup_rate']:.1f}%")


if __name__ == "__main__":
    main()