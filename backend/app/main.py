from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="ChallengerHouse API", version="2.0")

# Abilitazione CORS per permettere le chiamate dal frontend su Vercel e in locale
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# SISTEMA DI AUTENTICAZIONE (PIN SERVER-SIDE)
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
# DATABASE QUARTIERI NIL MILANO
# ---------------------------------------------------------
MILANO_NILS = [
    "Duomo", "Brera", "Gioia", "Centrale", "Loreto", "Porta Venezia", 
    "Guastalla", "Navigli", "Ticinese", "Tortona", "Porta Romana", 
    "Buenos Aires", "Città Studi", "Lambrate", "Bicocca", "Niguarda", 
    "Isola", "Garibaldi", "Sempione", "CityLife", "San Siro", "Fiera", 
    "QT8", "Certosa", "Bovisa", "Corvetto", "Rogoredo", "Porta Ticinese"
]

@app.get("/api/neighbourhoods")
def get_neighbourhoods():
    return {"neighbourhoods": MILANO_NILS}


# ---------------------------------------------------------
# MOTORE DI CALCOLO PREZZI E MERCATO
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
        raise HTTPException(status_code=400, detail="Formato data non valido. Usa YYYY-MM-DD")

    day_of_week = dt.strftime("%A")
    is_weekend = dt.weekday() >= 4 # Venerdì e Sabato

    # Logica simulazione eventi e moltiplicatori basata sul mercato di Milano
    multiplier = 1.0
    active_event = None

    # Esempio eventi ricorrenti o weekend
    if is_weekend:
        multiplier = 1.25
        active_event = "Weekend Premium"

    # Eventi specifici di Milano simulati
    if target_date in ["2026-04-16", "2026-04-17", "2026-04-18", "2026-04-19"]:
        multiplier = 1.85
        active_event = "Salone del Mobile"
    elif target_date in ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]:
        multiplier = 1.60
        active_event = "GP Monza / Fashion Week"

    # Calcolo tariffa pura Challenger
    calculated_price = base_price * multiplier
    
    # Aggiunta extra ospiti se superano la soglia standard (es. > 2)
    if guests > 2:
        extra_people = guests - 2
        calculated_price += (extra_people * extra_guest_fee)

    # Aggiunta extra giornaliero (es. utenze)
    calculated_price += daily_extra_fee

    # Applicazione vincolo Floor Price (soglia minima)
    final_challenger_price = max(floor_price, calculated_price)

    # Mediana di mercato simulata in base al quartiere
    market_median = base_price * (1.1 if neighbourhood in ["Duomo", "Brera", "Garibaldi"] else 0.95)
    if is_weekend:
        market_median *= 1.2

    delta = round(final_challenger_price - champion_price, 2)

    return {
        "date": target_date,
        "day_of_week": day_of_week,
        "challenger_price": round(final_challenger_price, 2),
        "champion_price": round(champion_price, 2),
        "market_median": round(market_median, 2),
        "market_sample_count": 14,
        "active_event": active_event,
        "multiplier": multiplier,
        "delta": delta
    }