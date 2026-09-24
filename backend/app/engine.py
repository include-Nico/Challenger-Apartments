import pandas as pd
import os

class MilanChallengerEngine:
    def __init__(self, csv_path="listings.csv"):
        self.csv_path = csv_path
        self.df = None
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.csv_path):
            print(f"ℹ️ File {self.csv_path} non trovato. Nessun dato reale disponibile.")
            self.df = None
            return

        try:
            # Legge solo le colonne che ci servono per risparmiare memoria su Render
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'])
            
            if self.df['price'].dtype == object:
                self.df['price'] = self.df['price'].replace({'\$': '', ',': ''}, regex=True).astype(float)
            
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ Dataset Airbnb caricato con successo: {len(self.df)} annunci analizzabili.")
        except Exception as e:
            print(f"⚠️ Errore nel caricamento del file CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        """Restituisce la lista esatta e univoca dei quartieri letti dal CSV."""
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].unique().tolist())
        return ["Nessun dato CSV disponibile - Controlla i Log"]

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        """Calcola la mediana esatta incrociando Quartiere e Posti letto."""
        if self.df is None or self.df.empty:
            raise ValueError("Dataset non disponibile")

        mask = self.df['neighbourhood_cleansed'].str.lower() == neighbourhood.lower()
        filtered_df = self.df[mask]

        if max_guests is not None:
            strict_filter = filtered_df[filtered_df['accommodates'] == max_guests]
            if not strict_filter.empty:
                filtered_df = strict_filter

        if filtered_df.empty:
            raise ValueError(f"Nessun dato reale sufficiente per {neighbourhood}")

        return float(filtered_df['price'].median())