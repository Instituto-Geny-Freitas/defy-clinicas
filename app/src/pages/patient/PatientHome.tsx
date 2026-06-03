import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listDueNotifications, markNotificationRead, type AppNotification } from '@/lib/notifications'
import { enablePush, pushSupported } from '@/lib/push'

export default function PatientHome() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const patientId = profile?.patient?.id
  const wpp = clinic?.whatsapp?.replace(/\D/g, '')
  const [avisos, setAvisos] = useState<AppNotification[]>([])
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  function recarregar() {
    if (!patientId) return
    listDueNotifications(patientId).then(setAvisos).catch(() => {})
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
                  <div className="text-sm text-texto/70">{String(a.payload?.mensagem ?? '')}</div>
                </div>
                <button onClick={() => marcar(a.id)} className="shrink-0 text-xs font-medium text-primaria hover:underline">
                  OK
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-black/5 p-4">
        <h2 className="text-sm font-semibold text-texto">Próxima consulta</h2>
        <p className="mt-1 text-sm text-texto/60">Veja em “Agenda”.</p>
      </section>

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
