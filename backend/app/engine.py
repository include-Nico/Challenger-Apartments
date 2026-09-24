import pandas as pd
import os
import requests
import re

class MilanChallengerEngine:
    def __init__(self, csv_path="listings.csv", gdrive_link=None):
        self.csv_path = csv_path
        self.gdrive_link = gdrive_link
        self.df = None
        self._load_data()

    def _get_direct_download_url(self):
        """Estrae l'ID dal link di Google Drive e crea un link di download diretto."""
        if not self.gdrive_link:
            return None
        match = re.search(r'/d/([a-zA-Z0-9_-]+)', self.gdrive_link)
        if match:
            return f"https://drive.google.com/uc?export=download&id={match.group(1)}"
        return self.gdrive_link

    def _download_csv(self):
        direct_url = self._get_direct_download_url()
        if not direct_url:
            print("⚠️ Nessun URL fornito per scaricare il CSV.")
            return False
            
        print("⬇️ Download del dataset di mercato in corso (68MB). Attendere...")
        try:
            response = requests.get(direct_url, stream=True)
            response.raise_for_status()
            with open(self.csv_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("✅ Download del dataset completato!")
            return True
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
            self.df = pd.read_csv(self.csv_path, usecols=['neighbourhood_cleansed', 'price', 'accommodates'])
            if self.df['price'].dtype == object:
                self.df['price'] = self.df['price'].replace({'\$': '', ',': ''}, regex=True).astype(float)
            
            # Pulisce eventuali righe vuote
            self.df = self.df.dropna(subset=['neighbourhood_cleansed', 'price'])
            print(f"✅ Dataset caricato con successo: {len(self.df)} annunci analizzabili.")
        except Exception as e:
            print(f"⚠️ Errore nel caricamento del file CSV: {e}")
            self.df = None

    def get_all_neighbourhoods(self):
        """Restituisce la lista esatta e univoca dei quartieri letti dal CSV."""
        if self.df is not None and not self.df.empty:
            return sorted(self.df['neighbourhood_cleansed'].unique().tolist())
        return ["Nessun dato CSV disponibile - Controlla il link Google Drive"]

    def get_median(self, neighbourhood: str, max_guests: int = None) -> float:
        """Calcola la mediana esatta incrociando Quartiere e (se possibile) Posti letto."""
        if self.df is None or self.df.empty:
            raise ValueError("Dataset non disponibile")

        mask = self.df['neighbourhood_cleansed'].str.lower() == neighbourhood.lower()
        filtered_df = self.df[mask]

        if max_guests is not None:
            # Prova a filtrare anche per capienza
            strict_filter = filtered_df[filtered_df['accommodates'] == max_guests]
            # Se trova abbastanza case usa questo, altrimenti usa la mediana generale del quartiere
            if not strict_filter.empty:
                filtered_df = strict_filter

        if filtered_df.empty:
            raise ValueError(f"Nessun dato reale sufficiente per {neighbourhood}")

        return float(filtered_df['price'].median())