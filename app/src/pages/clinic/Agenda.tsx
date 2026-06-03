import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  createAppointment,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/appointments'
import { listPatients } from '@/lib/patients'
import { listProfessionals } from '@/lib/settings'
import type { Patient, Professional } from '@/lib/types'
import ApptStatusBadge from '@/components/ApptStatusBadge'
import MonthCalendar from '@/components/MonthCalendar'

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

/** Combina data (YYYY-MM-DD) + hora (HH:MM) em ISO. */
function toISO(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString()
}

export default function Agenda() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [appts, setAppts] = useState<Appointment[]>([])
  const [profissionais, setProfissionais] = useState<Professional[]>([])
  const [filtroProf, setFiltroProf] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [remarcando, setRemarcando] = useState<Appointment | null>(null)

  function recarregar() {
    const ontem = new Date(Date.now() - 86400000).toISOString()
    listAppointments(ontem, filtroProf || undefined).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [filtroProf])
  useEffect(() => { listProfessionals().then((p) => setProfissionais(p.filter((x) => x.ativo))).catch(() => {}) }, [])

  async function mudarStatus(id: string, status: AppointmentStatus) {
    await updateAppointmentStatus(id, status)
    recarregar()
  }

  const grupos = appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dia = a.inicio.slice(0, 10)
    ;(acc[dia] ??= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-texto">Agenda</h1>
        <div className="flex items-center gap-2">
          <select value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria">
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo</button>
        </div>
      </div>

      {modal && clinicId && (
        <AgendamentoModal clinicId={clinicId} profissionais={profissionais} defaultProf={profile?.professional?.id} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {remarcando && (
        <RemarcarModal appt={remarcando} onClose={() => setRemarcando(null)} onSaved={() => { setRemarcando(null); recarregar() }} />
      )}

      {carregando ? (
        <p className="mt-4 text-sm text-texto/50">Carregando…</p>
      ) : appts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum agendamento.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grupos).map(([dia, lista]) => (
            <div key={dia}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-texto/70">{dataLonga(dia + 'T12:00:00')}</h2>
              <div className="space-y-2">
                {lista.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-white p-4">
                    <div className="w-14 text-center"><div className="text-lg font-semibold text-primaria">{hora(a.inicio)}</div></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-texto">{a.patients?.nome ?? 'Paciente'}</div>
                      <div className="text-sm text-texto/60">
                        {a.procedimento ?? 'Atendimento'}
                        {a.professionals?.nome && <span className="text-texto/40"> · {a.professionals.nome}</span>}
                      </div>
                    </div>
                    <ApptStatusBadge status={a.status} />
                    {a.status !== 'cancelado' && a.status !== 'realizado' && (
                      <div className="flex flex-wrap gap-1 text-xs">
                        {a.status === 'agendado' && (
                          <button onClick={() => mudarStatus(a.id, 'confirmado')} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                        )}
                        <button onClick={() => setRemarcando(a)} className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-700 hover:bg-sky-100">Remarcar</button>
                        <button onClick={() => mudarStatus(a.id, 'realizado')} className="rounded-md bg-black/5 px-2 py-1 font-medium text-texto/70 hover:bg-black/10">Realizado</button>
                        <button onClick={() => mudarStatus(a.id, 'cancelado')} className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700 hover:bg-rose-100">Cancelar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgendamentoModal({ clinicId, profissionais, defaultProf, onClose, onSaved }: {
  clinicId: string; profissionais: Professional[]; defaultProf?: string | null; onClose: () => void; onSaved: () => void
}) {
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState(defaultProf ?? '')
  const [procedimento, setProcedimento] = useState('')
  const [data, setData] = useState<string | null>(null)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])

  async function salvar() {
    if (!patientId) { setErro('Selecione o paciente.'); return }
    if (!data) { setErro('Escolha a data no calendário.'); return }
    setSalvando(true); setErro(null)
    try {
      await createAppointment({
        clinicId, patientId, professionalId: professionalId || null, procedimento,
        inicio: toISO(data, horaInicio),
        fim: horaFim ? toISO(data, horaFim) : null,
        observacoes: obs,
      })
      onSaved()
    } catch { setErro('Não foi possível agendar.'); setSalvando(false) }
  }

  return (
    <Shell titulo="Novo agendamento" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Paciente *</label>
          <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Selecione…</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Profissional</label>
          <select className={field} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">— Não atribuído —</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Procedimento</label>
          <input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Avaliação, Toxina…" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Data *</label>
          <MonthCalendar value={data} onChange={setData} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Início</label><input type="time" className={field} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Fim</label><input type="time" className={field} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        {erro && <p className="text-sm text-secundaria">{erro}</p>}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Agendar'} />
      </div>
    </Shell>
  )
}

function RemarcarModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<string | null>(appt.inicio.slice(0, 10))
  const [horaInicio, setHoraInicio] = useState(new Date(appt.inicio).toTimeString().slice(0, 5))
  const [horaFim, setHoraFim] = useState(appt.fim ? new Date(appt.fim).toTimeString().slice(0, 5) : '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!data) return
    setSalvando(true)
    try {
      await rescheduleAppointment(appt.id, toISO(data, horaInicio), horaFim ? toISO(data, horaFim) : null)
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo={`Remarcar — ${appt.patients?.nome ?? 'paciente'}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-texto/60">Atual: {new Date(appt.inicio).toLocaleString('pt-BR')}</p>
        <MonthCalendar value={data} onChange={setData} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Novo início</label><input type="time" className={field} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Novo fim</label><input type="time" className={field} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
        </div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || !data} label={salvando ? 'Salvando…' : 'Remarcar'} />
      </div>
    </Shell>
  )
}

function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Footer({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{label}</button>
    </div>
  )
}
