import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'

type Modo = 'cpf' | 'email'

const inputCls =
  'w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-primaria'

export default function Login() {
  const { signInWithGoogle, signInWithCpf, signInWithEmail, resetPasswordForEmail } = useAuth()
  const clinic = useClinic()
  const [modo, setModo] = useState<Modo>('cpf')
  const [identificador, setIdentificador] = useState('') // CPF ou e-mail
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // recuperação de senha
  const [recuperar, setRecuperar] = useState(false)
  const [recEmail, setRecEmail] = useState('')
  const [recMsg, setRecMsg] = useState<string | null>(null)

  async function enviarRecuperacao(e: FormEvent) {
    e.preventDefault()
    setRecMsg(null)
    setEnviando(true)
    await resetPasswordForEmail(recEmail)
    setEnviando(false)
    setRecMsg('Se houver uma conta com este e-mail, enviamos um link para redefinir a senha.')
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    // Tolerância: se o texto parece e-mail (contém @), entra por e-mail mesmo
    // que a aba CPF esteja selecionada — evita o erro de digitar e-mail no CPF.
    const pareceEmail = identificador.includes('@')
    const usarEmail = modo === 'email' || pareceEmail
    const { error } = usarEmail
      ? await signInWithEmail(identificador.trim(), senha)
      : await signInWithCpf(identificador, senha)
    setEnviando(false)
    if (error) setErro(usarEmail ? 'E-mail ou senha inválidos.' : 'CPF ou senha inválidos.')
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt="Logo" className="mx-auto h-16 object-contain" />
          ) : (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primaria/10 text-2xl">
              💚
            </div>
          )}
          <h1 className="mt-3 text-xl font-semibold text-texto">
            {clinic?.nome ?? 'Instituto Geny Freitas'}
          </h1>
          <p className="text-sm text-texto/60">Acesse sua conta</p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="mb-4 w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-texto transition hover:bg-black/5"
        >
          Entrar com Google
        </button>

        {recuperar ? (
          <form onSubmit={enviarRecuperacao} className="space-y-3">
            <p className="text-sm text-texto/60">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
            <input
              value={recEmail}
              onChange={(e) => setRecEmail(e.target.value)}
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              className={inputCls}
            />
            {recMsg && <p className="text-sm text-emerald-600">{recMsg}</p>}
            <button type="submit" disabled={enviando} className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
            <button type="button" onClick={() => { setRecuperar(false); setRecMsg(null) }} className="w-full text-center text-xs text-texto/50 hover:underline">
              Voltar ao login
            </button>
          </form>
        ) : (
          <>
            {/* Alternância de modo */}
            <div className="mb-3 flex rounded-lg bg-black/5 p-1 text-sm">
              <button type="button" onClick={() => { setModo('cpf'); setErro(null) }} className={`flex-1 rounded-md py-1.5 transition ${modo === 'cpf' ? 'bg-white font-medium text-texto shadow-sm' : 'text-texto/60'}`}>CPF</button>
              <button type="button" onClick={() => { setModo('email'); setErro(null) }} className={`flex-1 rounded-md py-1.5 transition ${modo === 'email' ? 'bg-white font-medium text-texto shadow-sm' : 'text-texto/60'}`}>E-mail</button>
            </div>

            <form onSubmit={entrar} className="space-y-3">
              <input value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder={modo === 'cpf' ? 'CPF' : 'E-mail'} inputMode={modo === 'cpf' ? 'numeric' : 'email'} autoComplete={modo === 'cpf' ? 'username' : 'email'} className={inputCls} />
              <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="Senha" autoComplete="current-password" className={inputCls} />
              {erro && <p className="text-sm text-secundaria">{erro}</p>}
              <button type="submit" disabled={enviando} className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
            <button type="button" onClick={() => setRecuperar(true)} className="mt-3 w-full text-center text-xs text-texto/50 hover:underline">
              Esqueci minha senha
            </button>
          </>
        )}
      </div>
    </div>
  )
}
