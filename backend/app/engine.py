import os
import pandas as pd

ENTIRE_HOME = "Entire home/apt"
MAX_MIN_NIGHTS = 29     # esclude gli affitti mensili (minimum_nights >= 30)
MIN_SAMPLE = 8          # sotto questa soglia il campione non è considerato affidabile


class MilanChallengerEngine:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        self.csv_path = os.path.join(backend_dir, "data", "listings.csv")
        self.df = None
        self._cache = {}
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.csv_path):
            print("❌ File CSV non trovato in data/listings.csv")
            self.df = None
            return

        try:
            cols = ['neighbourhood_cleansed', 'price', 'accommodates',
                    'room_type', 'minimum_nights', 'number_of_reviews_ltm',
                    'estimated_occupancy_l365d']
            df = pd.read_csv(self.csv_path, usecols=cols, low_memory=False)
            total = len(df)

            # Pulisce i prezzi da valute e virgole
            df['price'] = pd.to_numeric(
                df['price'].astype(str).str.replace(r'[^\d\.]', '', regex=True), errors='coerce')
            df['accommodates'] = pd.to_numeric(df['accommodates'], errors='coerce')
            # Notti occupate stimate da Inside Airbnb (modello basato sulle recensioni, tetto 255 = 70%) -> %
            df['occ_pct'] = pd.to_numeric(df['estimated_occupancy_l365d'], errors='coerce') / 365 * 100
            df = df.dropna(subset=['neighbourhood_cleansed', 'price', 'accommodates'])

            # Filtri di qualità: prezzi plausibili, solo appartamenti interi,
            # niente affitti mensili, solo annunci con almeno una recensione negli ultimi 12 mesi
            df = df[(df['price'] >= 20) & (df['price'] <= 2500)]
            df = df[df['room_type'] == ENTIRE_HOME]
            df = df[df['minimum_nights'].fillna(1) <= MAX_MIN_NIGHTS]
            df = df[df['number_of_reviews_ltm'].fillna(0) > 0]

            df['_neigh'] = df['neighbourhood_cleansed'].astype(str).str.strip().str.lower()
            self.df = df.reset_index(drop=True)
            print(f"✅ CSV caricato: {len(self.df)} annunci utilizzabili su {total} (appartamenti interi, attivi, soggiorni brevi).")
        except Exception as e:
            print(f"💥 Errore lettura CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].astype(str).unique().tolist())
        return ["Nessun CSV"]

    def get_market_stats(self, neighbourhood: str, max_guests: int = None) -> dict:
        """Statistiche di mercato: mediana, P25, P75, numero di annunci e ambito usato."""
        if self.df is None or self.df.empty:
            raise ValueError("CSV vuoto o non caricato")

        key = (str(neighbourhood).strip().lower(), int(max_guests) if max_guests else None)
        if key in self._cache:
            return self._cache[key]

        neigh, guests = key
        sub = self.df[self.df['_neigh'] == neigh]                       # 1. ricerca esatta
        if sub.empty and len(neigh) >= 3:                               # 2. ricerca parziale
            sub = self.df[self.df['_neigh'].str.contains(neigh, regex=False, na=False)]
        if sub.empty:
            raise ValueError(f"Quartiere non trovato: {neighbourhood}")

        scope = "quartiere"
        if guests is not None:                                          # 3. capienza ±1, se il campione regge
            near = sub[(sub['accommodates'] >= guests - 1) & (sub['accommodates'] <= guests + 1)]
            if len(near) >= MIN_SAMPLE:
                sub, scope = near, "quartiere + capienza"

        prices = sub['price']
        occ = sub['occ_pct'].dropna()
        stats = {
            "median": float(prices.median()),
            "p25": float(prices.quantile(0.25)),
            "p75": float(prices.quantile(0.75)),
            "n": int(len(prices)),
            "occ_mean": round(float(occ.mean()), 1) if len(occ) else None,
            "occ_p25": round(float(occ.quantile(0.25)), 1) if len(occ) else None,
            "occ_p75": round(float(occ.quantile(0.75)), 1) if len(occ) else None,
            "scope": scope,
            "reliable": bool(len(prices) >= MIN_SAMPLE),
        }
        self._cache[key] = stats
        return stats

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        return self.get_market_stats(neighbourhood, max_guests)["median"]


import glob
import re

MIN_PICKUP_SAMPLE = 80  # sotto questa soglia la notte non è ritenuta affidabile


class DemandEngine:
    """Indice di domanda reale per data, ricavato dal confronto di due snapshot del calendario
    (vedi backend/compare_calendars.py). Facoltativo: se non trova questi file, non fa nulla,
    e il resto dell'app continua a funzionare solo con le regole manuali.

    Se più file coprono la stessa data, vince quello costruito con lo snapshot più recente
    (ricavato dal nome del file: calendar_pickup_<vecchio>_<nuovo>.csv)."""

    def __init__(self, data_dir: str):
        self.by_date = {}
        self._load(data_dir)

    def _load(self, data_dir: str):
        pattern = os.path.join(data_dir, "calendar_pickup_*.csv")
        files = sorted(glob.glob(pattern))
        name_re = re.compile(r"calendar_pickup_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$")
        for path in files:
            m = name_re.search(os.path.basename(path))
            freshness = m.group(2) if m else ""
            try:
                df = pd.read_csv(path, usecols=["date", "avail_a", "demand_index"])
            except Exception as e:
                print(f"⚠️ Impossibile leggere {path}: {e}")
                continue
            df = df.dropna(subset=["demand_index"])
            df = df[pd.to_numeric(df["avail_a"], errors="coerce") >= MIN_PICKUP_SAMPLE]
            for _, row in df.iterrows():
                d = str(row["date"])
                prev = self.by_date.get(d)
                if prev is None or freshness >= prev[1]:
                    self.by_date[d] = (float(row["demand_index"]), freshness)
        if self.by_date:
            dates = sorted(self.by_date)
            print(f"✅ Domanda reale caricata per {len(self.by_date)} notti "
                  f"({dates[0]} -> {dates[-1]}, da {len(files)} file calendar_pickup).")

    def get(self, date_str: str):
        v = self.by_date.get(date_str)
        return v[0] if v else None