import os
import pandas as pd
from datetime import date
from typing import Optional, Dict

class MilanChallengerEngine:
    def __init__(self, data_path: Optional[str] = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if data_path is None:
            data_path = os.path.join(base_dir, "data", "listings.csv")

        # Calendario Eventi e Festività Milano
        self.events = [
            {"name": "Milano Fashion Week Donna (Febbraio)", "start": "2026-02-24", "end": "2026-03-02", "multiplier": 1.75},
            {"name": "Carnevale Ambrosiano (Milano)", "start": "2026-02-20", "end": "2026-02-22", "multiplier": 1.25},
            {"name": "Weekend Pasqua & Pasquetta", "start": "2026-04-03", "end": "2026-04-06", "multiplier": 1.40},
            {"name": "Milano Design Week / Salone del Mobile", "start": "2026-04-21", "end": "2026-04-26", "multiplier": 2.35},
            {"name": "Ponte del 25 Aprile", "start": "2026-04-24", "end": "2026-04-26", "multiplier": 1.35},
            {"name": "Ponte del 1° Maggio", "start": "2026-05-01", "end": "2026-05-03", "multiplier": 1.30},
            {"name": "Ponte Festa della Repubblica", "start": "2026-05-30", "end": "2026-06-02", "multiplier": 1.30},
            {"name": "Milano Fashion Week Uomo (Giugno)", "start": "2026-06-19", "end": "2026-06-23", "multiplier": 1.45},
            {"name": "Gran Premio d'Italia (Monza F1)", "start": "2026-09-04", "end": "2026-09-06", "multiplier": 1.55},
            {"name": "Milano Fashion Week Donna (Settembre)", "start": "2026-09-22", "end": "2026-09-28", "multiplier": 1.70},
            {"name": "Ponte Ognissanti / Halloween", "start": "2026-10-30", "end": "2026-11-02", "multiplier": 1.30},
            {"name": "EICMA (Fiera Motociclo)", "start": "2026-11-05", "end": "2026-11-08", "multiplier": 1.50},
            {"name": "Black Friday & Shopping", "start": "2026-11-27", "end": "2026-11-29", "multiplier": 1.25},
            {"name": "Sant'Ambrogio & Immacolata", "start": "2026-12-05", "end": "2026-12-08", "multiplier": 1.55},
            {"name": "Natale & Capodanno", "start": "2026-12-23", "end": "2027-01-03", "multiplier": 1.75},
            {"name": "Epifania", "start": "2027-01-04", "end": "2027-01-06", "multiplier": 1.25}
        ]

        self.df_market = None
        self.median_cache = {}
        print(f"\n--> Inizializzazione Engine. Cerco: {data_path}")

        if os.path.exists(data_path):
            try:
                df = pd.read_csv(data_path)
                
                # Pulizia forzata della colonna price
                if "price" in df.columns:
                    clean_series = (
                        df["price"]
                        .astype(str)
                        .str.replace("$", "", regex=False)
                        .str.replace(",", "", regex=False)
                        .str.strip()
                    )
                    df["price"] = pd.to_numeric(clean_series, errors="coerce")
                    df = df.dropna(subset=["price"])
                    df = df[df["price"] > 0]
                
                self.df_market = df
                print(f"--> [SUCCESSO] Dataset caricato: {len(df)} annunci attivi!\n")
            except Exception as e:
                print(f"--> [ERRORE] File trovato ma illeggibile: {e}\n")
        else:
            print(f"--> [AVVISO] Nessun file CSV. Sistema in modalità fallback (prezzo fisso).\n")

    def get_available_neighbourhoods(self) -> list:
        """Estrae i quartieri reali dal CSV o usa un elenco fallback di Milano."""
        fallback_list = [
            "Duomo", "Centrale", "Navigli", "Brera", "Isola", "Loreto", "Porta Romana", 
            "Bovisa", "Città Studi", "Niguarda", "Ticinese", "Porta Venezia", 
            "Tre Torri", "San Siro", "Lambrate", "Bicocca", "Quarto Oggiaro", "Baggio"
        ]
        
        if self.df_market is None or self.df_market.empty:
            return sorted(fallback_list)

        col = None
        for candidate in ["neighbourhood_cleansed", "neighbourhood"]:
            if candidate in self.df_market.columns:
                col = candidate
                break

        if col:
            quartieri = self.df_market[col].dropna().unique().tolist()
            return sorted([str(q).strip() for q in quartieri if str(q).strip()])
            
        return sorted(fallback_list)

    def get_market_comp_price(self, neighbourhood: Optional[str] = None, room_type: str = "Entire home/apt"):
        """Calcola la mediana locale dei prezzi."""
        if self.df_market is None or self.df_market.empty:
            return 115.0, 0, 0

        cache_key = f"{neighbourhood}_{room_type}"
        if cache_key in self.median_cache:
            return self.median_cache[cache_key]

        total_listings = len(self.df_market)
        filtered = self.df_market

        if "room_type" in filtered.columns:
            filtered = filtered[filtered["room_type"] == room_type]

        col = None
        for candidate in ["neighbourhood_cleansed", "neighbourhood"]:
            if candidate in filtered.columns:
                col = candidate
                break

        if neighbourhood and col:
            sub = filtered[filtered[col].astype(str).str.contains(neighbourhood, case=False, na=False)]
            if len(sub) >= 3:
                filtered = sub

        numeric_prices = pd.to_numeric(filtered["price"], errors="coerce").dropna()
        median_val = round(float(numeric_prices.median()), 2) if not numeric_prices.empty else 115.0
        
        count = len(filtered)
        res = (median_val, count, total_listings)
        self.median_cache[cache_key] = res
        return res

    def _get_event_multiplier(self, target_date: date):
        d_str = target_date.isoformat()
        for ev in self.events:
            if ev["start"] <= d_str <= ev["end"]:
                return ev["multiplier"], ev["name"]
        return 1.0, None

    def calculate_price(
        self,
        target_date: date,
        base_price: float,
        floor_price: float,
        champion_price: float = 120.0,
        neighbourhood: Optional[str] = "Centrale",
        max_guests: int = 2,
        extra_guest_fee: float = 25.0,
        daily_extra_fee: float = 0.0,
        num_guests: Optional[int] = None
    ) -> Dict:
        dow = target_date.weekday()
        dow_multiplier = 1.15 if dow in (4, 5) else 1.0

        event_multiplier, event_name = self._get_event_multiplier(target_date)
        market_median, sample_count, total_db = self.get_market_comp_price(neighbourhood=neighbourhood)

        raw_price = (base_price * dow_multiplier * event_multiplier) + daily_extra_fee
        challenger_price = max(raw_price, floor_price)

        guests = num_guests if num_guests is not None else max_guests
        extra_guests = max(0, guests - 2)
        total_challenger = challenger_price + (extra_guests * extra_guest_fee)
        price_per_person = total_challenger / max(1, guests)

        return {
            "date": target_date.isoformat(),
            "day_of_week": target_date.strftime("%a"),
            "market_median": round(market_median, 2),
            "market_sample_count": sample_count,
            "market_total_listings": total_db,
            "champion_price": round(champion_price, 2),
            "challenger_price": round(total_challenger, 2),
            "price_per_person": round(price_per_person, 2),
            "active_event": event_name,
            "multiplier": round(dow_multiplier * event_multiplier, 2),
            "delta": round(total_challenger - champion_price, 2)
        }