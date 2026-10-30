import 'leaflet/dist/leaflet.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'

// Pages deep-link restore: 404.html stashes demo/* paths here and redirects to the demo shell.
const spaRedirect = sessionStorage.getItem('nagartrace-spa-redirect')
if (spaRedirect && spaRedirect.startsWith(import.meta.env.BASE_URL.replace(/\/$/, ''))) {
  sessionStorage.removeItem('nagartrace-spa-redirect')
  history.replaceState(null, '', spaRedirect)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
