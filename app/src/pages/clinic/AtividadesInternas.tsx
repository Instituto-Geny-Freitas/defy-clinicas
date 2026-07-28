import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { listProfessionals } from '@/lib/settings'
import type { Professional } from '@/lib/types'
import { formatDateBR, localDateToday } from '@/lib/format'
import {
  addActivityLog, createActivity, deleteActivity, listActivities, listActivityLog, setActivityStatus, updateActivity,
  ORIGEM_LABEL, STATUS_LABEL,
  type ActivityLogEntry, type ActivityOrigin, type ActivityStatus, type InternalActivity,
} from '@/lib/internalActivities'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const STATUS_CHIP: Record<ActivityStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700', executado: 'bg-emerald-100 text-emerald-700', redirecionado: 'bg-sky-100 text-sky-700',
}
const ORIGEM_CHIP: Record<ActivityOrigin, string> = {
  admin: 'bg-violet-100 text-violet-700', membro: 'bg-black/5 text-texto/60', reuniao: 'bg-indigo-100 text-indigo-700',
}

export default function AtividadesInternas() {
  const { profile } = useAuth()
  const isAdmin = profile?.professional?.role === 'admin'
  const myProfId = profile?.professional?.id ?? null
  const myNome = profile?.professional?.nome ?? null
  const clinicId = profile?.professional?.clinic_id ?? ''

  const [itens, setItens] = useState<InternalActivity[]>([])
  const [profs, setProfs] = useState<Professional[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | ActivityStatus>('todas')
  const [modal, setModal] = useState<InternalActivity | 'novo' | null>(null)

  const nomePorProf = useMemo(() => new Map(profs.map((p) => [p.id, p.nome])), [profs])

  function recarregar() {
    setCarregando(true)
    listActivities().then(setItens).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => {
    listProfessionals().then(setProfs).catch(() => {})
    recarregar()
  }, [])

  // Edição completa: admin ou criador. Mudar só o status: também o responsável.
  const canEditFull = (a: InternalActivity) => isAdmin || a.created_by === myProfId
  const canStatus = (a: InternalActivity) => canEditFull(a) || a.responsavel_professional_id === myProfId
  const visiveis = itens.filter((a) => filtro === 'todas' || a.status === filtro)

  async function excluir(a: InternalActivity) {
    if (!canEditFull(a)) return
    if (!confirm(`Excluir a atividade "${a.titulo}"?`)) return
    await deleteActivity(a.id); recarregar()
  }
  // Muda só o status (executado preenche a data efetivada). Via RPC: admin/criador/responsável.
  async function mudarStatus(a: InternalActivity, status: ActivityStatus) {
    if (!canStatus(a) || status === a.status) return
    try {
      await setActivityStatus(a.id, status, status === 'executado' ? (a.data_efetivada ?? localDateToday()) : a.data_efetivada)
      recarregar()
    } catch { /* sem permissão / erro — mantém estado */ }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Atividades Internas</h1>
          <p className="text-sm text-texto/50">Tarefas internas da clínica (não aparecem no portal do paciente).</p>
        </div>
        <button onClick={() => setModal('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova atividade</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(['todas', 'pendente', 'executado', 'redirecionado'] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1 text-sm transition ${filtro === f ? 'bg-primaria font-medium text-white' : 'text-texto/60 hover:bg-black/5'}`}>
            {f === 'todas' ? 'Todas' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma atividade.</p>
      ) : (
        <div className="space-y-2">
          {visiveis.map((a) => (
            <div key={a.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-texto">{a.titulo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ORIGEM_CHIP[a.origem]}`}>{ORIGEM_LABEL[a.origem]}</span>
                  </div>
                  {a.descricao && <p className="mt-1 whitespace-pre-wrap text-sm text-texto/70">{a.descricao}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-texto/50">
                    {a.data && <span>📅 {formatDateBR(a.data)}{a.hora ? ` · ${a.hora.slice(0, 5)}` : ''}</span>}
                    {a.responsavel_professional_id && <span>👤 {nomePorProf.get(a.responsavel_professional_id) ?? '—'}</span>}
                    {a.status === 'executado' && a.data_efetivada && <span>✓ efetivada {formatDateBR(a.data_efetivada)}</span>}
                  </div>
                </div>
                {canStatus(a) && (
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <select value={a.status} onChange={(e) => mudarStatus(a, e.target.value as ActivityStatus)} className="rounded-md border border-black/10 px-1.5 py-1 text-xs" title="Alterar status">
                      {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    {canEditFull(a) && <button onClick={() => setModal(a)} className="font-medium text-texto/60 hover:underline">Editar</button>}
                    {canEditFull(a) && <button onClick={() => excluir(a)} className="font-medium text-secundaria hover:underline">Excluir</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <AtividadeModal
          activity={modal === 'novo' ? null : modal}
          isAdmin={isAdmin} myProfId={myProfId} myNome={myNome} clinicId={clinicId} profs={profs}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); recarregar() }}
        />
      )}
    </div>
  )
}

function AtividadeModal({ activity, isAdmin, myProfId, myNome, clinicId, profs, onClose, onSaved }: {
  activity: InternalActivity | null
  isAdmin: boolean; myProfId: string | null; myNome: string | null; clinicId: string; profs: Professional[]
  onClose: () => void; onSaved: () => void
}) {
  const editar = !!activity
  const [titulo, setTitulo] = useState(activity?.titulo ?? '')
  const [descricao, setDescricao] = useState(activity?.descricao ?? '')
  const [responsavel, setResponsavel] = useState(activity?.responsavel_professional_id ?? (isAdmin ? '' : myProfId ?? ''))
  const [data, setData] = useState(activity?.data ?? localDateToday())
  const [hora, setHora] = useState(activity?.hora ? activity.hora.slice(0, 5) : '')
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'pendente')
  const [dataEfetivada, setDataEfetivada] = useState(activity?.data_efetivada ?? '')
  const [log, setLog] = useState<ActivityLogEntry[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (activity) listActivityLog(activity.id).then(setLog).catch(() => {}) }, [activity])

  const profsAtivos = profs.filter((p) => p.ativo)

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    setSalvando(true); setErro(null)
    try {
      if (activity) {
        const patch = {
          titulo, descricao: descricao || null,
          responsavel_professional_id: responsavel || null,
          data: data || null, hora: hora || null, status,
          data_efetivada: status === 'executado' ? (dataEfetivada || localDateToday()) : (dataEfetivada || null),
        }
        // Log de ajustes das atividades criadas pelo Admin.
        if (activity.origem === 'admin') {
          const campos: { campo: string; de: string | null; para: string | null }[] = []
          const push = (campo: string, de: unknown, para: unknown) => { if (String(de ?? '') !== String(para ?? '')) campos.push({ campo, de: de == null ? null : String(de), para: para == null ? null : String(para) }) }
          push('título', activity.titulo, patch.titulo)
          push('responsável', activity.responsavel_professional_id, patch.responsavel_professional_id)
          push('data', activity.data, patch.data)
          push('hora', activity.hora, patch.hora)
          push('status', activity.status, patch.status)
          await updateActivity(activity.id, patch)
          if (campos.length) await addActivityLog(clinicId, activity.id, myProfId, myNome, campos).catch(() => {})
        } else {
          await updateActivity(activity.id, patch)
        }
      } else {
        await createActivity({
          clinicId, titulo, descricao: descricao || null,
          responsavelProfessionalId: isAdmin ? (responsavel || null) : myProfId,
          origem: isAdmin ? 'admin' : 'membro',
          data: data || null, hora: hora || null, status,
          dataEfetivada: status === 'executado' ? (dataEfetivada || localDateToday()) : (dataEfetivada || null),
          createdBy: myProfId ?? '', createdByNome: myNome,
        })
      }
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar atividade' : 'Nova atividade'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-texto/70">Título *</label><input className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Descrição</label><textarea rows={3} className={field} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Hora</label><input type="time" className={field} value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-texto/70">Responsável</label>
            {isAdmin ? (
              <select className={field} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                <option value="">— Sem responsável —</option>
                {profsAtivos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            ) : (
              <input className={`${field} bg-black/5`} value={myNome ?? '—'} readOnly />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-texto/70">Status</label>
              <select className={field} value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>
                {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            {status === 'executado' && (
              <div><label className="mb-1 block text-sm text-texto/70">Data efetivada</label><input type="date" className={field} value={dataEfetivada} onChange={(e) => setDataEfetivada(e.target.value)} /></div>
            )}
          </div>

          {editar && activity?.origem === 'admin' && log.length > 0 && (
            <div className="rounded-lg border border-black/5 bg-black/[0.02] p-3">
              <div className="mb-1 text-xs font-medium text-texto/60">Histórico de ajustes</div>
              <ul className="space-y-0.5 text-[11px] text-texto/60">
                {log.map((l) => (
                  <li key={l.id}>{formatDateBR(l.created_at)} · <strong>{l.campo}</strong>: {l.de || '—'} → {l.para || '—'}{l.changed_by_nome ? ` (${l.changed_by_nome})` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
