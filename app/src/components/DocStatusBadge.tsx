import type { DocStatus } from '@/lib/documents'

const MAP: Record<DocStatus, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-black/10 text-texto/60' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  lido: { label: 'Lido', cls: 'bg-sky-100 text-sky-700' },
  assinado: { label: 'Assinado', cls: 'bg-emerald-100 text-emerald-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' },
}

export default function DocStatusBadge({ status }: { status: DocStatus }) {
  const s = MAP[status]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}
