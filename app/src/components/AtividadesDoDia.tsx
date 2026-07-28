import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { listActivities, ORIGEM_LABEL, STATUS_LABEL, type ActivityStatus, type InternalActivity } from '@/lib/internalActivities'
import { listMeetings, listParticipantsForMeetings, updateParticipant, type InternalMeeting, type MeetingParticipant } from '@/lib/internalMeetings'
import { formatDateBR } from '@/lib/format'
import type { Professional } from '@/lib/types'

const STATUS_CHIP: Record<ActivityStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700', executado: 'bg-emerald-100 text-emerald-700', redirecionado: 'bg-sky-100 text-sky-700',
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Visão compacta do dia (embutida na Agenda): reuniões que me convocaram +
 *  atividades internas. Ações mínimas (confirmar presença); CRUD completo nas
 *  páginas dedicadas. */
export default function AtividadesDoDia({ dataInicial, profissionais }: { dataInicial?: string | null; profissionais: Professional[] }) {
  const { profile } = useAuth()
  const myProfId = profile?.professional?.id ?? null
  const [data, setData] = useState(dataInicial || ymd(new Date()))
  const [itens, setItens] = useState<InternalActivity[]>([])
  const [reunioes, setReunioes] = useState<{ m: InternalMeeting; part: MeetingParticipant }[]>([])
  const [carregando, setCarregando] = useState(true)

  const nomeProf = (id: string | null) => (id ? (profissionais.find((p) => p.id === id)?.nome ?? '—') : null)

  function carregar() {
    setCarregando(true)
    listActivities({ de: data, ate: data }).then(setItens).catch(() => {}).finally(() => setCarregando(false))
    // Reuniões do dia em que eu sou participante.
    listMeetings().then((ms) => {
      const doDia = ms.filter((m) => m.data === data)
      if (doDia.length === 0 || !myProfId) { setReunioes([]); return }
      listParticipantsForMeetings(doDia.map((m) => m.id)).then((ps) => {
        const minhas = ps.filter((p) => p.professional_id === myProfId)
        setReunioes(minhas.map((part) => ({ m: doDia.find((m) => m.id === part.meeting_id)!, part })).filter((x) => x.m))
      }).catch(() => {})
    }).catch(() => {})
  }
  useEffect(carregar, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar(part: MeetingParticipant) {
    await updateParticipant(part.id, { confirmado_em: part.confirmado_em ? null : new Date().toISOString() }).catch(() => {})
    carregar()
  }

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" />
        <Link to="/clinica/atividades" className="ml-auto rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Gerenciar atividades</Link>
      </div>

      {reunioes.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto/40">Reuniões do dia</div>
          <div className="space-y-2">
            {reunioes.map(({ m, part }) => (
              <div key={m.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {m.hora && <span className="text-sm font-medium text-texto/70">{m.hora.slice(0, 5)}</span>}
                  <span className="font-medium text-texto">{m.titulo}</span>
                  <Link to="/clinica/reunioes" className="text-xs font-medium text-primaria hover:underline">ver ata</Link>
                  <button onClick={() => confirmar(part)}
                    className={`ml-auto rounded-lg px-3 py-1 text-xs font-medium ${part.confirmado_em ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-texto/70 hover:bg-black/5'}`}>
                    {part.confirmado_em ? '✓ Presença confirmada' : 'Confirmar presença'}
                  </button>
                </div>
                {m.topicos && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-texto/60">{m.topicos}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto/40">Atividades</div>
      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma atividade interna para {formatDateBR(data)}.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((a) => (
            <div key={a.id} className="rounded-xl border border-black/5 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                {a.hora && <span className="text-sm font-medium text-texto/70">{a.hora.slice(0, 5)}</span>}
                <span className="font-medium text-texto">{a.titulo}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-texto/50">{ORIGEM_LABEL[a.origem]}</span>
                {a.responsavel_professional_id && <span className="text-xs text-texto/50">· {nomeProf(a.responsavel_professional_id)}</span>}
              </div>
              {a.descricao && <p className="mt-0.5 whitespace-pre-wrap text-sm text-texto/60">{a.descricao}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-texto/40">Itens internos (uso da equipe) — não aparecem no portal do paciente.</p>
    </div>
  )
}
