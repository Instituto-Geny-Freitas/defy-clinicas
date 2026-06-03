import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, cpfToEmail } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recoveryMode: boolean
  signInWithGoogle: () => Promise<void>
  signInWithCpf: (cpf: string, senha: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, senha: string) => Promise<{ error: string | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>
  clearRecovery: () => void
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/** Descobre se o usuário autenticado é equipe (professional) ou paciente. */
async function loadProfile(userId: string): Promise<Profile> {
  const [{ data: prof }, { data: pat }] = await Promise.all([
    supabase.from('professionals').select('*').eq('auth_user_id', userId).maybeSingle(),
    supabase.from('patients').select('*').eq('auth_user_id', userId).maybeSingle(),
  ])

  if (prof) return { kind: 'staff', professional: prof, patient: null }
  if (pat) return { kind: 'patient', professional: null, patient: pat }
  return { kind: 'unknown', professional: null, patient: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) setProfile(await loadProfile(data.session.user.id))
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(newSession)
      setProfile(newSession ? await loadProfile(newSession.user.id) : null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithCpf = async (cpf: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: cpfToEmail(cpf),
      password: senha,
    })
    return { error: error?.message ?? null }
  }

  const signInWithEmail = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return { error: error?.message ?? null }
  }

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    return { error: error?.message ?? null }
  }

  const clearRecovery = () => setRecoveryMode(false)

  const signOut = async () => {
    setRecoveryMode(false)
    await supabase.auth.signOut()
  }

  const reloadProfile = async () => {
    if (session) setProfile(await loadProfile(session.user.id))
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, recoveryMode, signInWithGoogle, signInWithCpf, signInWithEmail, resetPasswordForEmail, clearRecovery, signOut, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
