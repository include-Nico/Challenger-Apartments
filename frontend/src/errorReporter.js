// Manda al backend ogni errore javascript non previsto, appena succede, senza che chi sta
// usando l'app debba fare o notare nulla. Serve a vedere da qui, in sviluppo, cosa si rompe
// su dispositivi che non abbiamo sotto mano (per esempio un iPhone di un host).
//
// Importato per primo in main.jsx, prima di qualunque altra cosa: deve essere attivo anche
// se il resto dell'app fallisce a caricarsi.

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

let sent = 0;
const MAX_REPORTS_PER_SESSION = 15; // non inondare il server se qualcosa va in loop

export function reportError(source, message, stack = '') {
  if (sent >= MAX_REPORTS_PER_SESSION) return;
  sent += 1;
  try {
    const body = JSON.stringify({
      source,
      message: String(message).slice(0, 2000),
      stack: String(stack || '').slice(0, 4000),
      url: window.location.href,
      user_agent: navigator.userAgent,
    });
    // sendBeacon funziona anche se la pagina sta per chiudersi o è già rotta; se non
    // disponibile (browser molto vecchio), ripiega su un fetch normale.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE_URL}/api/client-error`, blob);
    } else {
      fetch(`${API_BASE_URL}/api/client-error`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Se anche la segnalazione fallisce, non deve rompere altro: si ignora e basta.
  }
}

// Si attiva da solo appena questo file viene importato (non serve chiamare nessuna funzione):
// così, se questo è il PRIMO import in cima a main.jsx, gli ascoltatori sono già pronti prima
// che qualunque altro modulo (incluso App.jsx) venga anche solo caricato. In un modulo ES tutti
// gli import vengono eseguiti prima di qualsiasi altra riga del file, quindi l'ordine in cui
// sono scritti gli import conta eccome: questo deve restare il primo.
window.addEventListener('error', (event) => {
  reportError('window.onerror', event.message, event.error && event.error.stack);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason && reason.message ? reason.message : String(reason);
  reportError('unhandledrejection', message, reason && reason.stack);
});