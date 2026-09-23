import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend 
} from 'recharts';
import { 
  Home, Sparkles, Calendar, ArrowUpRight, 
  Layers, Calculator, MapPin, AlertCircle, Users, Bell, 
  ChevronDown, ChevronUp, Check, Wallet, Info, Lock, 
  Unlock, Copy, MessageCircle
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const loadSavedState = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export default function App() {
  // SISTEMA DI SICUREZZA COLLEGATO AL BACKEND
  const [isAuthenticated, setIsAuthenticated] = useState(() => loadSavedState('challenger_auth', false));
  const [pinInput, setPinInput] = useState('');

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });

      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        alert("PIN errato. Accesso negato.");
        setPinInput('');
      }
    } catch (err) {
      alert("Errore di connessione. Assicurati che il backend su Render sia online.");
    }
  };

  // SPLASH SCREEN
  const [splashFinished, setSplashFinished] = useState(false);
  const [splashFading, setSplashFading] = useState(false);

  const explosionParticles = useMemo(() => {
    return Array.from({ length: 36 }).map((_, i) => {
      const angle = (i * (360 / 36)) + (Math.random() * 15 - 7.5);
      const velocity = 150 + Math.random() * 300;
      const tx = Math.cos(angle * Math.PI / 180) * velocity;
      const ty = Math.sin(angle * Math.PI / 180) * velocity;
      const rX = Math.random() * 1440 - 720;
      const rY = Math.random() * 1440 - 720;
      const rZ = Math.random() * 1440 - 720;
      const delay = 1.6 + (Math.random() * 0.15);
      const scale = 0.8 + Math.random() * 1.5;
      const emojis = ['💶', '💰', '💸', '🪙', '✨', '💎', '💳'];
      const symbol = emojis[Math.floor(Math.random() * emojis.length)];
      return { tx: `${tx}px`, ty: `${ty}px`, rX: `${rX}deg`, rY: `${rY}deg`, rZ: `${rZ}deg`, delay: `${delay}s`, scale, symbol };
    });
  }, []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2800);
    const finishTimer = setTimeout(() => setSplashFinished(true), 3300);
    return () => { clearTimeout(fadeTimer); clearTimeout(finishTimer); };
  }, []);

  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getFutureISO = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [activeTab, setActiveTab] = useState(() => loadSavedState('challenger_activeTab', 'listing'));
  const [listingHorizonDays, setListingHorizonDays] = useState(() => loadSavedState('challenger_horizon', 30));
  const [otaRate, setOtaRate] = useState(() => loadSavedState('challenger_otaRate', 15));
  
  // STATO SINGOLO APPARTAMENTO - INIZIALMENTE VUOTO
  const [apartment, setApartment] = useState(() => loadSavedState('challenger_apartment', {
    name: "Il Mio Appartamento",
    neighbourhood: "",
    basePrice: "",
    championPrice: "",
    floorPrice: "",
    guests: "",
    maxGuests: "",
    extraGuestFee: "",
    fixedExtraFee: "",   
    dailyExtraFee: ""
  }));

  // CONTROLLO BLOCCO FORM: L'array ora controlla i campi essenziali
  const requiredFields = ['neighbourhood', 'basePrice', 'championPrice', 'floorPrice', 'guests', 'maxGuests', 'extraGuestFee', 'fixedExtraFee', 'dailyExtraFee'];
  const isConfigComplete = requiredFields.every(key => apartment[key] !== "");

  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [hasViewedEvents, setHasViewedEvents] = useState(false);
  const [quoteDates, setQuoteDates] = useState({ startDate: getTodayISO(), endDate: getFutureISO(3) });

  const [allNeighbourhoods, setAllNeighbourhoods] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const autocompleteRef = useRef(null);
  const eventsRef = useRef(null);

  const [rawPricingData, setRawPricingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(false);

  useEffect(() => { localStorage.setItem('challenger_auth', JSON.stringify(isAuthenticated)); }, [isAuthenticated]);
  useEffect(() => { localStorage.setItem('challenger_activeTab', JSON.stringify(activeTab)); }, [activeTab]);
  useEffect(() => { localStorage.setItem('challenger_horizon', JSON.stringify(listingHorizonDays)); }, [listingHorizonDays]);
  useEffect(() => { localStorage.setItem('challenger_otaRate', JSON.stringify(otaRate)); }, [otaRate]);
  useEffect(() => { localStorage.setItem('challenger_apartment', JSON.stringify(apartment)); }, [apartment]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchNeighbourhoods = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/neighbourhoods`);
        if (res.ok) setAllNeighbourhoods((await res.json()).neighbourhoods || []);
      } catch (e) { console.warn("API Quartieri non raggiungibile"); }
    };
    fetchNeighbourhoods();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) setShowSuggestions(false);
      if (eventsRef.current && !eventsRef.current.contains(e.target)) setIsEventsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // FIX: Funzione di salvataggio numeri corretta
  const handleNumChange = (field, value) => {
    const val = value === '' ? '' : Number(value);
    setApartment(prev => ({ ...prev, [field]: val }));
  };

  const handleNeighbourhoodChange = (val) => {
    setApartment(prev => ({ ...prev, neighbourhood: val }));
    if (val.trim().length > 0) {
      const query = val.toLowerCase();
      const matches = allNeighbourhoods.filter(n => n.toLowerCase().includes(query));
      setFilteredSuggestions(matches.slice(0, 8));
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const fetchPricing = async () => {
    if (!isAuthenticated || !isConfigComplete) { setRawPricingData([]); return; }
    setLoading(true); setServerError(false);
    const results = [];
    try {
      if (activeTab === 'listing') {
        const today = new Date();
        for (let i = 0; i < listingHorizonDays; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const url = `${API_BASE_URL}/api/pricing/calculate?target_date=${dateStr}&base_price=${apartment.basePrice}&floor_price=${apartment.floorPrice}&champion_price=${apartment.championPrice}&neighbourhood=${encodeURIComponent(apartment.neighbourhood)}&max_guests=${apartment.maxGuests}&extra_guest_fee=${apartment.extraGuestFee}&daily_extra_fee=${apartment.dailyExtraFee}&guests=${Math.max(1, apartment.guests)}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Server Error");
          results.push(await res.json());
        }
      } else {
        const start = new Date(quoteDates.startDate); const end = new Date(quoteDates.endDate);
        const cur = new Date(start);
        while (cur < end) {
          const dateStr = cur.toISOString().split('T')[0];
          const url = `${API_BASE_URL}/api/pricing/calculate?target_date=${dateStr}&base_price=${apartment.basePrice}&floor_price=${apartment.floorPrice}&champion_price=${apartment.championPrice}&neighbourhood=${encodeURIComponent(apartment.neighbourhood)}&max_guests=${apartment.maxGuests}&extra_guest_fee=${apartment.extraGuestFee}&daily_extra_fee=${apartment.dailyExtraFee}&guests=${Math.max(1, apartment.guests)}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Server Error");
          results.push(await res.json());
          cur.setDate(cur.getDate() + 1);
        }
      }
      setRawPricingData(results);
    } catch (err) { setServerError(true); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => { fetchPricing(); }, 350);
    return () => clearTimeout(timer);
  }, [activeTab, listingHorizonDays, quoteDates, apartment, isConfigComplete, isAuthenticated]);

  const totalDays = rawPricingData.length;
  const cleaningAmortizedPerNight = totalDays > 0 ? (apartment.fixedExtraFee / totalDays) : 0;

  const pricingData = rawPricingData.map(row => {
    const effChallenger = row.challenger_price + cleaningAmortizedPerNight;
    const effChampion = row.champion_price + cleaningAmortizedPerNight;
    return {
      ...row,
      eff_challenger: Number(effChallenger.toFixed(2)),
      eff_champion: Number(effChampion.toFixed(2)),
      eff_price_per_person: Number((effChallenger / Math.max(1, apartment.guests)).toFixed(2))
    };
  });

  const currentRec = pricingData[0] || {};
  const totalChallengerStay = pricingData.reduce((acc, curr) => acc + curr.eff_challenger, 0);
  const totalChampionStay = pricingData.reduce((acc, curr) => acc + curr.eff_champion, 0);
  const deltaRevenue = totalChallengerStay - totalChampionStay;
  const perPersonTotal = apartment.guests > 0 ? (totalChallengerStay / apartment.guests) : totalChallengerStay;
  const currentMarketComp = currentRec.market_median || 0;
  const challengerCommission = totalChallengerStay * (otaRate / 100);
  const challengerNet = totalChallengerStay - challengerCommission;

  const upcomingEvents = pricingData.filter(row => row.active_event).reduce((acc, row) => {
    if (!acc.some(e => e.name === row.active_event)) acc.push({ name: row.active_event, firstDate: row.date, multiplier: row.multiplier });
    return acc;
  }, []);

  useEffect(() => { if (upcomingEvents.length > 0) setHasViewedEvents(false); }, [upcomingEvents.length]);
  const toggleEventsMenu = () => { setIsEventsOpen(!isEventsOpen); if (!isEventsOpen) setHasViewedEvents(true); };

  // TESTO GENERATORE PREVENTIVO WHATSAPP
  const quoteText = `👋 Ciao!\nEcco il preventivo per il tuo soggiorno a *${apartment.name}*.\n\n📅 Date: dal ${quoteDates.startDate} al ${quoteDates.endDate}\n👥 Ospiti: ${apartment.guests}\n🌙 Notti totali: ${totalDays}\n\n💰 *Totale: €${totalChallengerStay.toFixed(2)}*\n_(Tutte le spese e pulizie incluse)_\n\nFammi sapere se vuoi procedere con la prenotazione! 🏡`;
  const copyToClipboard = () => { navigator.clipboard.writeText(quoteText); alert("Preventivo copiato negli appunti!"); };
  const openWhatsApp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(quoteText)}`, '_blank'); };

  // STILI GLOBALI E ANIMAZIONI
  const GlobalStyles = () => (
    <style>{`
      .challenger-app-wrapper * { box-sizing: border-box !important; }
      .challenger-app-wrapper { padding: 32px; font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; min-height: 100vh; color: #0f172a; position: relative; }
      .header-layout { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
      .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; }
      .main-grid { display: grid; grid-template-columns: 380px 1fr; gap: 24px; margin-bottom: 28px; }
      .sim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; }
      .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .chart-wrapper { height: 400px; width: 100%; margin-top: 20px; position: relative; }
      @media (max-width: 768px) {
        .challenger-app-wrapper { padding: 16px; } .main-grid { grid-template-columns: 1fr; } .sim-grid { grid-template-columns: 1fr; gap: 16px; } .header-layout { flex-direction: column; align-items: flex-start; } .header-actions { width: 100%; } .tab-btn-group { width: 100%; display: flex; } .tab-btn-group button { flex: 1; justify-content: center; } .form-row { grid-template-columns: 1fr; } .chart-wrapper { height: 300px; } .date-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .events-dropdown { position: fixed !important; top: 72px !important; right: 16px !important; left: 16px !important; width: auto !important; z-index: 999999 !important; }
      }
      .pulse-notification { animation: gentlePulse 2s infinite; } @keyframes gentlePulse { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }
      .blur-locked { filter: blur(6px) grayscale(0.5); opacity: 0.6; pointer-events: none; user-select: none; transition: all 0.4s ease; } .lock-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; color: #475569; background: rgba(248, 250, 252, 0.4); }
      .lock-screen-bg { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
      .lock-box { background: #1e293b; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid #334155; box-shadow: 0 20px 40px rgba(0,0,0,0.5); width: 340px; }
      .lock-input { width: 100%; text-align: center; font-size: 32px; letter-spacing: 12px; padding: 12px; border-radius: 12px; border: 2px solid #3b82f6; background: #0f172a; color: #fff; margin: 24px 0; outline: none; }
      .epic-splash-overlay { position: fixed; inset: 0; background: radial-gradient(circle at 50% 40%, #1e3a8a 0%, #0f172a 60%, #020617 100%); z-index: 99999; display: flex; align-items: center; justify-content: center; transition: opacity 0.5s, visibility 0.5s; overflow: hidden; }
      .splash-fade-out { opacity: 0; visibility: hidden; }
      .cyber-grid { position: absolute; width: 200vw; height: 200vh; background-image: linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px); background-size: 40px 40px; transform: perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px); animation: gridMove 10s linear infinite; opacity: 0.4; } @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 0 40px; } }
      .splash-stage { position: relative; width: 100%; max-width: 400px; height: 400px; display: flex; align-items: center; justify-content: center; } .supernova-flash { position: absolute; inset: 0; background: #ffffff; z-index: 50; opacity: 0; pointer-events: none; animation: flashBang 2.5s ease-in-out forwards; } @keyframes flashBang { 0%, 63% { opacity: 0; } 65% { opacity: 1; } 75% { opacity: 0; } 100% { opacity: 0; } }
      .epic-house-container { position: relative; z-index: 30; animation: houseMasterSequence 2s forwards; } .epic-house-core { width: 110px; height: 110px; background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(147, 197, 253, 0.3); border-radius: 30px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(16px); box-shadow: inset 0 0 20px rgba(255,255,255,0.1), 0 15px 35px rgba(0,0,0,0.4); } .epic-house-glow { position: absolute; inset: -20px; background: radial-gradient(circle at center, #60a5fa 0%, transparent 70%); opacity: 0; filter: blur(20px); z-index: -1; animation: houseAura 1.6s ease-in forwards; }
      @keyframes houseMasterSequence { 0% { transform: scale(0.4) translateY(60px); opacity: 0; } 20% { transform: scale(1) translateY(0); opacity: 1; } 50% { transform: scale(1.05) translateY(-10px); } 64% { transform: scale(0.85); opacity: 1; } 65% { transform: scale(4); opacity: 0; } 100% { transform: scale(4); opacity: 0; } } @keyframes houseAura { 60% { opacity: 0.8; transform: scale(1.5); } 64% { opacity: 1; transform: scale(2); background: #fff; } 65%, 100% { opacity: 0; } }
      .shockwave { position: absolute; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.9); box-shadow: 0 0 30px #60a5fa, inset 0 0 30px #60a5fa; opacity: 0; z-index: 20; transform-origin: center; } .sw-1 { animation: wave 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) 1.29s forwards; } @keyframes wave { 0% { width: 50px; height: 50px; opacity: 1; } 100% { width: 800px; height: 800px; opacity: 0; border-width: 0; } }
      .epic-particle { position: absolute; font-size: 32px; z-index: 40; opacity: 0; animation: flyOut 1.5s forwards var(--delay); } @keyframes flyOut { 0% { opacity: 0; transform: translate(0, 0) scale(0); } 10% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(var(--scale)) rotateX(var(--rX)) rotateY(var(--rY)); } }
      .epic-title-container { position: absolute; bottom: 20px; text-align: center; width: 100%; z-index: 10; } .epic-title { font-size: 24px; font-weight: 900; letter-spacing: 2px; color: transparent; background: linear-gradient(to right, #fff, #93c5fd, #fff); background-clip: text; -webkit-background-clip: text; animation: textEntrance 2.8s forwards; opacity: 0; } .epic-subtitle { font-size: 11px; color: #60a5fa; font-weight: 600; text-transform: uppercase; margin-top: 8px; opacity: 0; animation: textEntrance 2.8s 0.2s forwards; }
      @keyframes textEntrance { 20% { opacity: 1; transform: translateY(0); filter: blur(0px); } 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }
      .metric-card { position: relative; background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; } .metric-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); }
      .styled-input, select.styled-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background-color: #ffffff; color: #0f172a; font-family: inherit; font-size: 14px; margin-top: 6px; } .styled-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); outline: none; } .helper-text { display: block; font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500; }
      .tab-btn { transition: all 0.2s; } .tab-btn:hover:not(.active-tab):not(:disabled) { background-color: #f1f5f9 !important; } .table-row { transition: background-color 0.15s; } .table-row:hover { background-color: #f8fafc !important; } .event-row:hover { background-color: #dbeafe !important; }
      .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; } .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; } .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
    `}</style>
  );

  // SCHERMATA DI BLOCCO INIZIALE
  if (!isAuthenticated && splashFinished) {
    return (
      <div className="challenger-app-wrapper">
        <GlobalStyles />
        <div className="lock-screen-bg">
          <div className="lock-box">
            <div style={{ background: 'rgba(59,130,246,0.1)', width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={40} color="#3b82f6" />
            </div>
            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0' }}>Accesso Riservato</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Inserisci il PIN per avviare l'algoritmo</p>
            <input type="password" maxLength={4} className="lock-input" value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••" />
            <button onClick={handleLogin} style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}>Sblocca Sistema</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="challenger-app-wrapper">
      <GlobalStyles />
      
      {!splashFinished && (
        <div className={`epic-splash-overlay ${splashFading ? 'splash-fade-out' : ''}`}>
          <div className="cyber-grid"></div><div className="supernova-flash"></div>
          <div className="splash-stage">
            <div className="shockwave sw-1"></div><div className="shockwave sw-2"></div><div className="shockwave sw-3"></div>
            <div className="epic-house-container"><div className="epic-house-glow"></div><div className="epic-house-core"><Home size={84} strokeWidth={2} color="#ffffff" className="house-svg" /></div></div>
            {explosionParticles.map((p, i) => (<div key={i} className="epic-particle" style={{ '--tx': p.tx, '--ty': p.ty, '--rX': p.rX, '--rY': p.rY, '--rZ': p.rZ, '--delay': p.delay, '--scale': p.scale }}>{p.symbol}</div>))}
            <div className="epic-title-container"><div className="epic-title">CHALLENGERHOUSE</div><div className="epic-subtitle">Inizializzazione Algoritmo...</div></div>
          </div>
        </div>
      )}

      {serverError && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <AlertCircle size={20} /><div><strong>Backend non raggiungibile:</strong> Controlla che Uvicorn sia acceso o Render sia online.</div>
        </div>
      )}

      {!isConfigComplete && (
        <div className="pulse-notification" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#fff', padding: '18px 24px', borderRadius: '14px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}>
          <AlertCircle size={32} strokeWidth={2.5} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Configurazione Iniziale Richiesta</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', fontWeight: '500', opacity: 0.95 }}>Compila tutti i campi della Configurazione Asset per sbloccare l'Intelligenza Artificiale.</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="header-layout">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', padding: '10px', borderRadius: '12px', color: '#fff' }}><Home size={24} /></div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>ChallengerHouse</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', fontWeight: '500', margin: '6px 0 0 0' }}>Algoritmo predittivo per affitti brevi</p>
        </div>

        <div className="header-actions">
          <div style={{ position: 'relative' }} ref={eventsRef}>
            <button onClick={toggleEventsMenu} className="tab-btn" disabled={!isConfigComplete} style={{ opacity: isConfigComplete ? 1 : 0.5, background: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: isConfigComplete ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', position: 'relative' }}>
              <Bell size={20} color="#475569" />
              {upcomingEvents.length > 0 && !hasViewedEvents && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></span>}
            </button>
            {isEventsOpen && (
              <div className="custom-scroll events-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}><h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0 }}>Eventi nel periodo ({upcomingEvents.length})</h3></div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcomingEvents.length > 0 ? upcomingEvents.map((ev, idx) => (
                    <div key={idx} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><Sparkles size={14} color="#3b82f6" /><span style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>{ev.name}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>dal {ev.firstDate.slice(5)}</span><span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>+{Math.round((ev.multiplier - 1) * 100)}%</span></div>
                    </div>
                  )) : <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Nessun evento rilevato.</p>}
                </div>
              </div>
            )}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
            <Calendar size={16} color="#2563eb" /><span>Oggi: <strong style={{ color: '#0f172a' }}>{getTodayISO()}</strong></span>
          </div>
          <div className="tab-btn-group" style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button onClick={() => setActiveTab('listing')} className={`tab-btn ${activeTab === 'listing' ? 'active-tab' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'listing' ? '#fff' : 'transparent', color: activeTab === 'listing' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'listing' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none' }}><Layers size={16} /> Listino</button>
            <button onClick={() => setActiveTab('quote')} className={`tab-btn ${activeTab === 'quote' ? 'active-tab' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'quote' ? '#fff' : 'transparent', color: activeTab === 'quote' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'quote' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none' }}><Calculator size={16} /> Preventivo</button>
          </div>
          <button onClick={() => { setIsAuthenticated(false); setPinInput(''); }} style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#ef4444' }} title="Blocca App">
            <Unlock size={20} />
          </button>
        </div>
      </header>

      {/* METRICHE */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ background: activeTab === 'quote' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#fff', color: activeTab === 'quote' ? '#fff' : '#0f172a', border: activeTab === 'quote' ? 'none' : '1px solid #e2e8f0' }}>
          {!isConfigComplete && <div className="lock-overlay"><Lock size={28} /></div>}
          <div className={!isConfigComplete ? 'blur-locked' : ''}>
            <span style={{ fontSize: '13px', color: activeTab === 'quote' ? '#e0e7ff' : '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{activeTab === 'listing' ? 'Prezzo Proposto (Oggi)' : 'Preventivo Totale'}</span>
            <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '8px', color: activeTab === 'quote' ? '#fff' : '#2563eb' }}>
              €{activeTab === 'listing' ? (currentRec.eff_challenger || '---') : totalChallengerStay.toFixed(2)}
              <span style={{ fontSize: '14px', fontWeight: '500', color: activeTab === 'quote' ? '#e0e7ff' : '#64748b' }}>{activeTab === 'listing' ? ' / notte' : ` (${totalDays || '-'} notti)`}</span>
            </div>
          </div>
        </div>
        <div className="metric-card">
          {!isConfigComplete && <div className="lock-overlay"><Lock size={28} /></div>}
          <div className={!isConfigComplete ? 'blur-locked' : ''}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Quota {apartment.guests || '-'}p</span><Users size={18} color="#2563eb" /></div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', marginTop: '8px' }}>€{activeTab === 'listing' ? (currentRec.eff_price_per_person || '---') : (isConfigComplete ? perPersonTotal.toFixed(2) : '---')}<span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>{activeTab === 'listing' ? ' / notte' : ' totale'}</span></div>
          </div>
        </div>
        <div className="metric-card">
          {!isConfigComplete && <div className="lock-overlay"><Lock size={28} /></div>}
          <div className={!isConfigComplete ? 'blur-locked' : ''}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Mediana ({apartment.neighbourhood || 'NIL'})</span>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6', marginTop: '8px' }}>€{isConfigComplete ? currentMarketComp : '---'}<span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}> / base</span></div>
          </div>
        </div>
        <div className="metric-card">
          {!isConfigComplete && <div className="lock-overlay"><Lock size={28} /></div>}
          <div className={!isConfigComplete ? 'blur-locked' : ''}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Delta vs Fisso Host</span>
            <div style={{ fontSize: '32px', fontWeight: '800', color: deltaRevenue >= 0 ? '#16a34a' : '#dc2626', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>{isConfigComplete ? (deltaRevenue >= 0 ? `+€${deltaRevenue.toFixed(2)}` : `-€${Math.abs(deltaRevenue).toFixed(2)}`) : '---'}<ArrowUpRight size={24} /></div>
          </div>
        </div>
      </div>

      <div className="main-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CONFIGURAZIONE FORM */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}><Home size={18} color="#2563eb" /> Configurazione Asset</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div><label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Nome Immobile (Per Preventivo)</label><input type="text" className="styled-input" value={apartment.name} onChange={(e) => setApartment(prev => ({ ...prev, name: e.target.value }))} placeholder="Es. Loft Navigli" /></div>

              {activeTab === 'listing' ? (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}><label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Orizzonte Calendario</label><select className="styled-input" value={listingHorizonDays} onChange={(e) => setListingHorizonDays(Number(e.target.value))}><option value={7}>Prossimi 7 giorni</option><option value={14}>Prossimi 14 giorni</option><option value={30}>Prossimi 30 giorni</option><option value={60}>Prossimi 60 giorni</option><option value={90}>Prossimi 90 giorni</option></select></div>
              ) : (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}><div className="date-inputs"><div><label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Check-in</label><input type="date" className="styled-input" value={quoteDates.startDate} onChange={(e) => setQuoteDates({ ...quoteDates, startDate: e.target.value })} /></div><div><label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Check-out</label><input type="date" className="styled-input" value={quoteDates.endDate} min={quoteDates.startDate} onChange={(e) => setQuoteDates({ ...quoteDates, endDate: e.target.value })} /></div></div></div>
              )}

              <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={16} color="#16a34a" /><label style={{ fontWeight: '700', fontSize: '13px', color: '#166534' }}>Ospiti Soggiorno</label></div><input type="number" className="styled-input" min={1} value={apartment.guests} onChange={(e) => handleNumChange('guests', e.target.value)} placeholder="Es. 2" /></div>

              <div style={{ position: 'relative' }} ref={autocompleteRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} color="#8b5cf6" /><label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Quartiere (NIL Milano)</label></div>
                <input type="text" className="styled-input" value={apartment.neighbourhood} onChange={(e) => handleNeighbourhoodChange(e.target.value)} onFocus={() => { if (apartment.neighbourhood) { const matches = allNeighbourhoods.filter(n => n.toLowerCase().includes(apartment.neighbourhood.toLowerCase())); setFilteredSuggestions(matches.slice(0, 8)); setShowSuggestions(matches.length > 0); } }} placeholder="Digita es. Navigli..." />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="custom-scroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', marginTop: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '240px', overflowY: 'auto' }}>
                    {filteredSuggestions.map((name, idx) => (
                      <div key={idx} onClick={() => { setApartment(prev => ({ ...prev, neighbourhood: name })); setShowSuggestions(false); }} style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer', borderBottom: idx !== filteredSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none' }}><span style={{ fontWeight: apartment.neighbourhood.toLowerCase() === name.toLowerCase() ? '700' : '500', color: '#1e293b' }}>{name}</span></div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-row"><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Prezzo Base (€)</label><input type="number" className="styled-input" value={apartment.basePrice} onChange={(e) => handleNumChange('basePrice', e.target.value)} placeholder="Es. 110" /></div><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Host Fisso (€)</label><input type="number" className="styled-input" value={apartment.championPrice} onChange={(e) => handleNumChange('championPrice', e.target.value)} placeholder="Es. 125" /></div></div>
              <div className="form-row"><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Minimo Floor (€)</label><input type="number" className="styled-input" value={apartment.floorPrice} onChange={(e) => handleNumChange('floorPrice', e.target.value)} placeholder="Es. 75" /></div><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Extra Notte (€)</label><input type="number" className="styled-input" value={apartment.dailyExtraFee} onChange={(e) => handleNumChange('dailyExtraFee', e.target.value)} placeholder="Es. 5" /></div></div>
              <div className="form-row"><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Capacità Max</label><input type="number" className="styled-input" value={apartment.maxGuests} onChange={(e) => handleNumChange('maxGuests', e.target.value)} placeholder="Es. 4" /></div><div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Fee Ospite Extra (€)</label><input type="number" className="styled-input" value={apartment.extraGuestFee} onChange={(e) => handleNumChange('extraGuestFee', e.target.value)} placeholder="Es. 25" /></div></div>
              <div><label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Pulizie Fisse Una Tantum (€)</label><input type="number" className="styled-input" value={apartment.fixedExtraFee} onChange={(e) => handleNumChange('fixedExtraFee', e.target.value)} placeholder="Es. 40" /></div>
            </div>
          </div>

          {/* BOX GENERATORE PREVENTIVO WHATSAPP */}
          {activeTab === 'quote' && isConfigComplete && (
            <div style={{ background: '#25d3661a', padding: '24px', borderRadius: '16px', border: '1px solid #25d3664d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><MessageCircle size={20} color="#16a34a" /><h3 style={{ fontSize: '16px', fontWeight: '800', color: '#166534', margin: 0 }}>Invia Preventivo</h3></div>
              <textarea readOnly className="styled-input custom-scroll" style={{ height: '140px', fontSize: '13px', backgroundColor: '#fff', cursor: 'text' }} value={quoteText} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button onClick={copyToClipboard} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}><Copy size={16} /> Copia Testo</button>
                <button onClick={openWhatsApp} style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px', background: '#25d366', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#fff', cursor: 'pointer' }}><MessageCircle size={16} fill="#fff" /> Invia su WhatsApp</button>
              </div>
            </div>
          )}
        </div>

        {/* GRAFICO E SIMULATORE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
          
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden', position: 'relative' }}>
            {!isConfigComplete && <div className="lock-overlay" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}><Lock size={48} color="#94a3b8" style={{ marginBottom: '16px' }} /><p style={{ fontWeight: '700', color: '#475569', fontSize: '15px' }}>Completa i campi a sinistra per sbloccare il grafico</p></div>}
            <div className={!isConfigComplete ? 'blur-locked' : ''} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Andamento vs Mercato</h2><Info size={16} color="#94a3b8" /></div>
                <div style={{ display: 'flex', gap: '10px' }}><span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>Challenger</span><span style={{ fontSize: '11px', background: '#f5f3ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>Mediana</span></div>
              </div>

              <div className="chart-wrapper">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', fontWeight: '600', fontSize: '13px' }}>Elaborazione dati in corso...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pricingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="challengerGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.20}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(d) => d ? d.slice(5) : ''} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} minTickGap={20} />
                      <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(v) => `€${v}`} tick={{ fontSize: 11, fontWeight: 500 }} dx={-10} />
                      <Tooltip 
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: '#0f172a', color: '#f8fafc', padding: '12px', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
                                <div style={{ fontWeight: '800', marginBottom: '8px', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{label} ({data.day_of_week})</div>
                                {data.active_event && <div style={{ color: '#60a5fa', marginBottom: '8px', fontWeight: '700' }}>✨ {data.active_event}</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '4px' }}><span style={{ color: '#94a3b8' }}>Tariffa:</span><strong style={{ color: '#e2e8f0' }}>€{data.challenger_price}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '4px', paddingTop: '6px', borderTop: '1px solid #334155' }}><span style={{ color: '#fff' }}>Con Pulizie:</span><strong style={{ fontSize: '14px', color: '#fff' }}>€{data.eff_challenger}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ color: '#94a3b8' }}>Mercato:</span><strong style={{ color: '#c084fc' }}>€{data.market_median}</strong></div>
                              </div>
                            );
                          } return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '600', color: '#475569' }} />
                      <Area type="monotone" dataKey="eff_challenger" name="ADR Proposto" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#challengerGradient)" dot={(props) => props.payload.active_event ? <circle key={props.cx} cx={props.cx} cy={props.cy} r={4} fill="#2563eb" stroke="#fff" strokeWidth={2} /> : <circle key={props.cx} cx={props.cx} cy={props.cy} r={0} />} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="eff_champion" name="Fisso Host" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="market_median" name="Mediana NIL" stroke="#8b5cf6" strokeDasharray="3 3" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <button onClick={() => isConfigComplete && setIsSimOpen(!isSimOpen)} className="tab-btn" disabled={!isConfigComplete} style={{ opacity: isConfigComplete ? 1 : 0.6, width: '100%', padding: '20px 24px', border: 'none', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isConfigComplete ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px' }}><Wallet size={20} color="#2563eb" /></div><h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Simulatore Payout Netto</h2></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>{!isConfigComplete && <Lock size={16} color="#94a3b8" />}{isSimOpen ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}</div>
            </button>
            {isSimOpen && isConfigComplete && (
              <div className="sim-grid" style={{ borderTop: '1px solid #e2e8f0', padding: '24px', background: '#f8fafc' }}>
                <div>
                  <label style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Seleziona Piattaforma</label>
                  <select className="styled-input" style={{ fontSize: '14px', padding: '12px' }} value={otaRate} onChange={(e) => setOtaRate(Number(e.target.value))}><option value={3}>Airbnb - Trattenuta Condivisa (~3%)</option><option value={15}>Airbnb - Solo Host (~15%)</option><option value={18}>Booking.com (~18%)</option><option value={0}>Contanti / Diretto (0%)</option></select>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '24px', borderRadius: '16px', color: '#fff', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
                  <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', opacity: 0.9, marginBottom: '16px' }}>Payout Netto</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '15px' }}><span style={{ opacity: 0.9 }}>Incasso Totale Lordo</span><span style={{ fontWeight: '700' }}>€{totalChallengerStay.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '15px' }}><span style={{ opacity: 0.9 }}>Trattenute ({otaRate}%)</span><span style={{ fontWeight: '700', color: '#fca5a5' }}>-€{challengerCommission.toFixed(2)}</span></div>
                  <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: '800', fontSize: '16px' }}>Bonifico in Entrata</span><span style={{ fontSize: '32px', fontWeight: '800' }}>€{challengerNet.toFixed(2)}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABELLA */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <button onClick={() => isConfigComplete && setIsTableOpen(!isTableOpen)} disabled={!isConfigComplete} className="tab-btn" style={{ opacity: isConfigComplete ? 1 : 0.6, width: '100%', padding: '20px 24px', border: 'none', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isConfigComplete ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
          <div><h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Analisi Notte per Notte</h2></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', background: '#eff6ff', padding: '6px 10px', borderRadius: '10px' }}>{!isConfigComplete && <Lock size={16} color="#94a3b8" />}{isTableOpen ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}</div>
        </button>
        {isTableOpen && isConfigComplete && (
          <div className="custom-scroll" style={{ borderTop: '1px solid #e2e8f0', overflowX: 'auto', maxHeight: '500px', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '14px 20px', fontWeight: '700' }}>Data</th><th style={{ padding: '14px 16px', fontWeight: '700' }}>Driver Evento</th><th style={{ padding: '14px 16px', fontWeight: '700' }}>Molt.</th><th style={{ padding: '14px 16px', fontWeight: '700' }}>Mediana</th><th style={{ padding: '14px 16px', fontWeight: '700' }}>Tariffa Pura</th><th style={{ padding: '14px 16px', fontWeight: '700', color: '#1e40af' }}>Effettiva</th><th style={{ padding: '14px 16px', fontWeight: '700' }}>Quota {apartment.guests}p</th><th style={{ padding: '14px 20px', fontWeight: '700' }}>vs Fisso</th></tr>
              </thead>
              <tbody>
                {pricingData.map((row) => {
                  const hasEvent = Boolean(row.active_event);
                  return (
                    <tr className={`table-row ${hasEvent ? 'event-row' : ''}`} key={row.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: '#1e293b' }}>{row.date.slice(5)} <span style={{ color: '#94a3b8', fontWeight: '500', fontSize: '11px' }}>({row.day_of_week.slice(0,3)})</span></td>
                      <td style={{ padding: '14px 16px' }}>{hasEvent ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><Sparkles size={12} /> {row.active_event}</span> : <span style={{ color: '#94a3b8', fontWeight: '500' }}>-</span>}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: hasEvent ? '#2563eb' : '#64748b' }}>{row.multiplier}x</td>
                      <td style={{ padding: '14px 16px', color: '#8b5cf6', fontWeight: '700' }}>€{row.market_median}</td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: '500' }}>€{row.challenger_price}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#2563eb', fontSize: '14px' }}>€{row.eff_challenger}</td>
                      <td style={{ padding: '14px 16px', color: '#059669', fontWeight: '700' }}>€{row.eff_price_per_person}</td>
                      <td style={{ padding: '14px 20px', fontWeight: '800', color: row.delta >= 0 ? '#16a34a' : '#dc2626' }}>{row.delta >= 0 ? `+€${row.delta}` : `€${row.delta}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}