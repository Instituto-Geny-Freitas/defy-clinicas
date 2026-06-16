import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Clinic, ClinicTheme } from '@/lib/types'

interface ThemeState {
  clinic: Clinic | null
  reload: () => void
}

const ThemeContext = createContext<ThemeState>({ clinic: null, reload: () => {} })

/** "#1f6f5c" -> "31 111 92" (canais RGB para as CSS variables). */
function hexToRgbChannels(hex?: string): string | null {
  if (!hex) return null
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function applyTheme(tema: ClinicTheme) {
  const root = document.documentElement
  const map: Record<string, string | undefined> = {
    '--cor-primaria': tema.primaria,
    '--cor-secundaria': tema.secundaria,
    '--cor-fundo': tema.fundo,
    '--cor-texto': tema.texto,
  }
  for (const [varName, hex] of Object.entries(map)) {
    const channels = hexToRgbChannels(hex)
    if (channels) root.style.setProperty(varName, channels)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<Clinic | null>(null)

  function load() {
    // A leitura da clínica é liberada para autenticados (RLS). Antes do login,
    // mantém-se o tema padrão definido no index.css.
    supabase
      .from('clinics')
      .select('id, nome, logo_url, tema_cores, whatsapp')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setClinic(data)
        if (data.tema_cores) applyTheme(data.tema_cores)
      })
  }

  useEffect(() => {
    load()
    // A leitura de clinics é gated por RLS (apenas autenticados). Como o provider
    // monta antes do login, recarrega sempre que a sessão muda (login/refresh),
    // garantindo logo + nome no sidebar logo após autenticar.
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => sub.subscription.unsubscribe()
  }, [])

  return <ThemeContext.Provider value={{ clinic, reload: load }}>{children}</ThemeContext.Provider>
}

export function useClinic(): Clinic | null {
  return useContext(ThemeContext).clinic
}

export function useThemeReload(): () => void {
  return useContext(ThemeContext).reload
}
