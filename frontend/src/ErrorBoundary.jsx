import { Component } from 'react';

// Se un errore javascript non previsto sfugge a tutti i controlli, mostra un messaggio invece
// di lasciare una schermata bianca senza spiegazione.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ChallengerHouse - errore non gestito:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a', background: '#f8fafc'
        }}>
          <div style={{ fontSize: '40px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Qualcosa è andato storto</div>
          <div style={{ fontSize: '14px', color: '#64748b', maxWidth: '320px' }}>
            Prova a ricaricare la pagina. Se il problema continua, controlla di non avere la
            Navigazione privata o il blocco dei cookie attivi per questo sito.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none',
              background: '#8b5cf6', color: '#fff', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}