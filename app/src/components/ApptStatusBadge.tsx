import type { AppointmentStatus } from '@/lib/appointments'

const MAP: Record<AppointmentStatus, { label: string; cls: string }> = {
  agendado: { label: 'Agendado', cls: 'bg-sky-100 text-sky-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
  realizado: { label: 'Realizado', cls: 'bg-black/10 text-texto/60' },
  cancelado: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' },
  faltou: { label: 'Faltou', cls: 'bg-amber-100 text-amber-700' },
}

export default function ApptStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = MAP[status]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}
