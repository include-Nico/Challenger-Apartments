from datetime import date
from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from app.engine import MilanChallengerEngine

app = FastAPI(title="Challenger Pricing API")

# Sblocco totale CORS per lo sviluppo in locale
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = MilanChallengerEngine()

@app.get("/")
def home():
    return {"status": "online", "message": "Challenger API attiva"}

# Nuovo endpoint per la lista dinamica dei quartieri
@app.get("/api/neighbourhoods")
def list_neighbourhoods():
    return {"neighbourhoods": engine.get_available_neighbourhoods()}

@app.get("/api/pricing/calculate")
def get_pricing_recommendation(
    target_date: date = Query(..., description="Data della notte (YYYY-MM-DD)"),
    base_price: float = Query(110.0, description="Prezzo base per notte"),
    floor_price: float = Query(75.0, description="Prezzo minimo assoluto"),
    champion_price: float = Query(125.0, description="Prezzo attuale fisso"),
    neighbourhood: Optional[str] = Query("Centrale", description="Quartiere di riferimento"),
    max_guests: int = Query(2, description="Posti letto standard"),
    extra_guest_fee: float = Query(25.0, description="Tariffa per ogni ospite extra"),
    daily_extra_fee: float = Query(0.0, description="Costi aggiuntivi giornalieri"),
    guests: Optional[int] = Query(None, description="Numero ospiti selezionati")
):
    return engine.calculate_price(
        target_date=target_date,
        base_price=base_price,
        floor_price=floor_price,
        champion_price=champion_price,
        neighbourhood=neighbourhood,
        max_guests=max_guests,
        extra_guest_fee=extra_guest_fee,
        daily_extra_fee=daily_extra_fee,
        num_guests=guests
    )