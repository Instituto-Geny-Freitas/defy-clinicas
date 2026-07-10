import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listDueNotifications, markNotificationRead, type AppNotification } from '@/lib/notifications'
import { listPatientAppointments, updateAppointmentStatus, type Appointment } from '@/lib/appointments'
import { listPackages, type TreatmentPackage } from '@/lib/packages'
import { brl } from '@/lib/finance'
import NpsCard from './NpsCard'
import { enablePush, pushSupported } from '@/lib/push'

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function PatientHome() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const patient = profile?.patient
  const patientId = patient?.id
  const wpp = clinic?.whatsapp?.replace(/\D/g, '')
  const [avisos, setAvisos] = useState<AppNotification[]>([])
  const [proxima, setProxima] = useState<Appointment | null>(null)
  const [pacotes, setPacotes] = useState<TreatmentPackage[]>([])
  const [ultimoRealizado, setUltimoRealizado] = useState<Appointment | null>(null)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  function recarregar() {
    if (!patientId) return
    listDueNotifications(patientId).then(setAvisos).catch(() => {})
    listPackages(patientId).then(setPacotes).catch(() => {})
    listPatientAppointments(patientId)
      .then((appts) => {
        const agora = Date.now()
        const futura = appts
          .filter((a) => a.status !== 'cancelado' && a.status !== 'realizado' && new Date(a.inicio).getTime() >= agora)
          .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0]
        setProxima(futura ?? null)
        const realizado = appts
          .filter((a) => a.status === 'realizado')
          .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0]
        setUltimoRealizado(realizado ?? null)
      })
      .catch(() => {})
  }
  useEffect(recarregar, [patientId])

  async function ativarPush() {
    setPushMsg(null)
    const r = await enablePush()
    setPushMsg(r.ok ? 'Notificações ativadas neste aparelho! ✅' : r.motivo ?? 'Não foi possível ativar.')
  }

  const naoLidos = avisos.filter((a) => a.status !== 'lido')

  async function marcar(id: string) {
    await markNotificationRead(id)
    recarregar()
  }

  async function confirmarProxima() {
    if (!proxima) return
    await updateAppointmentStatus(proxima.id, 'confirmado')
    recarregar()
  }

  async function confirmarAviso(n: AppNotification) {
    if (n.appointment_id) await updateAppointmentStatus(n.appointment_id, 'confirmado').catch(() => {})
    await markNotificationRead(n.id)
    recarregar()
  }

  return (
    <div className="space-y-4">
      {naoLidos.length > 0 && (
        <section className="rounded-xl border border-primaria/20 bg-primaria/5 p-4">
          <h2 className="mb-2 text-sm font-semibold text-texto">🔔 Avisos ({naoLidos.length})</h2>
          <ul className="space-y-2">
            {naoLidos.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-white p-3">
                <div>
                  <div className="text-sm font-medium text-texto">{a.titulo}</div>
                  <div className="text-sm text-texto/70">{String(a.payload?.mensagem ?? (a.tipo === 'lembrete_consulta' ? 'Confirme sua presença na próxima consulta.' : ''))}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.tipo === 'lembrete_consulta' && a.appointment_id && (
                    <button onClick={() => confirmarAviso(a)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
                      Confirmar presença
                    </button>
                  )}
                  <button onClick={() => marcar(a.id)} className="text-xs font-medium text-primaria hover:underline">OK</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-black/5 p-4">
        <h2 className="text-sm font-semibold text-texto">Próxima consulta</h2>
        {proxima ? (
          <div className="mt-1">
            <p className="text-sm font-medium capitalize text-texto">{fmtDataHora(proxima.inicio)}</p>
            {proxima.procedimento && <p className="text-sm text-texto/60">{proxima.procedimento}</p>}
            <p className="mt-0.5 text-xs text-texto/50">Situação: {proxima.status}</p>
            {proxima.status === 'agendado' ? (
              <button onClick={confirmarProxima} className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                Confirmar presença
              </button>
            ) : proxima.status === 'confirmado' && (
              <p className="mt-1 text-xs font-medium text-emerald-600">✓ Presença confirmada</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-texto/60">Nenhuma consulta agendada. Solicite em “Agenda”.</p>
        )}
      </section>

      {patient && (
        <NpsCard
          clinicId={patient.clinic_id}
          patientId={patient.id}
          appointmentId={ultimoRealizado?.id}
          elegivel={!!ultimoRealizado}
        />
      )}

      {pacotes.length > 0 && (
        <section className="rounded-xl border border-black/5 p-4">
          <h2 className="mb-2 text-sm font-semibold text-texto">Meus pacotes</h2>
          <div className="space-y-2">
            {pacotes.map((p) => {
              const feitas = p.realizadas ?? 0
              const restantes = Math.max(0, p.sessoes_compradas - feitas)
              const pct = p.sessoes_compradas > 0 ? Math.min(100, Math.round((feitas / p.sessoes_compradas) * 100)) : 0
              const concluido = restantes === 0
              const valorTotal = Number(p.valor_total)
              const valorUtilizado = p.sessoes_compradas > 0 ? Math.round((valorTotal * feitas / p.sessoes_compradas) * 100) / 100 : 0
              const valorRestante = Math.max(0, valorTotal - valorUtilizado)
              return (
                <div key={p.id} className="rounded-lg bg-white p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-texto">{p.procedimento}</span>
                    <span className={concluido ? 'text-emerald-600' : 'text-texto/70'}>
                      {concluido ? 'Concluído' : <><strong>{restantes}</strong> de {p.sessoes_compradas} restantes</>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/5">
                    <div className={`h-full rounded-full ${concluido ? 'bg-emerald-500' : 'bg-primaria'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-texto/50">
                    <span>{feitas} sessão(ões) realizada(s)</span>
                    {valorTotal > 0 && <span>· Total {brl(valorTotal)} · Utilizado {brl(valorUtilizado)} · Restante <strong className="text-texto/70">{brl(valorRestante)}</strong></span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {pushSupported() && (
        <section className="rounded-xl border border-black/5 p-4">
          <h2 className="text-sm font-semibold text-texto">Notificações</h2>
          <p className="mt-1 text-sm text-texto/60">Receba avisos de cuidados e lembretes mesmo com o app fechado.</p>
          <button onClick={ativarPush} className="mt-2 rounded-lg border border-primaria/30 px-3 py-2 text-sm font-medium text-primaria hover:bg-primaria/5">
            Ativar notificações neste aparelho
          </button>
          {pushMsg && <p className="mt-2 text-sm text-texto/70">{pushMsg}</p>}
        </section>
      )}

      {wpp && (
        <a
          href={`https://wa.me/55${wpp}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl bg-primaria px-4 py-3 text-center text-sm font-semibold text-white"
        >
          Falar com a clínica no WhatsApp
        </a>
      )}
    </div>
  )
}
