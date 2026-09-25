import pandas as pd
import os

class MilanChallengerEngine:
    def __init__(self):
        # Il segugio: cerca il file ovunque si trovi
        self.csv_path = self._find_csv()
        self.df = None
        self._load_data()

    def _find_csv(self):
        """Cerca il file CSV in tutte le possibili cartelle di Render o locali."""
        percorsi_possibili = [
            "listings.csv",             # Cartella base
            "data/listings.csv",        # Sottocartella data (dove l'ha messo Git!)
            "../data/listings.csv",     # Cartella superiore
            "app/data/listings.csv",    # Variante Render
            "../listings.csv"
        ]
        for percorso in percorsi_possibili:
            if os.path.exists(percorso):
                return percorso
        return "listings.csv" # Fallback disperato

    def _load_data(self):
        if not os.path.exists(self.csv_path):
            print(f"ℹ️ File non trovato in {self.csv_path}. Nessun dato reale disponibile.")
            self.df = None
            return

        try:
            # Legge solo le colonne che ci servono per risparmiare memoria
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'])
            
            if self.df['price'].dtype == object:
                self.df['price'] = self.df['price'].replace({'\$': '', ',': ''}, regex=True).astype(float)
            
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ Dataset Airbnb caricato da '{self.csv_path}': {len(self.df)} annunci analizzabili.")
        except Exception as e:
            print(f"⚠️ Errore nel caricamento del file CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        """Restituisce la lista esatta e univoca dei quartieri letti dal CSV."""
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].unique().tolist())
        return [] # Se fallisce, restituisce lista vuota invece di una stringa di errore

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        """Calcola la mediana esatta incrociando Quartiere e Posti letto."""
        if self.df is None or self.df.empty:
            raise ValueError("Dataset non disponibile")

        # Ricerca per testo (es: "niguarda" trova "NIGUARDA - CA' GRANDA")
        mask = self.df['neighbourhood_cleansed'].str.lower().str.contains(neighbourhood.lower(), na=False)
        filtered_df = self.df[mask]

        if max_guests is not None:
            strict_filter = filtered_df[filtered_df['accommodates'] == max_guests]
            if not strict_filter.empty:
                filtered_df = strict_filter

        if filtered_df.empty:
            raise ValueError(f"Nessun dato reale sufficiente per {neighbourhood}")

        return float(filtered_df['price'].median())