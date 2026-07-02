import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { askAssistant, type ChatMessage } from '@/lib/assistant'

const SUGESTOES = [
  'Minha agenda de hoje',
  'Qual minha próxima consulta?',
  'Receitas deste mês',
  'Quem preciso regularizar?',
  'Ver alertas',
]

export default function Assistant() {
  const { profile } = useAuth()
  const nome = profile?.professional?.nome ?? 'profissional'
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, enviando])

  async function enviar(conteudo: string) {
    const msg = conteudo.trim()
    if (!msg || enviando) return
    setErro(null)
    setTexto('')
    const novo: ChatMessage[] = [...mensagens, { role: 'user', content: msg }]
    setMensagens(novo)
    setEnviando(true)
    try {
      const reply = await askAssistant(novo)
      setMensagens([...novo, { role: 'assistant', content: reply }])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível falar com o assistente.')
      setMensagens(novo) // mantém a pergunta do usuário
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-fundo">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-texto">🤖 Assistente · Instituto Geny Freitas</div>
          <div className="text-xs text-texto/50">Olá, {nome.split(' ')[0]}</div>
        </div>
        <Link to="/clinica" className="rounded-lg px-3 py-1.5 text-xs font-medium text-texto/60 hover:bg-black/5">
          Sistema completo →
        </Link>
      </header>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {mensagens.length === 0 && (
            <div className="rounded-2xl bg-white p-4 text-sm text-texto/70">
              <p className="font-medium text-texto">Como posso ajudar?</p>
              <p className="mt-1 text-texto/60">Peça sua agenda, agende um paciente, consulte o financeiro, veja alertas ou registre algo do Administrativo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)}
                    className="rounded-full bg-primaria/10 px-3 py-1 text-xs font-medium text-primaria hover:bg-primaria/20">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-primaria text-white' : 'bg-white text-texto shadow-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {enviando && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-2.5 text-sm text-texto/40 shadow-sm">digitando…</div>
            </div>
          )}

          {erro && <div className="rounded-xl border border-secundaria/30 bg-secundaria/5 px-4 py-2 text-xs text-secundaria">{erro}</div>}

          <div ref={fimRef} />
        </div>
      </div>

      {/* Entrada */}
      <footer className="border-t border-black/5 bg-white px-4 py-3">
        <form
          onSubmit={(e) => { e.preventDefault(); enviar(texto) }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }}
            rows={1}
            placeholder="Digite sua mensagem…"
            className="max-h-32 flex-1 resize-none rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-primaria"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="rounded-full bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            ➤
          </button>
        </form>
        <p className="mx-auto mt-1.5 max-w-2xl text-center text-[11px] text-texto/40">
          O assistente atua apenas no contexto do sistema, com as suas permissões.
        </p>
      </footer>
    </div>
  )
}
