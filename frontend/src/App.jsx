import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend 
} from 'recharts';
import { 
  Home, TrendingUp, Sparkles, Calendar, ArrowUpRight, 
  Layers, Calculator, MapPin, AlertCircle, Users, Bell, 
  ChevronDown, ChevronUp, Check, Wallet, Info 
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
      
      return { 
        tx: `${tx}px`, ty: `${ty}px`, 
        rX: `${rX}deg`, rY: `${rY}deg`, rZ: `${rZ}deg`, 
        delay: `${delay}s`, scale, symbol 
      };
    });
  }, []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2800);
    const finishTimer = setTimeout(() => setSplashFinished(true), 3300);
    return () => { clearTimeout(fadeTimer); clearTimeout(finishTimer); };
  }, []);

  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getFutureISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [activeTab, setActiveTab] = useState(() => loadSavedState('challenger_activeTab', 'listing'));
  const [listingHorizonDays, setListingHorizonDays] = useState(() => loadSavedState('challenger_horizon', 30));
  const [otaRate, setOtaRate] = useState(() => loadSavedState('challenger_otaRate', 15));
  
  const [apartment, setApartment] = useState(() => loadSavedState('challenger_apartment', {
    name: "Appartamento Milano",
    neighbourhood: "Centrale",
    basePrice: 110,
    championPrice: 125,
    floorPrice: 75,
    guests: 2,
    maxGuests: 4,
    extraGuestFee: 25,
    fixedExtraFee: 40,   
    dailyExtraFee: 5,    
  }));

  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [hasViewedEvents, setHasViewedEvents] = useState(false);
  
  const [quoteDates, setQuoteDates] = useState({
    startDate: getTodayISO(),
    endDate: getFutureISO(3),
  });

  const [allNeighbourhoods, setAllNeighbourhoods] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const autocompleteRef = useRef(null);
  const eventsRef = useRef(null);

  const [rawPricingData, setRawPricingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(false);

  useEffect(() => { localStorage.setItem('challenger_activeTab', JSON.stringify(activeTab)); }, [activeTab]);
  useEffect(() => { localStorage.setItem('challenger_horizon', JSON.stringify(listingHorizonDays)); }, [listingHorizonDays]);
  useEffect(() => { localStorage.setItem('challenger_otaRate', JSON.stringify(otaRate)); }, [otaRate]);
  useEffect(() => { localStorage.setItem('challenger_apartment', JSON.stringify(apartment)); }, [apartment]);

  useEffect(() => {
    const fetchNeighbourhoods = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/neighbourhoods`);
        if (res.ok) {
          const data = await res.json();
          setAllNeighbourhoods(data.neighbourhoods || []);
        }
      } catch (e) {
        console.warn("API Quartieri non raggiungibile");
      }
    };
    fetchNeighbourhoods();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) setShowSuggestions(false);
      if (eventsRef.current && !eventsRef.current.contains(event.target)) setIsEventsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNeighbourhoodChange = (val) => {
    setApartment({ ...apartment, neighbourhood: val });
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

  const handleNumChange = (field, value) => {
    const num = value === '' ? 0 : Number(value);
    setApartment(prev => ({ ...prev, [field]: num }));
  };

  const fetchPricing = async () => {
    setLoading(true);
    setServerError(false);
    const results = [];

    try {
      if (activeTab === 'listing') {
        const today = new Date();
        for (let i = 0; i < listingHorizonDays; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const url = `${API_BASE_URL}/api/pricing/calculate?target_date=${dateStr}&base_price=${apartment.basePrice}&floor_price=${apartment.floorPrice}&champion_price=${apartment.championPrice}&neighbourhood=${encodeURIComponent(apartment.neighbourhood)}&max_guests=${apartment.maxGuests}&extra_guest_fee=${apartment.extraGuestFee}&daily_extra_fee=${apartment.dailyExtraFee}&guests=${Math.max(1, apartment.guests)}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Server Error");
          results.push(await res.json());
        }
      } else {
        const start = new Date(quoteDates.startDate);
        const end = new Date(quoteDates.endDate);
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
    } catch (err) {
      setServerError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { fetchPricing(); }, 350);
    return () => clearTimeout(timer);
  }, [activeTab, listingHorizonDays, quoteDates, apartment]);

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
  const currentMarketComp = currentRec.market_median || 115;
  const challengerCommission = totalChallengerStay * (otaRate / 100);
  const challengerNet = totalChallengerStay - challengerCommission;

  const upcomingEvents = pricingData
    .filter(row => row.active_event)
    .reduce((acc, row) => {
      if (!acc.some(e => e.name === row.active_event)) {
        acc.push({ name: row.active_event, firstDate: row.date, multiplier: row.multiplier });
      }
      return acc;
    }, []);

  const eventNamesString = upcomingEvents.map(e => e.name).join(',');
  useEffect(() => {
    if (upcomingEvents.length > 0) setHasViewedEvents(false);
  }, [eventNamesString]);

  const toggleEventsMenu = () => {
    setIsEventsOpen(!isEventsOpen);
    if (!isEventsOpen) setHasViewedEvents(true);
  };

  return (
    <div className="challenger-app-wrapper" style={{ padding: '32px', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a', position: 'relative' }}>
      
      {!splashFinished && (
        <div className={`epic-splash-overlay ${splashFading ? 'splash-fade-out' : ''}`}>
          <div className="cyber-grid"></div>
          <div className="supernova-flash"></div>
          <div className="splash-stage">
            <div className="shockwave sw-1"></div>
            <div className="shockwave sw-2"></div>
            <div className="shockwave sw-3"></div>
            <div className="epic-house-container">
              <div className="epic-house-glow"></div>
              <div className="epic-house-core">
                <Home size={84} strokeWidth={2} color="#ffffff" className="house-svg" />
              </div>
            </div>
            {explosionParticles.map((p, index) => (
              <div key={index} className="epic-particle" style={{ '--tx': p.tx, '--ty': p.ty, '--rX': p.rX, '--rY': p.rY, '--rZ': p.rZ, '--delay': p.delay, '--scale': p.scale }}>
                {p.symbol}
              </div>
            ))}
            <div className="epic-title-container">
              <div className="epic-title">CHALLENGER PRICING</div>
              <div className="epic-subtitle">Inizializzazione Algoritmo...</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .challenger-app-wrapper * { box-sizing: border-box !important; }
        .epic-splash-overlay { position: fixed; inset: 0; background: radial-gradient(circle at 50% 40%, #1e3a8a 0%, #0f172a 60%, #020617 100%); z-index: 99999; display: flex; align-items: center; justify-content: center; transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.5s; overflow: hidden; }
        .splash-fade-out { opacity: 0; visibility: hidden; pointer-events: none; }
        .cyber-grid { position: absolute; width: 200vw; height: 200vh; background-image: linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px); background-size: 40px 40px; transform: perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px); animation: gridMove 10s linear infinite; opacity: 0.4; }
        @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 0 40px; } }
        .splash-stage { position: relative; width: 400px; height: 400px; display: flex; align-items: center; justify-content: center; perspective: 1000px; }
        .supernova-flash { position: absolute; inset: 0; background: #ffffff; z-index: 50; opacity: 0; pointer-events: none; animation: flashBang 2.5s ease-in-out forwards; }
        @keyframes flashBang { 0%, 63% { opacity: 0; } 65% { opacity: 1; } 75% { opacity: 0; } 100% { opacity: 0; } }
        .epic-house-container { position: relative; z-index: 30; animation: houseMasterSequence 2s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .epic-house-core { position: relative; width: 110px; height: 110px; background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(147, 197, 253, 0.3); border-radius: 30px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(16px); box-shadow: inset 0 0 20px rgba(255,255,255,0.1), 0 15px 35px rgba(0,0,0,0.4); overflow: hidden; }
        .epic-house-glow { position: absolute; inset: -20px; background: radial-gradient(circle at center, #60a5fa 0%, transparent 70%); opacity: 0; filter: blur(20px); z-index: -1; animation: houseAura 1.6s ease-in forwards; }
        .house-svg { filter: drop-shadow(0 0 10px rgba(255,255,255,0.8)); animation: svgPulse 1.6s ease-in forwards; }
        @keyframes houseMasterSequence { 0% { transform: scale(0.4) translateY(60px); opacity: 0; } 20% { transform: scale(1) translateY(0); opacity: 1; } 50% { transform: scale(1.05) translateY(-10px); } 55% { transform: scale(1.05) translateY(-10px) translateX(-4px) rotate(-3deg); } 58% { transform: scale(1.05) translateY(-10px) translateX(4px) rotate(3deg); } 61% { transform: scale(1.05) translateY(-10px) translateX(-4px) rotate(-3deg); } 63% { transform: scale(1.05) translateY(-10px) translateX(4px) rotate(3deg); } 64% { transform: scale(0.85); opacity: 1; } 65% { transform: scale(4); opacity: 0; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes houseAura { 0%, 30% { opacity: 0; } 60% { opacity: 0.8; transform: scale(1.5); } 64% { opacity: 1; transform: scale(2); background: radial-gradient(circle at center, #ffffff 0%, transparent 70%); } 65%, 100% { opacity: 0; } }
        @keyframes svgPulse { 0%, 40% { filter: drop-shadow(0 0 5px rgba(255,255,255,0.4)); } 64% { filter: drop-shadow(0 0 30px #ffffff) brightness(2); } }
        .shockwave { position: absolute; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.9); box-shadow: 0 0 30px #60a5fa, inset 0 0 30px #60a5fa; opacity: 0; pointer-events: none; z-index: 20; transform-origin: center; }
        .sw-1 { animation: wave 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) 1.29s forwards; }
        .sw-2 { border-width: 6px; border-color: #93c5fd; box-shadow: none; filter: blur(4px); animation: wave 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) 1.33s forwards; }
        .sw-3 { border-width: 1px; border-color: #ffffff; animation: wave 1.5s cubic-bezier(0.1, 0.8, 0.2, 1) 1.38s forwards; }
        @keyframes wave { 0% { width: 50px; height: 50px; opacity: 1; } 100% { width: 800px; height: 800px; opacity: 0; border-width: 0; } }
        .epic-particle { position: absolute; font-size: 32px; z-index: 40; opacity: 0; pointer-events: none; transform-style: preserve-3d; animation: flyOut 1.5s cubic-bezier(0.1, 0.9, 0.2, 1) var(--delay) forwards; }
        @keyframes flyOut { 0% { opacity: 0; transform: translate(0, 0) scale(0) rotate3d(0,0,0,0deg); filter: drop-shadow(0 0 20px #fbbf24) brightness(3); } 10% { opacity: 1; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5)) brightness(1); } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(var(--scale)) rotateX(var(--rX)) rotateY(var(--rY)) rotateZ(var(--rZ)); } }
        .epic-title-container { position: absolute; bottom: 20px; text-align: center; width: 100%; z-index: 10; }
        .epic-title { font-size: 28px; font-weight: 900; letter-spacing: 4px; color: transparent; background: linear-gradient(to right, #fff, #93c5fd, #fff); background-size: 200% auto; background-clip: text; -webkit-background-clip: text; animation: textShine 2s linear infinite, textEntrance 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; opacity: 0; transform: translateY(20px); }
        .epic-subtitle { font-size: 13px; color: #60a5fa; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-top: 8px; opacity: 0; animation: textEntrance 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s forwards; }
        @keyframes textShine { to { background-position: 200% center; } }
        @keyframes textEntrance { 0% { opacity: 0; transform: translateY(20px); filter: blur(10px); } 20% { opacity: 1; transform: translateY(0); filter: blur(0px); } 80% { opacity: 1; transform: translateY(0); filter: blur(0px); } 100% { opacity: 0; transform: translateY(-20px); filter: blur(10px); } }
        
        .metric-card { transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .metric-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04); }
        .styled-input, select.styled-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background-color: #ffffff !important; color: #0f172a !important; outline: none; font-family: inherit; font-size: 14px; margin-top: 6px; }
        .styled-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
        .helper-text { display: block; font-size: 11px; color: #64748b; margin-top: 5px; line-height: 1.3; font-weight: 500; }
        .tab-btn { transition: all 0.2s ease; }
        .tab-btn:hover:not(.active-tab) { background-color: #f1f5f9 !important; }
        .table-row { transition: background-color 0.15s ease; }
        .table-row:hover { background-color: #f8fafc !important; }
        .event-row:hover { background-color: #dbeafe !important; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
      `}</style>

      {serverError && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <AlertCircle size={20} />
          <div><strong>Backend non raggiungibile:</strong> Impossibile contattare <code>{API_BASE_URL}</code>.</div>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', padding: '10px', borderRadius: '12px', color: '#fff' }}>
              <TrendingUp size={24} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>Challenger Pricing</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', fontWeight: '500', margin: '6px 0 0 0' }}>
            Algoritmo predittivo per affitti brevi su base mercato ed eventi
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }} ref={eventsRef}>
            <button onClick={toggleEventsMenu} className="tab-btn" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <Bell size={20} color="#475569" />
              {upcomingEvents.length > 0 && !hasViewedEvents && (
                <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></span>
              )}
            </button>
            {isEventsOpen && (
              <div className="custom-scroll" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '320px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Eventi nel periodo ({upcomingEvents.length})</h3>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((ev, idx) => (
                      <div key={idx} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <Sparkles size={14} color="#3b82f6" />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>{ev.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>dal {ev.firstDate.slice(5)}</span>
                          <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>+{Math.round((ev.multiplier - 1) * 100)}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, textAlign: 'center' }}>Nessun evento rilevato nelle date correnti.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="#2563eb" />
            <span>Oggi: <strong style={{ color: '#0f172a' }}>{getTodayISO()}</strong></span>
          </div>

          <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button onClick={() => setActiveTab('listing')} className={`tab-btn ${activeTab === 'listing' ? 'active-tab' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'listing' ? '#fff' : 'transparent', color: activeTab === 'listing' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'listing' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none' }}>
              <Layers size={16} /> Imposta Listino
            </button>
            <button onClick={() => setActiveTab('quote')} className={`tab-btn ${activeTab === 'quote' ? 'active-tab' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'quote' ? '#fff' : 'transparent', color: activeTab === 'quote' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'quote' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none' }}>
              <Calculator size={16} /> Preventivo Ospiti
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="metric-card" style={{ background: activeTab === 'quote' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#fff', color: activeTab === 'quote' ? '#fff' : '#0f172a', padding: '24px', borderRadius: '16px', border: activeTab === 'quote' ? 'none' : '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: activeTab === 'quote' ? '#e0e7ff' : '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {activeTab === 'listing' ? 'Prezzo Proposto (Oggi)' : 'Preventivo Totale'}
          </span>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '8px', color: activeTab === 'quote' ? '#fff' : '#2563eb' }}>
            €{activeTab === 'listing' ? (currentRec.eff_challenger || '0.00') : totalChallengerStay.toFixed(2)}
            <span style={{ fontSize: '14px', fontWeight: '500', color: activeTab === 'quote' ? '#e0e7ff' : '#64748b' }}>
              {activeTab === 'listing' ? ' / notte (ADR)' : ` (${totalDays} notti)`}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: activeTab === 'quote' ? '#c7d2fe' : '#94a3b8', marginTop: '6px', fontWeight: '500', margin: '6px 0 0 0' }}>Il calcolo include già i {apartment.fixedExtraFee}€ di pulizie spalmate.</p>
        </div>

        <div className="metric-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quota per Persona ({apartment.guests}p)</span>
            <Users size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', marginTop: '8px' }}>
            €{activeTab === 'listing' ? (currentRec.eff_price_per_person || '0.00') : perPersonTotal.toFixed(2)}
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>{activeTab === 'listing' ? ' / notte' : ' totale'}</span>
          </div>
        </div>

        <div className="metric-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mediana Mercato ({apartment.neighbourhood})</span>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6', marginTop: '8px' }}>
            €{currentMarketComp}
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}> / notte base</span>
          </div>
          <p style={{ fontSize: '12px', color: currentRec.market_sample_count > 0 ? '#059669' : '#d97706', marginTop: '6px', fontWeight: '600', margin: '6px 0 0 0' }}>
            {currentRec.market_sample_count > 0 ? `✓ Analizzati ${currentRec.market_sample_count} annunci esatti` : `⚠️ Nessun annuncio locale`}
          </p>
        </div>

        <div className="metric-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delta vs Fisso Host</span>
          <div style={{ fontSize: '32px', fontWeight: '800', color: deltaRevenue >= 0 ? '#16a34a' : '#dc2626', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {deltaRevenue >= 0 ? `+€${deltaRevenue.toFixed(2)}` : `-€${Math.abs(deltaRevenue).toFixed(2)}`}
            <ArrowUpRight size={24} />
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '28px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <button onClick={() => setIsSimOpen(!isSimOpen)} className="tab-btn" style={{ width: '100%', padding: '20px 24px', border: 'none', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px' }}><Wallet size={20} color="#2563eb" /></div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Simulatore Payout Netto (Commissioni e OTA)</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: '500', margin: '4px 0 0 0' }}>Scopri esattamente quanto incassi pulito sul tuo conto corrente bancario</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{isSimOpen ? 'Chiudi Payout' : 'Calcola Payout'}</span>
            {isSimOpen ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
          </div>
        </button>
        
        {isSimOpen && (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'center', background: '#f8fafc' }}>
            <div>
              <label style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Seleziona la Piattaforma di Prenotazione</label>
              <select className="styled-input" style={{ fontSize: '14px', padding: '12px' }} value={otaRate} onChange={(e) => setOtaRate(Number(e.target.value))}>
                <option value={3}>Airbnb - Trattenuta Condivisa (~3%)</option>
                <option value={15}>Airbnb - Commissione Solo Host (~15%)</option>
                <option value={18}>Booking.com - Standard Milano (~18%)</option>
                <option value={8}>Vrbo / Expedia - Pay per Booking (~8%)</option>
                <option value={3}>Prenotazione Diretta via Stripe/Card (~3%)</option>
                <option value={20}>Property Manager / Agenzia (~20%)</option>
                <option value={0}>Contanti / Nessuna Trattenuta (0%)</option>
              </select>
              <span className="helper-text">Scegli la percentuale trattenuta dalla piattaforma.</span>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '24px', borderRadius: '16px', color: '#fff', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
              <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', opacity: 0.9, marginBottom: '16px' }}>Payout Netto al Proprietario</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '15px' }}>
                <span style={{ opacity: 0.9 }}>Incasso Totale Lordo</span>
                <span style={{ fontWeight: '700' }}>€{totalChallengerStay.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '15px' }}>
                <span style={{ opacity: 0.9 }}>Fattura Piattaforma OTA ({otaRate}%)</span>
                <span style={{ fontWeight: '700', color: '#fca5a5' }}>-€{challengerCommission.toFixed(2)}</span>
              </div>
              <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '16px' }}>Bonifico in Entrata (Netto)</span>
                <span style={{ fontSize: '36px', fontWeight: '800' }}>€{challengerNet.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', margin: '0 0 20px 0' }}>
            <Home size={18} color="#2563eb" /> Configurazione Asset
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeTab === 'listing' ? (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Orizzonte Calendario</label>
                <select className="styled-input" value={listingHorizonDays} onChange={(e) => setListingHorizonDays(Number(e.target.value))}>
                  <option value={7}>Prossimi 7 giorni</option>
                  <option value={14}>Prossimi 14 giorni</option>
                  <option value={30}>Prossimi 30 giorni</option>
                  <option value={60}>Prossimi 60 giorni</option>
                  <option value={90}>Prossimi 90 giorni</option>
                </select>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Check-in</label>
                  <input type="date" className="styled-input" value={quoteDates.startDate} onChange={(e) => setQuoteDates({ ...quoteDates, startDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Check-out</label>
                  <input type="date" className="styled-input" value={quoteDates.endDate} min={quoteDates.startDate} onChange={(e) => setQuoteDates({ ...quoteDates, endDate: e.target.value })} />
                </div>
              </div>
            )}

            <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#16a34a" />
                <label style={{ fontWeight: '700', fontSize: '13px', color: '#166534' }}>Ospiti nel Preventivo</label>
              </div>
              <input type="number" className="styled-input" min={1} max={apartment.maxGuests} value={apartment.guests} onChange={(e) => handleNumChange('guests', e.target.value)} />
            </div>

            <div style={{ position: 'relative' }} ref={autocompleteRef}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#8b5cf6" />
                <label style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>Quartiere (NIL Milano)</label>
              </div>
              <input type="text" className="styled-input" value={apartment.neighbourhood} onChange={(e) => handleNeighbourhoodChange(e.target.value)} onFocus={() => { if (apartment.neighbourhood) { const matches = allNeighbourhoods.filter(n => n.toLowerCase().includes(apartment.neighbourhood.toLowerCase())); setFilteredSuggestions(matches.slice(0, 8)); setShowSuggestions(matches.length > 0); } }} placeholder="Digita es. Navigli..." />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="custom-scroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', marginTop: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredSuggestions.map((name, idx) => (
                    <div key={idx} onClick={() => { setApartment({ ...apartment, neighbourhood: name }); setShowSuggestions(false); }} style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: idx !== filteredSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <span style={{ fontWeight: apartment.neighbourhood.toLowerCase() === name.toLowerCase() ? '700' : '500', color: '#1e293b' }}>{name}</span>
                      {apartment.neighbourhood.toLowerCase() === name.toLowerCase() && <Check size={16} color="#2563eb" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Prezzo Base (€)</label>
                <input type="number" className="styled-input" value={apartment.basePrice} onChange={(e) => handleNumChange('basePrice', e.target.value)} />
              </div>
              <div>
                <label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Host Fisso (€)</label>
                <input type="number" className="styled-input" value={apartment.championPrice} onChange={(e) => handleNumChange('championPrice', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Minimo Floor (€)</label>
                <input type="number" className="styled-input" value={apartment.floorPrice} onChange={(e) => handleNumChange('floorPrice', e.target.value)} />
              </div>
              <div>
                <label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Extra Notte (€)</label>
                <input type="number" className="styled-input" value={apartment.dailyExtraFee} onChange={(e) => handleNumChange('dailyExtraFee', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ fontWeight: '700', fontSize: '12px', color: '#475569' }}>Pulizie Fisse (Una tantum) (€)</label>
              <input type="number" className="styled-input" value={apartment.fixedExtraFee} onChange={(e) => handleNumChange('fixedExtraFee', e.target.value)} />
            </div>

          </div>
        </div>

        <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Andamento ADR Effettivo vs Mercato</h2>
              <Info size={16} color="#94a3b8" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', fontWeight: '700' }}>Challenger</span>
              <span style={{ fontSize: '12px', background: '#f5f3ff', color: '#7c3aed', padding: '4px 10px', borderRadius: '8px', fontWeight: '700' }}>Mediana</span>
            </div>
          </div>

          <div style={{ height: '400px', width: '100%', marginTop: '20px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', fontWeight: '600' }}>Elaborazione dati in corso...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pricingData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="challengerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.20}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(d) => d ? d.slice(5) : ''} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(v) => `€${v}`} tick={{ fontSize: 12, fontWeight: 500 }} dx={-10} />
                  <Tooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: '#0f172a', color: '#f8fafc', padding: '16px', borderRadius: '12px', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
                            <div style={{ fontWeight: '800', marginBottom: '8px', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{label} ({data.day_of_week})</div>
                            {data.active_event && <div style={{ color: '#60a5fa', marginBottom: '10px', fontWeight: '700' }}>✨ {data.active_event} ({data.multiplier}x)</div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '4px' }}><span style={{ color: '#94a3b8' }}>Tariffa Pura:</span><strong style={{ fontSize: '13px', color: '#e2e8f0' }}>€{data.challenger_price}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>+ Pulizie Spalmate:</span><strong style={{ fontSize: '13px', color: '#e2e8f0' }}>+€{cleaningAmortizedPerNight.toFixed(2)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '4px', paddingTop: '6px', borderTop: '1px solid #334155' }}><span style={{ color: '#fff' }}>ADR Effettivo:</span><strong style={{ fontSize: '15px', color: '#fff' }}>€{data.eff_challenger}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ color: '#94a3b8' }}>Mediana Mercato:</span><strong style={{ color: '#c084fc' }}>€{data.market_median}</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: '600', color: '#475569' }} />
                  <Area type="monotone" dataKey="eff_challenger" name="ADR Effettivo Proposto" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#challengerGradient)" dot={(props) => props.payload.active_event ? <circle key={props.cx} cx={props.cx} cy={props.cy} r={5} fill="#2563eb" stroke="#fff" strokeWidth={2} /> : <circle key={props.cx} cx={props.cx} cy={props.cy} r={0} />} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="eff_champion" name="Fisso Host Effettivo" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="market_median" name="Mediana Concorrenti" stroke="#8b5cf6" strokeDasharray="3 3" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <button onClick={() => setIsTableOpen(!isTableOpen)} className="tab-btn" style={{ width: '100%', padding: '20px 28px', border: 'none', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Breakdown Analitico (Notte per Notte)</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', background: '#eff6ff', padding: '8px 12px', borderRadius: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{isTableOpen ? 'Chiudi' : 'Apri'}</span>
            {isTableOpen ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
          </div>
        </button>
        
        {isTableOpen && (
          <div className="custom-scroll" style={{ borderTop: '1px solid #e2e8f0', overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 28px', fontWeight: '700' }}>Data</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Driver Evento</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Molt.</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Mediana</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Tariffa Pura</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700', color: '#1e40af' }}>Tariffa Effettiva</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Quota {apartment.guests}p</th>
                  <th style={{ padding: '14px 28px', fontWeight: '700' }}>Delta vs Fisso</th>
                </tr>
              </thead>
              <tbody>
                {pricingData.map((row) => {
                  const hasEvent = Boolean(row.active_event);
                  return (
                    <tr className={`table-row ${hasEvent ? 'event-row' : ''}`} key={row.date} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: hasEvent ? 'rgba(239, 246, 255, 0.4)' : 'transparent' }}>
                      <td style={{ padding: '14px 28px', fontWeight: '700', color: '#1e293b' }}>{row.date} <span style={{ color: '#94a3b8', fontWeight: '500' }}>({row.day_of_week})</span></td>
                      <td style={{ padding: '14px 16px' }}>{hasEvent ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sparkles size={14} /> {row.active_event}</span> : <span style={{ color: '#94a3b8', fontWeight: '500' }}>Standard</span>}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: hasEvent ? '#2563eb' : '#64748b' }}>{row.multiplier}x</td>
                      <td style={{ padding: '14px 16px', color: '#8b5cf6', fontWeight: '700' }}>€{row.market_median}</td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: '500' }}>€{row.challenger_price}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#2563eb', fontSize: '14px' }}>€{row.eff_challenger}</td>
                      <td style={{ padding: '14px 16px', color: '#059669', fontWeight: '700' }}>€{row.eff_price_per_person}</td>
                      <td style={{ padding: '14px 28px', fontWeight: '800', color: row.delta >= 0 ? '#16a34a' : '#dc2626' }}>{row.delta >= 0 ? `+€${row.delta}` : `€${row.delta}`}</td>
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