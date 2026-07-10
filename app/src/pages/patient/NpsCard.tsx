import { useEffect, useState } from 'react'
import { lastNpsAt, submitNps } from '@/lib/nps'

/**
 * Pesquisa de satisfação (NPS) no portal do paciente. Só aparece quando o
 * paciente teve atendimento (elegivel) e não respondeu nos últimos 90 dias.
 */
export default function NpsCard({ clinicId, patientId, appointmentId, elegivel }: {
  clinicId: string
  patientId: string
  appointmentId?: string | null
  elegivel: boolean
}) {
  const [mostrar, setMostrar] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!elegivel) { setMostrar(false); return }
    lastNpsAt(patientId).then((ultimo) => {
      const recente = ultimo && (Date.now() - new Date(ultimo).getTime()) / 86400000 < 90
      setMostrar(!recente)
    }).catch(() => setMostrar(true))
  }, [patientId, elegivel])

  async function enviar() {
    if (score == null) return
    setEnviando(true)
    try {
      await submitNps({ clinicId, patientId, appointmentId, score, comentario: comentario.trim() || null })
      setEnviado(true)
    } catch { setEnviando(false) }
  }

  if (!mostrar) return null
  if (enviado) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Obrigado pela sua avaliação! 💚
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-primaria/20 bg-primaria/5 p-4">
      <h2 className="text-sm font-semibold text-texto">Como foi seu atendimento?</h2>
      <p className="mt-0.5 mb-3 text-xs text-texto/60">De 0 a 10, o quanto você recomendaria a clínica a um amigo?</p>
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
          <textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Quer deixar um comentário? (opcional)"
            className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          />
          <button onClick={enviar} disabled={enviando} className="mt-2 rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </>
      )}
    </section>
  )
}
