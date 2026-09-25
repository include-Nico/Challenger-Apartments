import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, date, timedelta

# --- CONNESSIONE AL MOTORE REALE (CSV LOCALE) ---
try:
    from app.engine import MilanChallengerEngine
    market_engine = MilanChallengerEngine() 
    USE_REAL_DATA = True
    print("✅ Motore dati connesso. Utilizzo file listings.csv locale.")
except Exception as e:
    USE_REAL_DATA = False
    print(f"⚠️ Impossibile caricare engine.py. Errore: {e}")

app = FastAPI(title="ChallengerHouse API", version="7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    pin: str

# Hash SHA-256 del PIN
SECRET_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"

@app.post("/api/auth")
def verify_pin(request: AuthRequest):
    req_hash = hashlib.sha256(request.pin.encode()).hexdigest()
    if req_hash == SECRET_PIN_HASH:
        return {"status": "ok", "message": "Accesso consentito"}
    raise HTTPException(status_code=401, detail="PIN errato")

# --- LISTA QUARTIERI ESTRATTA DIRETTAMENTE DAL CSV ---
@app.get("/api/neighbourhoods")
def get_neighbourhoods():
    if USE_REAL_DATA and market_engine:
        return {"neighbourhoods": market_engine.get_all_neighbourhoods()}
    return {"neighbourhoods": ["Nessun dato CSV disponibile"]}

def calculate_single_night(target_date_str, base_price, floor_price, champion_price, neighbourhood, max_guests, extra_guest_fee, daily_extra_fee, guests):
    dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    day_of_week = dt.strftime("%A")
    is_weekend = dt.weekday() >= 4 

    multiplier = 1.0
    active_event = None

    today = date.today()
    lead_days = (dt.date() - today).days
    
    lead_multiplier = 1.0
    if 0 <= lead_days <= 3:
        lead_multiplier = 0.90 
        if not active_event: active_event = "Sconto Last-Minute (-10%)"
    elif lead_days > 60:
        lead_multiplier = 1.05 

    month = dt.month
    season_multiplier = 1.0
    if month == 8:
        season_multiplier = 0.85
        if not active_event: active_event = "Bassa Stagione (Agosto)"
    elif month in [4, 5, 9, 10]:
        season_multiplier = 1.10

    seasonal_base_price = base_price * season_multiplier

    month_day = dt.strftime("%m-%d")
    holidays_fixed = {
        "01-01": ("Capodanno", 1.60), "01-06": ("Epifania", 1.30),
        "04-25": ("Liberazione", 1.35), "05-01": ("Primo Maggio", 1.35),
        "06-02": ("Repubblica", 1.35), "08-15": ("Ferragosto", 1.40),
        "11-01": ("Ognissanti", 1.30), "12-07": ("Sant'Ambrogio", 1.70),
        "12-08": ("Immacolata", 1.60), "12-24": ("Vigilia di Natale", 1.40),
        "12-25": ("Natale", 1.50), "12-26": ("Santo Stefano", 1.40),
        "12-31": ("San Silvestro", 2.00)
    }

    if month_day in holidays_fixed:
        active_event = holidays_fixed[month_day][0]
        multiplier = holidays_fixed[month_day][1]

    if target_date_str in ["2026-04-05", "2027-03-28"]:
        active_event, multiplier = "Pasqua", 1.50
    elif target_date_str in ["2026-04-06", "2027-03-29"]:
        active_event, multiplier = "Pasquetta", 1.40

    events_ranges = [
        ("2026-04-21", "2026-04-26", "Salone del Mobile 2026", 2.20),
        ("2026-06-19", "2026-06-23", "Fashion Week Uomo", 1.60),
        ("2026-09-04", "2026-09-06", "GP Monza", 1.60),
        ("2026-09-22", "2026-09-28", "Fashion Week Donna", 1.80),
        ("2026-11-03", "2026-11-08", "EICMA 2026", 1.65),
        ("2026-11-27", "2026-11-29", "Milano Games Week", 1.40),
        ("2026-12-05", "2026-12-13", "Artigiano in Fiera", 1.50),
        ("2027-01-15", "2027-01-19", "Fashion Week Uomo", 1.60),
        ("2027-02-23", "2027-03-01", "Fashion Week Donna", 1.80),
        ("2027-04-13", "2027-04-18", "Salone del Mobile 2027", 2.20),
        ("2027-06-18", "2027-06-22", "Fashion Week Uomo", 1.60),
        ("2027-09-03", "2027-09-05", "GP Monza", 1.60),
        ("2027-09-21", "2027-09-27", "Fashion Week Donna", 1.80),
        ("2027-11-09", "2027-11-14", "EICMA 2027", 1.65),
    ]

    for start_dt, end_dt, ev_name, ev_mult in events_ranges:
        if start_dt <= target_date_str <= end_dt:
            active_event = ev_name
            multiplier = ev_mult
            break

    if not active_event and is_weekend:
        if dt.weekday() != 6: 
            active_event = "Weekend Premium"
            multiplier = 1.20

    total_multiplier = multiplier * lead_multiplier
    calculated_price = seasonal_base_price * total_multiplier
    
    if guests > 2:
        extra_people = guests - 2
        calculated_price += (extra_people * extra_guest_fee)

    calculated_price += daily_extra_fee
    final_challenger_price = max(floor_price, calculated_price)

    # --- CALCOLO MERCATO (SOLO DATO REALE CSV) ---
    market_median = 0
    if USE_REAL_DATA:
        try:
            real_val = market_engine.get_median(neighbourhood, max_guests) 
            market_median = float(real_val)
        except Exception:
            market_median = 0 # Nessuna invenzione, se non c'è il dato resta 0.

    # Eventi/Festività impattano anche la mediana del mercato
    if multiplier > 1.0 and market_median > 0:
        market_median *= (multiplier - 0.1)

    delta = round(final_challenger_price - champion_price, 2)

    return {
        "date": target_date_str,
        "day_of_week": day_of_week,
        "challenger_price": round(final_challenger_price, 2),
        "champion_price": round(champion_price, 2),
        "market_median": round(market_median, 2),
        "market_sample_count": "Reale (CSV)" if USE_REAL_DATA and market_median > 0 else "Nessun Dato",
        "active_event": active_event,
        "multiplier": round(total_multiplier, 2),
        "delta": delta
    }

@app.get("/api/pricing/calculate-range")
def calculate_pricing_range(
    start_date: str,
    end_date: str,
    base_price: float,
    floor_price: float,
    champion_price: float,
    neighbourhood: str = "Centrale",
    max_guests: int = 4,
    extra_guest_fee: float = 25.0,
    daily_extra_fee: float = 5.0,
    guests: int = 2
):
    try:
        current_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido")

    results = []
    while current_dt <= end_dt:
        date_str = current_dt.strftime("%Y-%m-%d")
        night_data = calculate_single_night(
            date_str, base_price, floor_price, champion_price, 
            neighbourhood, max_guests, extra_guest_fee, daily_extra_fee, guests
        )
        results.append(night_data)
        current_dt += timedelta(days=1)

    return {"results": results}