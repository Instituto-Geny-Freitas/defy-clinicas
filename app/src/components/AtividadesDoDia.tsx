import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActivities, ORIGEM_LABEL, STATUS_LABEL, type ActivityStatus, type InternalActivity } from '@/lib/internalActivities'
import { formatDateBR } from '@/lib/format'
import type { Professional } from '@/lib/types'

const STATUS_CHIP: Record<ActivityStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700', executado: 'bg-emerald-100 text-emerald-700', redirecionado: 'bg-sky-100 text-sky-700',
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Visão compacta das Atividades Internas de um dia (embutida na Agenda).
 *  Somente leitura — o CRUD completo é na página Atividades Internas. */
export default function AtividadesDoDia({ dataInicial, profissionais }: { dataInicial?: string | null; profissionais: Professional[] }) {
  const [data, setData] = useState(dataInicial || ymd(new Date()))
  const [itens, setItens] = useState<InternalActivity[]>([])
  const [carregando, setCarregando] = useState(true)

  const nomeProf = (id: string | null) => (id ? (profissionais.find((p) => p.id === id)?.nome ?? '—') : null)

  useEffect(() => {
    setCarregando(true)
    listActivities({ de: data, ate: data }).then(setItens).catch(() => {}).finally(() => setCarregando(false))
  }, [data])

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" />
        <Link to="/clinica/atividades" className="ml-auto rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Gerenciar atividades</Link>
      </div>

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
      <p className="mt-2 text-[11px] text-texto/40">Atividades internas (uso da equipe) — não aparecem no portal do paciente.</p>
    </div>
  )
}
