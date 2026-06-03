import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { updatePatient } from '@/lib/patients'
import { useClinic } from '@/theme/ThemeProvider'

const input = 'w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-primaria'

export default function ForcePasswordChange() {
  const { profile, reloadProfile, signOut } = useAuth()
  const clinic = useClinic()
  const [senha, setSenha] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return }
    if (senha !== conf) { setErro('As senhas não coincidem.'); return }
    setEnviando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      if (profile?.patient) await updatePatient(profile.patient.id, { senha_provisoria: false })
      await reloadProfile()
    } catch (e) {
      const m = (e instanceof Error ? e.message : '').toLowerCase()
      setErro(
        m.includes('different from the old')
          ? 'A nova senha deve ser diferente da senha atual.'
          : m.includes('weak') || m.includes('pwned') || m.includes('leaked')
            ? 'Senha muito fraca ou comprometida. Escolha outra.'
            : m.includes('length') || m.includes('at least') || m.includes('6 char')
              ? 'A senha é muito curta.'
              : e instanceof Error && e.message
                ? e.message
                : 'Não foi possível alterar a senha. Tente novamente.',
      )
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <div className="mb-5 text-center">
          {clinic?.logo_url ? <img src={clinic.logo_url} alt="" className="mx-auto h-14 object-contain" /> : <div className="text-3xl">🔒</div>}
          <h1 className="mt-3 text-lg font-semibold text-texto">Crie sua nova senha</h1>
          <p className="text-sm text-texto/60">Por segurança, defina uma senha pessoal para continuar.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="password" className={input} placeholder="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          <input type="password" className={input} placeholder="Confirmar nova senha" value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />
          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <button type="submit" disabled={enviando} className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Salvando…' : 'Definir senha e entrar'}
          </button>
        </form>
        <button onClick={signOut} className="mt-4 w-full text-center text-xs text-texto/50 hover:underline">Sair</button>
      </div>
    </div>
  )
}
