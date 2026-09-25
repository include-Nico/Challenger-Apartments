import pandas as pd
import os

class MilanChallengerEngine:
    def __init__(self):
        # 1. Trova il percorso assoluto in cui si trova QUESTO file (engine.py)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 2. Fai un passo indietro alla cartella principale (backend/)
        backend_dir = os.path.dirname(current_dir)
        
        # 3. Costruisci il percorso esatto verso data/listings.csv
        self.csv_path = os.path.join(backend_dir, "data", "listings.csv")
        
        self.df = None
        self._load_data()

    def _load_data(self):
        print(f"🔍 CERCO IL FILE IN: {self.csv_path}")

        if not os.path.exists(self.csv_path):
            print(f"❌ FILE NON TROVATO! Verifica che la cartella 'data' e il file esistano su Github.")
            self.df = None
            return

        try:
            print("⏳ File trovato! Lettura Pandas in corso (potrebbe richiedere 30-60 secondi)...")
            # low_memory=False previene crash se il file Airbnb è sporco o malformato
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'], low_memory=False)
            
            if self.df['price'].dtype == object:
                self.df['price'] = self.df['price'].replace({r'\$': '', ',': ''}, regex=True).astype(float)
            
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ DATASET CARICATO CON SUCCESSO! {len(self.df)} annunci pronti.")
        except Exception as e:
            print(f"💥 ERRORE CRITICO NELLA LETTURA DEL CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        """Restituisce la lista esatta e univoca dei quartieri letti dal CSV."""
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].unique().tolist())
        return ["Nessun dato CSV disponibile - Controlla i Log su Render"]

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        """Calcola la mediana esatta incrociando Quartiere e Posti letto."""
        if self.df is None or self.df.empty:
            raise ValueError("Dataset non disponibile")

        mask = self.df['neighbourhood_cleansed'].str.lower().str.contains(neighbourhood.lower(), na=False)
        filtered_df = self.df[mask]

        if max_guests is not None:
            strict_filter = filtered_df[filtered_df['accommodates'] == max_guests]
            if not strict_filter.empty:
                filtered_df = strict_filter

        if filtered_df.empty:
            raise ValueError(f"Nessun dato reale sufficiente per {neighbourhood}")

        return float(filtered_df['price'].median())