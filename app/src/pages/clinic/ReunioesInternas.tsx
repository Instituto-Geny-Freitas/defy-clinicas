import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { usePermissions } from '@/auth/PermissionsProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listProfessionals } from '@/lib/settings'
import type { Professional } from '@/lib/types'
import { formatDateBR, localDateToday } from '@/lib/format'
import { buildAtaPdf } from '@/lib/ataPdf'
import {
  createMeeting, deleteMeeting, listMeetings, listParticipants, listParticipantsForMeetings, setParticipants, updateMeeting, updateParticipant,
  MEETING_STATUS_LABEL,
  type InternalMeeting, type MeetingParticipant, type MeetingStatus,
} from '@/lib/internalMeetings'
import {
  createActivity, deleteActivity, listMeetingActivities, STATUS_LABEL,
  type ActivityStatus, type InternalActivity,
} from '@/lib/internalActivities'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const STATUS_CHIP: Record<MeetingStatus, string> = {
  agendada: 'bg-amber-100 text-amber-700', realizada: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-black/5 text-texto/40',
}
const ACT_CHIP: Record<ActivityStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700', executado: 'bg-emerald-100 text-emerald-700', redirecionado: 'bg-sky-100 text-sky-700',
}

export default function ReunioesInternas() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const clinic = useClinic()
  const podeConvocar = can('reunioes.convocar')
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
    if (!podeConvocar) return
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
        {podeConvocar && <button onClick={() => setModal('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova reunião</button>}
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
                    <button onClick={() => setModal(m)} className="font-medium text-texto/60 hover:underline">{podeConvocar ? 'Editar' : 'Ver'}</button>
                    {podeConvocar && <button onClick={() => excluir(m)} className="font-medium text-secundaria hover:underline">Excluir</button>}
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
          podeConvocar={podeConvocar} clinicId={clinicId} profs={profs} clinic={clinic}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); recarregar() }}
        />
      )}
    </div>
  )
}

function ReuniaoModal({ meeting, podeConvocar, clinicId, profs, clinic, onClose, onSaved }: {
  meeting: InternalMeeting | null
  podeConvocar: boolean; clinicId: string; profs: Professional[]; clinic: ReturnType<typeof useClinic>
  onClose: () => void; onSaved: () => void
}) {
  const { profile } = useAuth()
  const myProfId = profile?.professional?.id ?? null
  const myNome = profile?.professional?.nome ?? null
  const editar = !!meeting
  const somenteLeitura = editar && !podeConvocar
  const [titulo, setTitulo] = useState(meeting?.titulo ?? '')
  const [data, setData] = useState(meeting?.data ?? localDateToday())
  const [hora, setHora] = useState(meeting?.hora ? meeting.hora.slice(0, 5) : '')
  const [topicos, setTopicos] = useState(meeting?.topicos ?? '')
  const [ata, setAta] = useState(meeting?.ata ?? '')
  const [status, setStatus] = useState<MeetingStatus>(meeting?.status ?? 'agendada')
  const [parts, setParts] = useState<MeetingParticipant[]>([])
  const [selIds, setSelIds] = useState<string[]>([])
  const [acts, setActs] = useState<InternalActivity[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const profsAtivos = profs.filter((p) => p.ativo)
  const nomePorProf = useMemo(() => new Map(profs.map((p) => [p.id, p.nome])), [profs])
  const todosMarcados = profsAtivos.length > 0 && selIds.length === profsAtivos.length
  const meParticipant = parts.find((p) => p.professional_id === myProfId) ?? null

  function recarregarParts() { if (meeting) listParticipants(meeting.id).then((ps) => { setParts(ps); setSelIds(ps.map((p) => p.professional_id)) }).catch(() => {}) }
  function recarregarActs() { if (meeting) listMeetingActivities(meeting.id).then(setActs).catch(() => {}) }
  useEffect(() => { recarregarParts(); recarregarActs() }, [meeting]) // eslint-disable-line react-hooks/exhaustive-deps

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
        : (await createMeeting({ clinicId, ...dados, createdBy: myProfId, createdByNome: myNome })).id
      await setParticipants(clinicId, id, selIds)
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar.'); setSalvando(false) }
  }

  // Minha participação (confirmar presença / ciência / manifestação).
  const [manifest, setManifest] = useState('')
  useEffect(() => { setManifest(meParticipant?.manifestacao ?? '') }, [meParticipant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function responder(patch: { confirmado_em?: string | null; ciente_em?: string | null; manifestacao?: string | null }) {
    if (!meParticipant) return
    await updateParticipant(meParticipant.id, patch).catch(() => {})
    recarregarParts()
  }

  // Nova atividade da reunião (gera em Atividades Internas com origem 'reuniao').
  const [novoTit, setNovoTit] = useState('')
  const [novoResp, setNovoResp] = useState('')
  const [novoData, setNovoData] = useState('')
  async function addAtividade() {
    if (!meeting || !novoTit.trim()) return
    await createActivity({
      clinicId, titulo: novoTit, responsavelProfessionalId: novoResp || null,
      origem: 'reuniao', meetingId: meeting.id, data: novoData || null,
      createdBy: myProfId ?? '', createdByNome: myNome,
    }).catch(() => {})
    setNovoTit(''); setNovoResp(''); setNovoData(''); recarregarActs()
  }
  async function removerAtividade(a: InternalActivity) {
    if (!confirm(`Excluir a atividade "${a.titulo}"?`)) return
    await deleteActivity(a.id).catch(() => {}); recarregarActs()
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
          </div>

          <div><label className="mb-1 block text-sm text-texto/70">Ata</label><textarea rows={6} className={field} value={ata} readOnly={somenteLeitura} placeholder="Texto da ata (transcrição por áudio/IA na Fase 3)" onChange={(e) => setAta(e.target.value)} /></div>

          {/* Minha participação (para quem foi convocado) */}
          {meParticipant && (
            <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
              <div className="mb-2 text-sm font-medium text-texto/80">Minha participação</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button type="button" onClick={() => responder({ confirmado_em: meParticipant.confirmado_em ? null : new Date().toISOString() })}
                  className={`rounded-lg px-3 py-1.5 font-medium ${meParticipant.confirmado_em ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}>
                  {meParticipant.confirmado_em ? '✓ Presença confirmada' : 'Confirmar presença'}
                </button>
                <button type="button" onClick={() => responder({ ciente_em: meParticipant.ciente_em ? null : new Date().toISOString() })}
                  className={`rounded-lg px-3 py-1.5 font-medium ${meParticipant.ciente_em ? 'bg-sky-100 text-sky-700' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}>
                  {meParticipant.ciente_em ? '✓ Ciente' : 'Dar ciência'}
                </button>
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-xs text-texto/60">Manifestação (pontos)</label>
                <textarea rows={2} className={field} value={manifest} onChange={(e) => setManifest(e.target.value)} onBlur={() => { if (manifest !== (meParticipant.manifestacao ?? '')) responder({ manifestacao: manifest || null }) }} />
              </div>
            </div>
          )}

          {/* Atividades geradas na reunião */}
          {editar && (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
              <div className="mb-1 text-sm font-medium text-texto/80">Atividades desta reunião</div>
              {acts.length === 0 ? (
                <p className="text-xs text-texto/40">Nenhuma atividade gerada.</p>
              ) : (
                <div className="space-y-1">
                  {acts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-texto/80">{a.titulo}{a.responsavel_professional_id ? ` · ${nomePorProf.get(a.responsavel_professional_id) ?? '—'}` : ''}{a.data ? ` · ${formatDateBR(a.data)}` : ''}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ACT_CHIP[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                      {podeConvocar && <button onClick={() => removerAtividade(a)} className="shrink-0 text-texto/40 hover:text-secundaria">✕</button>}
                    </div>
                  ))}
                </div>
              )}
              {podeConvocar && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
                  <input className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" placeholder="Nova atividade…" value={novoTit} onChange={(e) => setNovoTit(e.target.value)} />
                  <select className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={novoResp} onChange={(e) => setNovoResp(e.target.value)}>
                    <option value="">Responsável…</option>
                    {profsAtivos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <input type="date" className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
                  <button type="button" onClick={addAtividade} className="rounded-lg bg-primaria px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Adicionar</button>
                </div>
              )}
              <p className="mt-1 text-[11px] text-texto/40">As atividades aparecem também em Atividades Internas (origem “Reunião”).</p>
            </div>
          )}

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">{somenteLeitura ? 'Fechar' : 'Cancelar'}</button>
            {meeting && <button onClick={() => buildAtaPdf({ ...meeting, titulo, data: data || null, hora: hora || null, topicos: topicos || null, ata: ata || null, status }, selIds.map((id) => nomePorProf.get(id) ?? '—'), clinic)} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:bg-black/5">PDF</button>}
            {!somenteLeitura && <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
