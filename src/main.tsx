import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/themes.css'
import './styles/typography.css'
import { ThemeProvider } from './context/ThemeContext'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.tsx'
import { ensureServiceWorker } from './lib/notifications'

// Registra o Service Worker cedo (não bloqueia render).
// Isso deixa o app pronto pra receber push notifications quando
// o usuário ativar no toggle "Ativar notificações".
if (typeof window !== "undefined") {
  window.addEventListener("load", () => { ensureServiceWorker(); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <SpeedInsights />
    </ThemeProvider>
  </StrictMode>,
)
