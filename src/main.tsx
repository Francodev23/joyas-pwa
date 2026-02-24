import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  // NO registrar en desarrollo localhost (solo en producción)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === ''
  
  // Solo registrar en producción (no en desarrollo localhost)
  if (!isLocalhost && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registrado:', registration.scope)
        })
        .catch((error) => {
          console.error('[SW] Error al registrar Service Worker:', error)
        })
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

