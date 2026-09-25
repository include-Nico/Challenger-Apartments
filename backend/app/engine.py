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
            
            # Pulisce i prezzi da valute e virgole
            self.df['price'] = self.df['price'].astype(str).str.replace(r'[^\d\.]', '', regex=True)
            self.df['price'] = pd.to_numeric(self.df['price'], errors='coerce')
            
            # --- FILTRO ANTI-FOLLIA AGGIORNATO ---
            # Tiene tutto ciò che costa tra i 20€ e i 2500€ a notte
            self.df = self.df[(self.df['price'] >= 20) & (self.df['price'] <= 2500)]
            
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ CSV caricato e RIPULITO: {len(self.df)} annunci realistici pronti.")
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

        # 2. Ricerca Parziale
        if filtered_df.empty:
            mask = df_neigh.str.contains(neigh_clean, regex=False, na=False)
            filtered_df = self.df[mask]

        if filtered_df.empty:
            raise ValueError(f"Quartiere non trovato: {neighbourhood}")

        # --- FILTRO CAPIENZA INTELLIGENTE ---
        if max_guests is not None:
            self.df['accommodates'] = pd.to_numeric(self.df['accommodates'], errors='coerce')
            
            # Cerca un range sensato (es. cerchi 4? Prende 3, 4 e 5)
            guest_mask = (filtered_df['accommodates'] >= max_guests - 1) & (filtered_df['accommodates'] <= max_guests + 1)
            smart_filter = filtered_df[guest_mask]
            
            # Lo applica SOLO SE ci sono almeno 5 case per fare statistica, altrimenti usa l'intero quartiere
            if len(smart_filter) >= 5:
                filtered_df = smart_filter

        median_val = filtered_df['price'].median()
        
        if pd.isna(median_val):
            raise ValueError("Prezzi invalidi nel quartiere")
            
        return float(median_val)