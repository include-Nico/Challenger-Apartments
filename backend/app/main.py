from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="ChallengerHouse API", version="2.2")

# Abilitazione CORS
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
# MOTORE DI CALCOLO PREZZI E CALENDARIO EVENTI 2026/2027
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
    is_weekend = dt.weekday() >= 4  # Venerdì, Sabato, Domenica (domenica è 6)

    multiplier = 1.0
    active_event = None

    # 1. DIZIONARIO FESTIVITÀ NAZIONALI E PONTI MILANESI
    holidays = {
        "2026-01-01": ("Capodanno", 1.60),
        "2026-01-06": ("Epifania", 1.30),
        "2026-04-05": ("Pasqua", 1.50),
        "2026-04-06": ("Pasquetta", 1.40),
        "2026-04-25": ("Festa della Liberazione", 1.35),
        "2026-05-01": ("Festa dei Lavoratori", 1.35),
        "2026-06-02": ("Festa della Repubblica", 1.35),
        "2026-08-15": ("Ferragosto", 1.40),
        "2026-11-01": ("Ognissanti", 1.30),
        "2026-12-07": ("Sant'Ambrogio", 1.70), # Alta stagione Milano
        "2026-12-08": ("Immacolata", 1.60),
        "2026-12-24": ("Vigilia di Natale", 1.40),
        "2026-12-25": ("Natale", 1.50),
        "2026-12-26": ("Santo Stefano", 1.40),
        "2026-12-31": ("San Silvestro", 2.00)  # Picco massimo
    }

    # Controllo Festività (Priorità 1)
    if target_date in holidays:
        active_event = holidays[target_date][0]
        multiplier = holidays[target_date][1]

    # 2. GRANDI EVENTI FIERISTICI MILANO (Sovrascrivono le festività se si sovrappongono)
    if "2026-04-14" <= target_date <= "2026-04-19":
        active_event = "Salone del Mobile / Design Week"
        multiplier = 2.20
    elif "2026-02-24" <= target_date <= "2026-03-02":
        active_event = "Milano Fashion Week (A/I)"
        multiplier = 1.70
    elif "2026-09-22" <= target_date <= "2026-09-28":
        active_event = "Milano Fashion Week Donna"
        multiplier = 1.80
    elif "2026-09-04" <= target_date <= "2026-09-06":
        active_event = "GP Monza"
        multiplier = 1.60
    elif "2026-11-05" <= target_date <= "2026-11-08":
        active_event = "EICMA - Salone del Motociclo"
        multiplier = 1.65

    # 3. WEEKEND NORMALI (Se non c'è nessuna festa o evento)
    if not active_event and is_weekend:
        if dt.weekday() == 6: # La domenica sera di solito si sgonfia rispetto a ven/sab
            multiplier = 1.10
        else:
            active_event = "Weekend Premium"
            multiplier = 1.25

    # Calcolo tariffa pura Challenger
    calculated_price = base_price * multiplier
    
    # Ricarico Ospiti Extra
    if guests > 2:
        extra_people = guests - 2
        calculated_price += (extra_people * extra_guest_fee)

    # Costi Fissi Giornalieri
    calculated_price += daily_extra_fee

    # Applicazione del Floor (nessuna notte scende sotto questo prezzo)
    final_challenger_price = max(floor_price, calculated_price)

    # Dinamica di mercato simulata (Adegua la mediana in base al quartiere)
    market_median = base_price * (1.15 if neighbourhood in ["Duomo", "Brera", "Navigli", "Garibaldi"] else 0.95)
    if multiplier > 1.0:
        market_median *= (multiplier - 0.1) # La mediana segue il trend, ma il nostro algoritmo ottimizza meglio

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