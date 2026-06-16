import { useEffect, useMemo, useState } from 'react'
import { listPatientAppointments, type Appointment, type AppointmentStatus } from '@/lib/appointments'
import MonthCalendar from '@/components/MonthCalendar'
import ApptStatusBadge from '@/components/ApptStatusBadge'

const ENCERRADOS: AppointmentStatus[] = ['realizado', 'cancelado', 'faltou']
const ymd = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function PatientAgendaPanel({ patientId }: { patientId: string }) {
  const [appts, setAppts] = useState<Appointment[]>([])
  const [carregando, setCarregando] = useState(true)
  const [diaSel, setDiaSel] = useState<string | null>(null)

  useEffect(() => {
    listPatientAppointments(patientId).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }, [patientId])

  const marcados = useMemo(() => new Set(appts.map((a) => ymd(a.inicio))), [appts])

  // Ordena: ativos (agendado/confirmado) por data crescente; encerrados no final, mais recentes primeiro.
  const ordenados = useMemo(() => {
    const ativos = appts.filter((a) => !ENCERRADOS.includes(a.status)).sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    const fim = appts.filter((a) => ENCERRADOS.includes(a.status)).sort((a, b) => +new Date(b.inicio) - +new Date(a.inicio))
    return [...ativos, ...fim]
  }, [appts])

  const lista = diaSel ? ordenados.filter((a) => ymd(a.inicio) === diaSel) : ordenados

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-texto/70">Calendário do paciente</h3>
        <MonthCalendar value={diaSel} onChange={(d) => setDiaSel((cur) => (cur === d ? null : d))} marcados={marcados} />
        {diaSel && (
          <button onClick={() => setDiaSel(null)} className="mt-2 text-xs font-medium text-primaria hover:underline">
            Ver todos os agendamentos
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-texto/70">
          Agendamentos {diaSel ? `· ${diaSel.split('-').reverse().join('/')}` : `(${ordenados.length})`}
        </h3>
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
            {diaSel ? 'Nenhum agendamento neste dia.' : 'Nenhum agendamento para este paciente.'}
          </p>
        ) : (
          <div className="space-y-2">
            {lista.map((a) => {
              const encerrado = ENCERRADOS.includes(a.status)
              return (
                <div key={a.id} className={`flex items-center justify-between rounded-xl border border-black/5 p-3 ${encerrado ? 'bg-black/[0.02] opacity-80' : 'bg-white'}`}>
                  <div>
                    <div className="text-sm font-medium capitalize text-texto">{fmt(a.inicio)}</div>
                    {a.procedimento && <div className="text-xs text-texto/60">{a.procedimento}</div>}
                    {a.observacoes && <div className="text-xs text-texto/50">{a.observacoes}</div>}
                  </div>
                  <ApptStatusBadge status={a.status} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
