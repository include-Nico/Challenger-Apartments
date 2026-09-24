import pandas as pd
import os

class MilanChallengerEngine:
    def __init__(self, csv_path="listings.csv"):
        self.csv_path = csv_path
        self.df = None
        self._load_data()

    def _load_data(self):
        """Carica il dataset di Airbnb se presente, ottimizzando la memoria."""
        if os.path.exists(self.csv_path):
            try:
                # Carica solo le colonne necessarie per non saturare la RAM del server
                self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'])
                
                # Pulisce la colonna del prezzo (es. trasforma "$100.00" in 100.0)
                if self.df['price'].dtype == object:
                    self.df['price'] = self.df['price'].replace({'\$': '', ',': ''}, regex=True).astype(float)
                
                print(f"✅ Dataset caricato: {len(self.df)} annunci pronti.")
            except Exception as e:
                print(f"⚠️ Errore nel caricamento del CSV: {e}")
                self.df = None
        else:
            print(f"ℹ️ File {self.csv_path} non trovato. Il motore userà l'algoritmo sintetico.")
            self.df = None

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        """Calcola la mediana reale del mercato filtrata per quartiere."""
        if self.df is None or self.df.empty:
            raise ValueError("Dataset non disponibile")

        # Filtra per quartiere (ignorando maiuscole/minuscole)
        mask = self.df['neighbourhood_cleansed'].str.lower() == neighbourhood.lower()
        filtered_df = self.df[mask]

        if max_guests is not None:
            # Opzionale: filtra anche in base ai posti letto
            filtered_df = filtered_df[filtered_df['accommodates'] == max_guests]

        if filtered_df.empty:
            raise ValueError(f"Nessun dato sufficiente per il quartiere {neighbourhood}")

        # Calcola e restituisce la mediana
        median_price = filtered_df['price'].median()
        return float(median_price)