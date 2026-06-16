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

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el) }
  el.content = content
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el) }
  el.href = href
}

function mimeFromUrl(url: string): string {
  const u = url.toLowerCase()
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.svg')) return 'image/svg+xml'
  if (u.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

let manifestUrl: string | null = null

/** Aplica nome, ícone, theme-color e um manifest dinâmico (PWA white-label). */
function applyBranding(clinic: Clinic) {
  if (clinic.nome) document.title = clinic.nome
  const primaria = clinic.tema_cores?.primaria
  if (primaria) setMeta('theme-color', primaria)

  if (clinic.logo_url) {
    setLink('icon', clinic.logo_url)
    setLink('apple-touch-icon', clinic.logo_url)
  }

  const icons = clinic.logo_url
    ? [
        { src: clinic.logo_url, sizes: '192x192', type: mimeFromUrl(clinic.logo_url), purpose: 'any' },
        { src: clinic.logo_url, sizes: '512x512', type: mimeFromUrl(clinic.logo_url), purpose: 'any' },
      ]
    : []
  const manifest = {
    name: clinic.nome || 'Clínica',
    short_name: clinic.nome || 'Clínica',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: clinic.tema_cores?.fundo || '#ffffff',
    theme_color: primaria || '#0f766e',
    icons,
  }
  try {
    if (manifestUrl) URL.revokeObjectURL(manifestUrl)
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    manifestUrl = URL.createObjectURL(blob)
    setLink('manifest', manifestUrl)
  } catch { /* ignora ambientes sem suporte */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<Clinic | null>(null)

  function load() {
    // Lê apenas os dados de marca pela view pública (v_clinic_branding), que é
    // acessível por anônimos — assim a tela de login já aparece com logo, nome
    // e cores da clínica, antes mesmo do login.
    supabase
      .from('v_clinic_branding')
      .select('id, nome, logo_url, tema_cores, whatsapp')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setClinic(data)
        if (data.tema_cores) applyTheme(data.tema_cores)
        applyBranding(data)
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
