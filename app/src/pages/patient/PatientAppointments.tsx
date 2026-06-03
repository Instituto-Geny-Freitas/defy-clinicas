import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listPatientAppointments, type Appointment } from '@/lib/appointments'
import ApptStatusBadge from '@/components/ApptStatusBadge'

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function PatientAppointments() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const patientId = profile?.patient?.id
  const [appts, setAppts] = useState<Appointment[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!patientId) return
    listPatientAppointments(patientId).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }, [patientId])

  const wpp = clinic?.whatsapp?.replace(/\D/g, '')

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Meus Agendamentos</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Suas consultas e sessões.</p>

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : appts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhuma consulta agendada.
        </p>
      ) : (
        <div className="space-y-2">
          {appts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-4">
              <div>
                <div className="text-sm font-medium capitalize text-texto">{quando(a.inicio)}</div>
                <div className="text-xs text-texto/60">{a.procedimento ?? 'Atendimento'}</div>
              </div>
              <ApptStatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}

      {wpp && (
        <a
          href={`https://wa.me/55${wpp}?text=${encodeURIComponent('Olá! Gostaria de agendar/remarcar um horário.')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-xl bg-primaria px-4 py-3 text-center text-sm font-semibold text-white"
        >
          Solicitar horário pelo WhatsApp
        </a>
      )}
    </div>
  )
}
