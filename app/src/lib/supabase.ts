import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Aviso amigável em dev caso o .env.local não esteja configurado.
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. ' +
      'Copie app/.env.example para app/.env.local e preencha.',
  )
}

// Fallbacks evitam que createClient lance erro quando o .env.local ainda não
// foi configurado — o app renderiza o login e as consultas simplesmente falham.
const safeUrl = url || 'https://placeholder.supabase.co'
const safeKey = anonKey || 'placeholder-anon-key'

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

const CPF_DOMAIN = (import.meta.env.VITE_CPF_EMAIL_DOMAIN as string) || 'geny.local'

/** Remove máscara do CPF, deixando só dígitos. */
export function digitsOnly(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/** Converte CPF em e-mail sintético interno usado no login por CPF+senha. */
export function cpfToEmail(cpf: string): string {
  return `${digitsOnly(cpf)}@${CPF_DOMAIN}`
}
