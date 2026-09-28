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
                    'room_type', 'minimum_nights', 'number_of_reviews_ltm']
            df = pd.read_csv(self.csv_path, usecols=cols, low_memory=False)
            total = len(df)

            # Pulisce i prezzi da valute e virgole
            df['price'] = pd.to_numeric(
                df['price'].astype(str).str.replace(r'[^\d\.]', '', regex=True), errors='coerce')
            df['accommodates'] = pd.to_numeric(df['accommodates'], errors='coerce')
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
        stats = {
            "median": float(prices.median()),
            "p25": float(prices.quantile(0.25)),
            "p75": float(prices.quantile(0.75)),
            "n": int(len(prices)),
            "scope": scope,
            "reliable": bool(len(prices) >= MIN_SAMPLE),
        }
        self._cache[key] = stats
        return stats

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        return self.get_market_stats(neighbourhood, max_guests)["median"]
    