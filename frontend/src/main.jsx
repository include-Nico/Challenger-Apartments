// Deve restare il primissimo import del file: attiva gli ascoltatori di errore prima che
// qualunque altro modulo (App.jsx compreso) venga anche solo caricato. Vedi errorReporter.js.
import './errorReporter.js'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Pulizia una tantum: se un service worker di una vecchia versione dell'app sta ancora
// controllando questa pagina (può succedere su Safari/iOS dopo un aggiornamento, bloccando
// il sito su una versione vecchia o rotta), lo sostituiamo con uno che si disattiva subito
// e libera la cache. Chi visita l'app per la prima volta non ne risente: qui non si registra
// nessun service worker nuovo, solo quelli già presenti vengono smontati.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)