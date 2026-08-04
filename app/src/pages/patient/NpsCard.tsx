import { useEffect, useState } from 'react'
import { getNpsConfig, lastNpsAt, submitNps, type NpsConfig } from '@/lib/nps'

/**
 * Pesquisa de satisfação (NPS) no portal do paciente. Textos, periodicidade,
 * gatilho e perguntas extras vêm de Configurações → NPS. Só aparece quando o
 * paciente já tem atendimentos suficientes e não respondeu no intervalo.
 */
export default function NpsCard({ clinicId, patientId, appointmentId, atendimentos }: {
  clinicId: string
  patientId: string
  appointmentId?: string | null
  /** Quantos atendimentos realizados o paciente tem (gatilho da pesquisa). */
  atendimentos: number
}) {
  const [cfg, setCfg] = useState<NpsConfig | null>(null)
  const [mostrar, setMostrar] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [extras, setExtras] = useState<Record<string, unknown>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    getNpsConfig().then(async (c) => {
      setCfg(c)
      if (!c.ativo || atendimentos < c.minAtendimentos) { setMostrar(false); return }
      const ultimo = await lastNpsAt(patientId).catch(() => null)
      const recente = ultimo && (Date.now() - new Date(ultimo).getTime()) / 86400000 < c.periodicidadeDias
      setMostrar(!recente)
    }).catch(() => setMostrar(false))
  }, [patientId, atendimentos])

  async function enviar() {
    if (score == null || !cfg) return
    const faltando = cfg.perguntas.find((q) => q.obrigatoria && !String(extras[q.id] ?? '').trim())
    if (faltando) { setErro(`Responda: ${faltando.label}`); return }
    setEnviando(true); setErro(null)
    try {
      await submitNps({ clinicId, patientId, appointmentId, score, comentario: comentario.trim() || null, respostas: extras })
      setEnviado(true)
    } catch { setErro('Não foi possível enviar agora. Tente novamente.'); setEnviando(false) }
  }

  if (!cfg || !mostrar) return null
  if (enviado) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Obrigado pela sua avaliação! 💚
      </section>
    )
  }

  const campo = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

  return (
    <section className="rounded-xl border border-primaria/20 bg-primaria/5 p-4">
      <h2 className="text-sm font-semibold text-texto">{cfg.convite}</h2>
      <p className="mt-0.5 mb-3 text-xs text-texto/60">{cfg.pergunta}</p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`h-8 w-8 rounded-md text-sm font-medium transition ${score === n ? 'bg-primaria text-white' : 'bg-white text-texto/70 hover:bg-black/5'}`}
          >
            {n}
          </button>
        ))}
      </div>

      {score != null && (
        <>
          {cfg.perguntas.map((q) => (
            <div key={q.id} className="mt-3">
              <label className="mb-1 block text-xs font-medium text-texto/70">{q.label}{q.obrigatoria && ' *'}</label>
              {q.tipo === 'texto' && (
                <textarea rows={2} className={campo} value={String(extras[q.id] ?? '')} onChange={(e) => setExtras((s) => ({ ...s, [q.id]: e.target.value }))} />
              )}
              {q.tipo === 'nota' && (
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 11 }, (_, n) => (
                    <button key={n} onClick={() => setExtras((s) => ({ ...s, [q.id]: n }))}
                      className={`h-7 w-7 rounded-md text-xs font-medium transition ${extras[q.id] === n ? 'bg-primaria text-white' : 'bg-white text-texto/70 hover:bg-black/5'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {q.tipo === 'escolha' && (
                <select className={campo} value={String(extras[q.id] ?? '')} onChange={(e) => setExtras((s) => ({ ...s, [q.id]: e.target.value }))}>
                  <option value="">Selecione…</option>
                  {(q.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}

          <textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={cfg.comentarioLabel}
            className={`${campo} mt-3`}
          />
          {erro && <p className="mt-1 text-xs text-secundaria">{erro}</p>}
          <button onClick={enviar} disabled={enviando} className="mt-2 rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </>
      )}
    </section>
  )
}
