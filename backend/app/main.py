import base64
import hmac
import hashlib
import json
import os
import time
from collections import defaultdict, deque
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --- CONFIGURAZIONE (da variabili d'ambiente o da un file backend/.env, mai nel codice) ---
try:
    from dotenv import load_dotenv
    load_dotenv()  # in locale legge backend/.env; in produzione non fa nulla se il file non c'è
except ImportError:
    pass
APP_PASSWORD = os.environ.get("APP_PASSWORD")
SECRET_KEY = os.environ.get("SECRET_KEY")
if not APP_PASSWORD or not SECRET_KEY:
    raise RuntimeError(
        "Imposta le variabili d'ambiente APP_PASSWORD e SECRET_KEY (vedi .env.example)."
    )
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
TOKEN_TTL_SECONDS = int(os.environ.get("TOKEN_TTL_SECONDS", 12 * 3600))
MAX_RANGE_DAYS = 366
ROME = ZoneInfo("Europe/Rome")

# --- CONNESSIONE AL MOTORE REALE ---
try:
    from app.engine import MilanChallengerEngine
    market_engine = MilanChallengerEngine()
    USE_REAL_DATA = market_engine.df is not None
    if USE_REAL_DATA:
        print("✅ Motore dati connesso. Utilizzo file listings.csv locale.")
except Exception as e:
    market_engine = None
    USE_REAL_DATA = False
    print(f"⚠️ Impossibile caricare engine.py. Errore: {e}")

app = FastAPI(title="ChallengerHouse API", version="10.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- AUTENTICAZIONE: token firmato HMAC con scadenza ---
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _sign(body: str) -> str:
    return _b64(hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())


def create_token() -> str:
    body = _b64(json.dumps({"exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode())
    return f"{body}.{_sign(body)}"


def token_is_valid(token: str) -> bool:
    try:
        body, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(body)):
            return False
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        return int(payload["exp"]) > time.time()
    except Exception:
        return False


def require_auth(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer ") \
            or not token_is_valid(authorization[7:]):
        raise HTTPException(status_code=401, detail="Non autorizzato")


# --- RATE LIMIT sui tentativi di login falliti (in memoria, per IP) ---
LOGIN_MAX_FAILS = 5
LOGIN_WINDOW_SECONDS = 300
_failed_logins = defaultdict(deque)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class AuthRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


@app.post("/api/auth")
def login(payload: AuthRequest, request: Request):
    ip = _client_ip(request)
    now = time.time()
    fails = _failed_logins[ip]
    while fails and now - fails[0] > LOGIN_WINDOW_SECONDS:
        fails.popleft()
    if len(fails) >= LOGIN_MAX_FAILS:
        raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra qualche minuto.")

    if hmac.compare_digest(payload.password.encode(), APP_PASSWORD.encode()):
        fails.clear()
        return {"status": "ok", "token": create_token(), "expires_in": TOKEN_TTL_SECONDS}

    fails.append(now)
    raise HTTPException(status_code=401, detail="Password errata")


@app.get("/api/neighbourhoods", dependencies=[Depends(require_auth)])
def get_neighbourhoods():
    if USE_REAL_DATA and market_engine:
        return {"neighbourhoods": market_engine.get_all_neighbourhoods()}
    return {"neighbourhoods": ["Nessun dato CSV disponibile"]}

# --- SCUDO DI EMERGENZA AGGIORNATO ---
def get_synthetic_market_median(neighbourhood: str, max_guests: int) -> float:
    premium = {"Duomo": 205, "Brera": 195, "Garibaldi": 180, "Navigli": 160, "CityLife": 165}
    high = {"Centrale": 130, "Porta Venezia": 140, "Ticinese": 145, "Tortona": 145, "Porta Romana": 140, "Sempione": 130, "Fiera": 125, "Gioia": 130}
    base_m = 100 
    
    for k, v in premium.items():
        if k.lower() in neighbourhood.lower(): base_m = v
    for k, v in high.items():
        if k.lower() in neighbourhood.lower(): base_m = v
        
    capacity_premium = (max_guests - 2) * 15 if max_guests > 2 else 0
    return float(base_m + capacity_premium)

def calculate_single_night(target_date_str, base_price, floor_price, champion_price, neighbourhood, max_guests, extra_guest_fee, daily_extra_fee, guests):
    dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    day_of_week = dt.strftime("%A")
    is_weekend = dt.weekday() >= 4 
    multiplier = 1.0
    active_event = None
    today = datetime.now(ROME).date()
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
        "11-01": ("Ognissanti", 1.30), "12-07": ("Sant'Ambrogio", 1.50),
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
        ("2026-04-21", "2026-04-26", "Salone del Mobile 2026", 2.30),
        ("2026-06-19", "2026-06-23", "Fashion Week Uomo", 1.50),
        ("2026-09-04", "2026-09-06", "GP Monza", 1.30),
        ("2026-09-22", "2026-09-28", "Fashion Week Donna", 1.60),
        ("2026-11-03", "2026-11-08", "EICMA 2026", 1.25),
        ("2026-11-27", "2026-11-29", "Milano Games Week", 1.20),
        ("2026-12-05", "2026-12-13", "Artigiano in Fiera", 1.25),
        ("2027-01-15", "2027-01-19", "Fashion Week Uomo", 1.50),
        ("2027-02-23", "2027-03-01", "Fashion Week Donna", 1.60),
        ("2027-04-13", "2027-04-18", "Salone del Mobile 2027", 2.30),
        ("2027-06-18", "2027-06-22", "Fashion Week Uomo", 1.50),
        ("2027-09-03", "2027-09-05", "GP Monza", 1.30),
        ("2027-09-21", "2027-09-27", "Fashion Week Donna", 1.60),
        ("2027-11-09", "2027-11-14", "EICMA 2027", 1.25),
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
    
    # 1. Prezzo puro in base alla tua strategia (Stagionalità + Eventi)
    user_raw_price = seasonal_base_price * total_multiplier

    # 2. Ottieni la mediana del Mercato Reale (con numero di comparabili e affidabilità)
    market_median = 0.0
    market_n = 0
    market_scope = "sintetico"
    market_reliable = False
    market_p25 = market_p75 = 0.0
    occ_mean = occ_p25 = occ_p75 = None
    if USE_REAL_DATA:
        try:
            stats = market_engine.get_market_stats(neighbourhood, max_guests)
            market_n, market_scope, market_reliable = stats["n"], stats["scope"], stats["reliable"]
            market_p25, market_p75 = stats["p25"], stats["p75"]
            occ_mean, occ_p25, occ_p75 = stats["occ_mean"], stats["occ_p25"], stats["occ_p75"]
            # Con troppo pochi comparabili il mercato non entra nel blend
            market_median = stats["median"] if market_reliable else 0.0
        except Exception as e:
            market_median = get_synthetic_market_median(neighbourhood, max_guests)
            market_scope = f"sintetico ({e})"
    else:
        market_median = get_synthetic_market_median(neighbourhood, max_guests)

    # Anche il mercato si alza durante gli eventi
    if multiplier > 1.0 and market_median > 0:
        market_median *= (multiplier - 0.1)

    # 3. GRAVITÀ DI MERCATO: Il prezzo suggerito è una fusione (50/50) tra le tue regole e il mercato locale
    if market_median > 0:
        blended_price = (user_raw_price + market_median) / 2
    else:
        blended_price = user_raw_price
    
    # 4. Aggiungi i costi extra fissi (ospiti aggiuntivi e fee giornaliera)
    if guests > 2:
        extra_people = guests - 2
        blended_price += (extra_people * extra_guest_fee)

    blended_price += daily_extra_fee
    
    # 5. Applica il pavimento (Floor Price) di sicurezza
    final_challenger_price = max(floor_price, blended_price)

    delta = round(final_challenger_price - champion_price, 2)

    return {
        "date": target_date_str,
        "day_of_week": day_of_week,
        "challenger_price": round(final_challenger_price, 2),
        "champion_price": round(champion_price, 2),
        "market_median": round(market_median, 2),
        "market_sample_count": market_n,
        "market_scope": market_scope,
        "market_reliable": market_reliable,
        "market_p25": round(market_p25, 2),
        "market_p75": round(market_p75, 2),
        "market_occupancy_pct": occ_mean if market_reliable else None,
        "market_occupancy_p25": occ_p25 if market_reliable else None,
        "market_occupancy_p75": occ_p75 if market_reliable else None,
        "active_event": active_event,
        "multiplier": round(total_multiplier, 2),
        "delta": delta
    }

@app.get("/api/pricing/calculate-range", dependencies=[Depends(require_auth)])
def calculate_pricing_range(
    start_date: str,
    end_date: str,
    base_price: float = Query(gt=0, le=10000),
    floor_price: float = Query(ge=0, le=10000),
    champion_price: float = Query(ge=0, le=10000),
    neighbourhood: str = Query(default="Centrale", min_length=1, max_length=80),
    max_guests: int = Query(default=4, ge=1, le=16),
    extra_guest_fee: float = Query(default=25.0, ge=0, le=500),
    daily_extra_fee: float = Query(default=5.0, ge=0, le=500),
    guests: int = Query(default=2, ge=1, le=16),
):
    try:
        current_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido")

    if end_dt < current_dt:
        raise HTTPException(status_code=400, detail="La data di fine precede quella di inizio")
    if (end_dt - current_dt).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Intervallo massimo: {MAX_RANGE_DAYS} giorni")

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