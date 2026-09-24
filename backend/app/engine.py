import pandas as pd
import os
import gdown

class MilanChallengerEngine:
    def __init__(self, csv_path="listings.csv", gdrive_link=None):
        self.csv_path = csv_path
        self.gdrive_link = gdrive_link
        self.df = None
        self._load_data()

    def _download_csv(self):
        if not self.gdrive_link or self.gdrive_link == "https://docs.google.com/spreadsheets/d/1rM_9jpeS3LH24PspxD3XFii0j6Nt-f7AhVgMmei5Qig/edit?usp=sharing":
            print("⚠️ Nessun URL valido fornito per scaricare il CSV.")
            return False
            
        print("⬇️ Download del dataset da Google Drive in corso (bypasso blocco antivirus)...")
        try:
            # gdown.download con fuzzy=True capisce da solo qualsiasi link di Google Drive
            gdown.download(url=self.gdrive_link, output=self.csv_path, quiet=False, fuzzy=True)
            
            if os.path.exists(self.csv_path):
                print("✅ Download del dataset completato!")
                return True
            return False
        except Exception as e:
            print(f"❌ Errore durante il download da Google Drive: {e}")
            return False

    def _load_data(self):
        if not os.path.exists(self.csv_path):
            success = self._download_csv()
            if not success:
                print("ℹ️ Impossibile ottenere il CSV. Nessun dato reale disponibile.")
                self.df = None
                return

        try:
            # Carica le colonne necessarie
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'])
            
            # Pulisce i prezzi (es. da "$100.00" a 100.0)
            if self.df['price'].dtype == object:
                self.df['price'] = self.df['price'].replace({'\$': '', ',': ''}, regex=True).astype(float)
            
            # Rimuove righe non valide
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ Dataset caricato con successo: {len(self.df)} annunci analizzabili.")
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