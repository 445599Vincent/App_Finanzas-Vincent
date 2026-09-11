import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'

// Sin internet, la app sigue abriendo con lo que ya tienes guardado.
// Solo en produccion: en desarrollo un service worker sirve codigo viejo y
// hace perder tiempo persiguiendo cambios que si estaban hechos.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app funciona igual, solo que no sin conexión.
    })
  })
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
