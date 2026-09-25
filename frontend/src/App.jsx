import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Configura qui l'URL del tuo backend Render
const API_BASE = "https://challenger-apartments-api.onrender.com";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');

  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0],
    base_price: 100,
    floor_price: 60,
    champion_price: 90,
    neighbourhood: 'Centrale',
    max_guests: 4,
    guests: 2,
    extra_guest_fee: 25,
    daily_extra_fee: 5
  });

  // Gestione Login
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (response.ok) {
        setIsAuthenticated(true);
        fetchNeighbourhoods();
      } else {
        setAuthError('PIN errato. Riprova.');
      }
    } catch (error) {
      setAuthError('Errore di connessione col server.');
    }
  };

  // Caricamento Quartieri (Popolati dal CSV di Airbnb)
  const fetchNeighbourhoods = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/neighbourhoods`);
      const data = await res.json();
      if (data.neighbourhoods) {
        setNeighbourhoods(data.neighbourhoods);
        if (data.neighbourhoods.length > 0 && data.neighbourhoods[0] !== "Nessun CSV") {
          setFormData(prev => ({ ...prev, neighbourhood: data.neighbourhoods[0] }));
        }
      }
    } catch (error) {
      console.error("Errore fetch quartieri", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calcolo Prezzi
  const calculatePricing = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(formData).toString();
      const res = await fetch(`${API_BASE}/api/pricing/calculate-range?${queryParams}`);
      const data = await res.json();
      setResults(data.results);
    } catch (error) {
      console.error("Errore calcolo", error);
      alert("Errore durante il calcolo. Controlla le date.");
    }
    setLoading(false);
  };

  // --- NUOVA FUNZIONE: INDICATORE DI STRATEGIA ---
  const renderStrategyIndicator = () => {
    if (!results || results.length === 0) return null;

    let totalChallenger = 0;
    let totalMarket = 0;
    let validMarketDays = 0;

    results.forEach(day => {
      totalChallenger += day.challenger_price;
      if (day.market_median > 0) {
        totalMarket += day.market_median;
        validMarketDays++;
      }
    });

    if (validMarketDays === 0) return null;

    const avgChallenger = totalChallenger / results.length;
    const avgMarket = totalMarket / validMarketDays;
    const diffPercent = ((avgChallenger - avgMarket) / avgMarket) * 100;
    const diffFormatted = Math.abs(diffPercent).toFixed(1);

    let boxStyle = "bg-slate-800 border-blue-500 text-blue-100";
    let title = "Strategia Allineata";
    let message = `Sei in linea col mercato (diff. ${diffFormatted}%). Ottimo bilanciamento tra prezzo e probabilità di occupazione.`;

    if (diffPercent > 5) {
      boxStyle = "bg-purple-900/40 border-purple-500 text-purple-100";
      title = "Strategia Premium 👑";
      message = `Sei il ${diffFormatted}% sopra la media del quartiere. Punta tutto sulla qualità, sulle foto e sui servizi per giustificare il prezzo.`;
    } else if (diffPercent < -5) {
      boxStyle = "bg-emerald-900/40 border-emerald-500 text-emerald-100";
      title = "Strategia Volume (Aggressiva) 🚀";
      message = `Sei il ${diffFormatted}% sotto il mercato. Puntiamo al tutto esaurito rapido, massimizzando l'occupazione mensile.`;
    }

    return (
      <div className={`mt-6 p-4 border-l-4 rounded-md shadow-lg ${boxStyle}`}>
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-sm opacity-90">{message}</p>
      </div>
    );
  };

  // Schermata di Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 text-center">
          <img src="/casa_soldi_icon.png" alt="Logo" className="w-24 h-24 mx-auto mb-6 drop-shadow-lg" />
          <h1 className="text-2xl font-bold text-white mb-6">ChallengerHouse</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Inserisci il PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded text-white text-center text-xl tracking-widest focus:border-blue-500 focus:outline-none"
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors">
              Accedi
            </button>
            {authError && <p className="text-red-400 text-sm mt-2">{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  // Schermata Principale PWA
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans pb-10">
      {/* HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50 shadow-md flex items-center gap-3">
        <img src="/casa_soldi_icon.png" alt="Logo" className="w-10 h-10" />
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">ChallengerHouse</h1>
          <p className="text-xs text-blue-400">Revenue Management AI</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        
        {/* COLONNA SINISTRA: FORM CONTROLLI */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Parametri Strategia</h2>
            <form onSubmit={calculatePricing} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Inizio</label>
                  <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fine</label>
                  <input type="date" name="end_date" value={formData.end_date} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Quartiere (Dati Airbnb Reali)</label>
                <select name="neighbourhood" value={formData.neighbourhood} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                  {neighbourhoods.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Base €</label>
                  <input type="number" name="base_price" value={formData.base_price} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Minimo €</label>
                  <input type="number" name="floor_price" value={formData.floor_price} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Vecchio €</label>
                  <input type="number" name="champion_price" value={formData.champion_price} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Ospiti Prenotati</label>
                  <input type="number" name="guests" value={formData.guests} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Capacità Max Casa</label>
                  <input type="number" name="max_guests" value={formData.max_guests} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fee Extra Guest €</label>
                  <input type="number" name="extra_guest_fee" value={formData.extra_guest_fee} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Spese Giornaliere €</label>
                  <input type="number" name="daily_extra_fee" value={formData.daily_extra_fee} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50">
                {loading ? 'Calcolo in corso...' : 'Genera Prezzi'}
              </button>
            </form>
          </div>
        </div>

        {/* COLONNA DESTRA: GRAFICO, INDICATORI E TABELLA */}
        <div className="lg:col-span-8 space-y-6">
          {results.length > 0 ? (
            <>
              {/* GRAFICO */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <h2 className="text-lg font-bold text-white mb-4">Andamento Mercato vs Strategia</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(tick) => tick.slice(5)} />
                      <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="challenger_price" name="Tuo Prezzo (€)" stroke="#3b82f6" strokeWidth={3} dot={{r: 3}} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="market_median" name="Mediana Mercato (€)" stroke="#a855f7" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="champion_price" name="Vecchio Prezzo (€)" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* INDICATORE DI STRATEGIA */}
              {renderStrategyIndicator()}

              {/* TABELLA HEATMAP */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="p-3 font-semibold">Data</th>
                        <th className="p-3 font-semibold">Prezzo Consigliato</th>
                        <th className="p-3 font-semibold">Mercato / Trend</th>
                        <th className="p-3 font-semibold">Note / Evento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {results.map((item, idx) => {
                        
                        // --- LOGICA HEATMAP ---
                        let rowClass = "bg-slate-800 hover:bg-slate-700/50 transition-colors";
                        let tagClass = "bg-blue-900/50 text-blue-300 border-blue-700";
                        
                        if (item.multiplier >= 1.4) {
                          // Alta Pressione (Rosso)
                          rowClass = "bg-red-950/30 hover:bg-red-900/40 border-l-4 border-red-500 transition-colors";
                          tagClass = "bg-red-900/80 text-red-100 border-red-600";
                        } else if (item.multiplier > 1.0) {
                          // Media Pressione / Weekend (Giallo/Arancio)
                          rowClass = "bg-amber-950/30 hover:bg-amber-900/40 border-l-4 border-amber-500 transition-colors";
                          tagClass = "bg-amber-900/80 text-amber-100 border-amber-600";
                        } else {
                          // Bassa Pressione (Azzurro/Blu base)
                          rowClass = "bg-slate-800 hover:bg-slate-700/50 border-l-4 border-transparent transition-colors";
                        }

                        return (
                          <tr key={idx} className={rowClass}>
                            <td className="p-3">
                              <div className="font-semibold text-white">{item.date}</div>
                              <div className="text-xs opacity-70 capitalize">{item.day_of_week}</div>
                            </td>
                            <td className="p-3">
                              <div className="text-xl font-bold text-blue-400">€{item.challenger_price}</div>
                              <div className={`text-xs ${item.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {item.delta > 0 ? '+' : ''}{item.delta}€ vs Vecchio
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="text-white">€{item.market_median}</div>
                              <div className="text-xs text-purple-300 truncate w-32">{item.market_sample_count}</div>
                            </td>
                            <td className="p-3">
                              {item.active_event ? (
                                <span className={`px-2 py-1 text-xs rounded border ${tagClass} font-semibold inline-block truncate max-w-xs`}>
                                  {item.active_event} ({item.multiplier}x)
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-lg text-center h-full flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Nessun Dato Calcolato</h3>
              <p className="text-slate-500">Imposta i parametri a sinistra e clicca su "Genera Prezzi" per avviare l'analisi del mercato.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;