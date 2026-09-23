from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, date

app = FastAPI(title="ChallengerHouse API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# AUTENTICAZIONE
# ---------------------------------------------------------
class AuthRequest(BaseModel):
    pin: str

SECRET_PIN = "1234"

@app.post("/api/auth")
def verify_pin(request: AuthRequest):
    if request.pin == SECRET_PIN:
        return {"status": "ok", "message": "Accesso consentito"}
    raise HTTPException(status_code=401, detail="PIN errato")

# ---------------------------------------------------------
# QUARTIERI
# ---------------------------------------------------------
MILANO_NILS = [
    "Duomo", "Brera", "Gioia", "Centrale", "Loreto", "Porta Venezia", 
    "Guastalla", "Navigli", "Ticinese", "Tortona", "Porta Romana", 
    "Buenos Aires", "Città Studi", "Lambrate", "Bicocca", "Niguarda", 
    "Isola", "Garibaldi", "Sempione", "CityLife", "San Siro", "Fiera"
]

@app.get("/api/neighbourhoods")
def get_neighbourhoods():
    return {"neighbourhoods": MILANO_NILS}

# ---------------------------------------------------------
# IL NUOVO MOTORE DI CALCOLO 3.0 (TUTTI I FATTORI)
# ---------------------------------------------------------
@app.get("/api/pricing/calculate")
def calculate_pricing(
    target_date: str,
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
        dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido")

    day_of_week = dt.strftime("%A")
    is_weekend = dt.weekday() >= 4 

    multiplier = 1.0
    active_event = None

    # --- FATTOR 1: LEAD TIME (Quanto manca al check-in) ---
    today = date.today()
    lead_days = (dt.date() - today).days
    
    lead_multiplier = 1.0
    if 0 <= lead_days <= 3:
        lead_multiplier = 0.90 # Sconto Last-Minute 10% per riempire i buchi
        if not active_event: active_event = "Sconto Last-Minute (-10%)"
    elif lead_days > 60:
        lead_multiplier = 1.05 # Premium su prenotazioni anticipate sicure

    # --- FATTORE 2: STAGIONALITÀ MENSILE MILANESE ---
    month = dt.month
    season_multiplier = 1.0
    if month == 8:
        season_multiplier = 0.85 # Agosto a Milano è deserto
        if not active_event: active_event = "Bassa Stagione (Agosto)"
    elif month in [4, 5, 9, 10]:
        season_multiplier = 1.10 # Alta stagione primaverile/autunnale

    seasonal_base_price = base_price * season_multiplier

    # --- FATTORE 3: EVENTI E FESTIVITÀ ---
    holidays = {
        "2026-01-01": ("Capodanno", 1.60), "2026-01-06": ("Epifania", 1.30),
        "2026-04-05": ("Pasqua", 1.50), "2026-04-06": ("Pasquetta", 1.40),
        "2026-04-25": ("Liberazione", 1.35), "2026-05-01": ("Primo Maggio", 1.35),
        "2026-06-02": ("Repubblica", 1.35), "2026-08-15": ("Ferragosto", 1.40),
        "2026-11-01": ("Ognissanti", 1.30), "2026-12-07": ("Sant'Ambrogio", 1.70),
        "2026-12-08": ("Immacolata", 1.60), "2026-12-25": ("Natale", 1.50),
        "2026-12-31": ("San Silvestro", 2.00)
    }

    if target_date in holidays:
        active_event = holidays[target_date][0]
        multiplier = holidays[target_date][1]

    if "2026-04-14" <= target_date <= "2026-04-19":
        active_event = "Salone del Mobile"
        multiplier = 2.20
    elif "2026-09-22" <= target_date <= "2026-09-28":
        active_event = "Milano Fashion Week Donna"
        multiplier = 1.80
    elif "2026-09-04" <= target_date <= "2026-09-06":
        active_event = "GP Monza"
        multiplier = 1.60
    elif "2026-11-05" <= target_date <= "2026-11-08":
        active_event = "EICMA"
        multiplier = 1.65

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

    base_market = base_price * (1.15 if neighbourhood in ["Duomo", "Brera", "Navigli", "Garibaldi"] else 0.95)
    capacity_premium = (max_guests - 2) * 15 if max_guests > 2 else 0
    market_median = base_market + capacity_premium

    if multiplier > 1.0:
        market_median *= (multiplier - 0.1)

    delta = round(final_challenger_price - champion_price, 2)

    return {
        "date": target_date,
        "day_of_week": day_of_week,
        "challenger_price": round(final_challenger_price, 2),
        "champion_price": round(champion_price, 2),
        "market_median": round(market_median, 2),
        "market_sample_count": 14,
        "active_event": active_event,
        "multiplier": round(total_multiplier, 2),
        "delta": delta
    }