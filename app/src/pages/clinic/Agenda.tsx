import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/appointments'
import { listPatients } from '@/lib/patients'
import type { Patient } from '@/lib/types'
import ApptStatusBadge from '@/components/ApptStatusBadge'

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function Agenda() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [appts, setAppts] = useState<Appointment[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    const ontem = new Date(Date.now() - 86400000).toISOString()
    listAppointments(ontem).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [])

  async function mudarStatus(id: string, status: AppointmentStatus) {
    await updateAppointmentStatus(id, status)
    recarregar()
  }

  // Agrupa por dia
  const grupos = appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dia = a.inicio.slice(0, 10)
    ;(acc[dia] ??= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-texto">Agenda</h1>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo agendamento
        </button>
      </div>

      {modal && clinicId && (
        <NovoAgendamentoModal
          clinicId={clinicId}
          professionalId={profile?.professional?.id}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); recarregar() }}
        />
      )}

      {carregando ? (
        <p className="mt-4 text-sm text-texto/50">Carregando…</p>
      ) : appts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhum agendamento. Clique em “Novo agendamento”.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grupos).map(([dia, lista]) => (
            <div key={dia}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-texto/70">{dataLonga(dia + 'T12:00:00')}</h2>
              <div className="space-y-2">
                {lista.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-white p-4">
                    <div className="w-14 text-center">
                      <div className="text-lg font-semibold text-primaria">{hora(a.inicio)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-texto">{a.patients?.nome ?? 'Paciente'}</div>
                      <div className="text-sm text-texto/60">{a.procedimento ?? 'Atendimento'}</div>
                    </div>
                    <ApptStatusBadge status={a.status} />
                    {a.status !== 'cancelado' && a.status !== 'realizado' && (
                      <div className="flex gap-1 text-xs">
                        {a.status === 'agendado' && (
                          <button onClick={() => mudarStatus(a.id, 'confirmado')} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                        )}
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

function NovoAgendamentoModal({
  clinicId,
  professionalId,
  onClose,
  onSaved,
}: {
  clinicId: string
  professionalId?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState('')
  const [procedimento, setProcedimento] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listPatients().then(setPacientes).catch(() => {})
  }, [])

  async function salvar() {
    if (!patientId || !inicio) return
    setSalvando(true)
    try {
      await createAppointment({
        clinicId,
        patientId,
        professionalId,
        procedimento,
        inicio: new Date(inicio).toISOString(),
        fim: fim ? new Date(fim).toISOString() : null,
        observacoes: obs,
      })
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Novo agendamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Paciente *</label>
            <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecione…</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Procedimento</label>
            <input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Avaliação, Toxina…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Início *</label><input type="datetime-local" className={field} value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Fim</label><input type="datetime-local" className={field} value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
