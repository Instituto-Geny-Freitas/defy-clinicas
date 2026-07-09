import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { ThemeProvider } from '@/theme/ThemeProvider'

// Evita que a roda do mouse altere campos numéricos focados (ex.: 5 virava 4,99
// ao rolar a página com o cursor sobre o campo). Ao rolar, desfoca o input.
window.addEventListener('wheel', () => {
  const el = document.activeElement
  if (el instanceof HTMLInputElement && el.type === 'number') el.blur()
}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
