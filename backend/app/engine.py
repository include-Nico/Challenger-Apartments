import pandas as pd
import os

class MilanChallengerEngine:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        self.csv_path = os.path.join(backend_dir, "data", "listings.csv")
        self.df = None
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.csv_path):
            print("❌ File CSV non trovato in data/listings.csv")
            self.df = None
            return

        try:
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'], low_memory=False)
            
            # Pulizia ESTREMA del prezzo: rimuove dollari, virgole, spazi, lasciando solo numeri e il punto decimale
            self.df['price'] = self.df['price'].astype(str).str.replace(r'[^\d\.]', '', regex=True)
            self.df['price'] = pd.to_numeric(self.df['price'], errors='coerce')
            
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ CSV caricato: {len(self.df)} annunci validi.")
        except Exception as e:
            print(f"💥 Errore lettura CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].astype(str).unique().tolist())
        return ["Nessun CSV"]

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        if self.df is None or self.df.empty:
            raise ValueError("CSV vuoto o non caricato")

        neigh_clean = str(neighbourhood).strip().lower()
        df_neigh = self.df['neighbourhood_cleansed'].astype(str).str.strip().str.lower()
        
        # 1. Ricerca Esatta
        mask = df_neigh == neigh_clean
        filtered_df = self.df[mask]

        # 2. Ricerca Parziale (se l'esatta fallisce per qualche strana codifica)
        if filtered_df.empty:
            mask = df_neigh.str.contains(neigh_clean, regex=False, na=False)
            filtered_df = self.df[mask]

        if filtered_df.empty:
            raise ValueError(f"Quartiere non trovato: {neighbourhood}")

        # Filtro Capacità
        if max_guests is not None:
            self.df['accommodates'] = pd.to_numeric(self.df['accommodates'], errors='coerce')
            strict_filter = filtered_df[filtered_df['accommodates'] == float(max_guests)]
            if not strict_filter.empty:
                filtered_df = strict_filter

        median_val = filtered_df['price'].median()
        if pd.isna(median_val):
            raise ValueError("Tutti i prezzi sono NaN")
            
        return float(median_val)