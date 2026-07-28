import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listProfessionals } from '@/lib/settings'
import type { Professional } from '@/lib/types'
import { formatDateBR, localDateToday } from '@/lib/format'
import { buildAtaPdf } from '@/lib/ataPdf'
import {
  createMeeting, deleteMeeting, listMeetings, listParticipants, listParticipantsForMeetings, setParticipants, updateMeeting,
  MEETING_STATUS_LABEL,
  type InternalMeeting, type MeetingParticipant, type MeetingStatus,
} from '@/lib/internalMeetings'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const STATUS_CHIP: Record<MeetingStatus, string> = {
  agendada: 'bg-amber-100 text-amber-700', realizada: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-black/5 text-texto/40',
}

export default function ReunioesInternas() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const isAdmin = profile?.professional?.role === 'admin'
  const clinicId = profile?.professional?.clinic_id ?? ''

  const [itens, setItens] = useState<InternalMeeting[]>([])
  const [profs, setProfs] = useState<Professional[]>([])
  const [partsPorReuniao, setPartsPorReuniao] = useState<Record<string, MeetingParticipant[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<InternalMeeting | 'novo' | null>(null)

  const nomePorProf = useMemo(() => new Map(profs.map((p) => [p.id, p.nome])), [profs])

  function recarregar() {
    setCarregando(true)
    listMeetings().then((ms) => {
      setItens(ms)
      listParticipantsForMeetings(ms.map((m) => m.id)).then((ps) => {
        const grp: Record<string, MeetingParticipant[]> = {}
        for (const p of ps) (grp[p.meeting_id] ??= []).push(p)
        setPartsPorReuniao(grp)
      }).catch(() => {})
    }).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => {
    listProfessionals().then(setProfs).catch(() => {})
    recarregar()
  }, [])

  async function excluir(m: InternalMeeting) {
    if (!isAdmin) return
    if (!confirm(`Excluir a reunião "${m.titulo}"? As atividades geradas são preservadas.`)) return
    await deleteMeeting(m.id); recarregar()
  }

  async function gerarPdf(m: InternalMeeting) {
    const parts = partsPorReuniao[m.id] ?? await listParticipants(m.id)
    const nomes = parts.map((p) => nomePorProf.get(p.professional_id) ?? '—')
    buildAtaPdf(m, nomes, clinic)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Reuniões Internas</h1>
          <p className="text-sm text-texto/50">Agendamentos e atas das reuniões da equipe (uso interno).</p>
        </div>
        {isAdmin && <button onClick={() => setModal('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova reunião</button>}
      </div>

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma reunião.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((m) => {
            const parts = partsPorReuniao[m.id] ?? []
            return (
              <div key={m.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-texto">{m.titulo}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[m.status]}`}>{MEETING_STATUS_LABEL[m.status]}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-texto/50">
                      {m.data && <span>📅 {formatDateBR(m.data)}{m.hora ? ` · ${m.hora.slice(0, 5)}` : ''}</span>}
                      {parts.length > 0 && <span>👥 {parts.length} participante(s)</span>}
                      {m.ata && <span>📝 ata registrada</span>}
                    </div>
                    {m.topicos && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-texto/70">{m.topicos}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <button onClick={() => gerarPdf(m)} className="font-medium text-texto/60 hover:underline">PDF</button>
                    <button onClick={() => setModal(m)} className="font-medium text-texto/60 hover:underline">{isAdmin ? 'Editar' : 'Ver'}</button>
                    {isAdmin && <button onClick={() => excluir(m)} className="font-medium text-secundaria hover:underline">Excluir</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ReuniaoModal
          meeting={modal === 'novo' ? null : modal}
          isAdmin={isAdmin} clinicId={clinicId} profs={profs} clinic={clinic}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); recarregar() }}
        />
      )}
    </div>
  )
}

function ReuniaoModal({ meeting, isAdmin, clinicId, profs, clinic, onClose, onSaved }: {
  meeting: InternalMeeting | null
  isAdmin: boolean; clinicId: string; profs: Professional[]; clinic: ReturnType<typeof useClinic>
  onClose: () => void; onSaved: () => void
}) {
  const { profile } = useAuth()
  const editar = !!meeting
  const somenteLeitura = editar && !isAdmin
  const [titulo, setTitulo] = useState(meeting?.titulo ?? '')
  const [data, setData] = useState(meeting?.data ?? localDateToday())
  const [hora, setHora] = useState(meeting?.hora ? meeting.hora.slice(0, 5) : '')
  const [topicos, setTopicos] = useState(meeting?.topicos ?? '')
  const [ata, setAta] = useState(meeting?.ata ?? '')
  const [status, setStatus] = useState<MeetingStatus>(meeting?.status ?? 'agendada')
  const [selIds, setSelIds] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const profsAtivos = profs.filter((p) => p.ativo)
  const todosMarcados = profsAtivos.length > 0 && selIds.length === profsAtivos.length

  useEffect(() => {
    if (meeting) listParticipants(meeting.id).then((ps) => setSelIds(ps.map((p) => p.professional_id))).catch(() => {})
  }, [meeting])

  function toggle(id: string) { setSelIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]) }
  function toggleTodos() { setSelIds(todosMarcados ? [] : profsAtivos.map((p) => p.id)) }

  async function salvar() {
    if (somenteLeitura) { onClose(); return }
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    setSalvando(true); setErro(null)
    try {
      const dados = { titulo, data: data || null, hora: hora || null, topicos: topicos || null, ata: ata || null, status }
      const id = meeting
        ? (await updateMeeting(meeting.id, dados), meeting.id)
        : (await createMeeting({ clinicId, ...dados, createdBy: profile?.professional?.id ?? null, createdByNome: profile?.professional?.nome ?? null })).id
      await setParticipants(clinicId, id, selIds)
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{!editar ? 'Nova reunião' : somenteLeitura ? 'Reunião' : 'Editar reunião'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-texto/70">Título *</label><input className={field} value={titulo} readOnly={somenteLeitura} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} readOnly={somenteLeitura} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Hora</label><input type="time" className={field} value={hora} readOnly={somenteLeitura} onChange={(e) => setHora(e.target.value)} /></div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Status</label>
              <select className={field} value={status} disabled={somenteLeitura} onChange={(e) => setStatus(e.target.value as MeetingStatus)}>
                {(Object.keys(MEETING_STATUS_LABEL) as MeetingStatus[]).map((s) => <option key={s} value={s}>{MEETING_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Tópicos</label><textarea rows={3} className={field} value={topicos} readOnly={somenteLeitura} onChange={(e) => setTopicos(e.target.value)} /></div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-texto/70">Participantes</label>
              {!somenteLeitura && profsAtivos.length > 0 && (
                <button type="button" onClick={toggleTodos} className="text-xs font-medium text-primaria hover:underline">{todosMarcados ? 'Limpar' : 'Todos'}</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-black/10 p-2">
              {profsAtivos.map((p) => {
                const on = selIds.includes(p.id)
                return (
                  <label key={p.id} className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${on ? 'bg-primaria/10 text-primaria' : 'text-texto/70'}`}>
                    <input type="checkbox" checked={on} disabled={somenteLeitura} onChange={() => toggle(p.id)} /> {p.nome}
                  </label>
                )
              })}
              {profsAtivos.length === 0 && <span className="text-xs text-texto/40">Nenhum profissional ativo.</span>}
            </div>
            <p className="mt-1 text-[11px] text-texto/40">Na Fase 2b a convocação aparecerá na agenda de cada participante para confirmação.</p>
          </div>

          <div><label className="mb-1 block text-sm text-texto/70">Ata</label><textarea rows={6} className={field} value={ata} readOnly={somenteLeitura} placeholder="Texto da ata (transcrição por áudio/IA na Fase 3)" onChange={(e) => setAta(e.target.value)} /></div>

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">{somenteLeitura ? 'Fechar' : 'Cancelar'}</button>
            {meeting && <button onClick={() => buildAtaPdf({ ...meeting, titulo, data: data || null, hora: hora || null, topicos: topicos || null, ata: ata || null, status }, selIds.map((id) => profs.find((p) => p.id === id)?.nome ?? '—'), clinic)} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:bg-black/5">PDF</button>}
            {!somenteLeitura && <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
