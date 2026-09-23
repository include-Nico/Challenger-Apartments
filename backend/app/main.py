from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, date

app = FastAPI(title="ChallengerHouse API", version="4.0")

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
# MOTORE DI CALCOLO 4.0 (TUTTI GLI EVENTI MILANESI 26/27)
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

    # --- FATTOR 1: LEAD TIME ---
    today = date.today()
    lead_days = (dt.date() - today).days
    
    lead_multiplier = 1.0
    if 0 <= lead_days <= 3:
        lead_multiplier = 0.90 
        if not active_event: active_event = "Sconto Last-Minute (-10%)"
    elif lead_days > 60:
        lead_multiplier = 1.05 

    # --- FATTORE 2: STAGIONALITÀ MENSILE ---
    month = dt.month
    season_multiplier = 1.0
    if month == 8:
        season_multiplier = 0.85
        if not active_event: active_event = "Bassa Stagione (Agosto)"
    elif month in [4, 5, 9, 10]:
        season_multiplier = 1.10

    seasonal_base_price = base_price * season_multiplier

    # --- FATTORE 3: FESTIVITÀ FISSE ANNUALI E PASQUA ---
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

    if target_date in ["2026-04-05", "2027-03-28"]:
        active_event, multiplier = "Pasqua", 1.50
    elif target_date in ["2026-04-06", "2027-03-29"]:
        active_event, multiplier = "Pasquetta", 1.40

    # --- FATTORE 4: GRANDI EVENTI MILANO E FIERE (2026-2027) ---
    events_ranges = [
        # 2026
        ("2026-04-21", "2026-04-26", "Salone del Mobile 2026", 2.20),
        ("2026-06-19", "2026-06-23", "Fashion Week Uomo", 1.60),
        ("2026-09-04", "2026-09-06", "GP Monza", 1.60),
        ("2026-09-22", "2026-09-28", "Fashion Week Donna", 1.80),
        ("2026-11-03", "2026-11-08", "EICMA 2026", 1.65),
        ("2026-11-27", "2026-11-29", "Milano Games Week", 1.40),
        ("2026-12-05", "2026-12-13", "Artigiano in Fiera", 1.50),
        
        # 2027
        ("2027-01-15", "2027-01-19", "Fashion Week Uomo", 1.60),
        ("2027-02-23", "2027-03-01", "Fashion Week Donna", 1.80),
        ("2027-04-13", "2027-04-18", "Salone del Mobile 2027", 2.20),
        ("2027-06-18", "2027-06-22", "Fashion Week Uomo", 1.60),
        ("2027-09-03", "2027-09-05", "GP Monza", 1.60),
        ("2027-09-21", "2027-09-27", "Fashion Week Donna", 1.80),
        ("2027-11-09", "2027-11-14", "EICMA 2027", 1.65),
    ]

    for start_dt, end_dt, ev_name, ev_mult in events_ranges:
        if start_dt <= target_date <= end_dt:
            active_event = ev_name
            multiplier = ev_mult
            break

    if not active_event and is_weekend:
        if dt.weekday() != 6: # Esclude la domenica
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