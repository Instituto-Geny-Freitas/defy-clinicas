import type { ReactNode } from 'react'

/** Ícones de traço (estilo "outline") do portal do paciente — SVG inline, sem dependências. */
export type PortalIconName =
  | 'inicio' | 'anamnese' | 'agenda' | 'documentos' | 'plano' | 'exames'
  | 'evolucao' | 'relatorios' | 'financeiro' | 'lgpd' | 'imagem'

const PATHS: Record<PortalIconName, ReactNode> = {
  inicio: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></>),
  anamnese: (<><rect x="8" y="2.5" width="8" height="4" rx="1" /><path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h4" /></>),
  agenda: (<><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2.5v4" /><path d="M8 2.5v4" /><path d="M3 10h18" /></>),
  documentos: (<><path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z" /><path d="M14 2.5v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></>),
  plano: (<><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="m3 6 1.5 1.5L7 5" /><path d="m3 12 1.5 1.5L7 11" /><path d="m3 18 1.5 1.5L7 17" /></>),
  exames: (<><path d="M9 2.5h6" /><path d="M10 2.5v6.2L4.6 18.4A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.8-3.1L14 8.7V2.5" /><path d="M7.5 15h9" /></>),
  evolucao: (<><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></>),
  relatorios: (<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  financeiro: (<><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M16.5 15h2" /></>),
  lgpd: (<><path d="M12 22s8-3.5 8-10V5.5l-8-3-8 3V12c0 6.5 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  imagem: (<><path d="M14.5 4h-5L7.5 6.5H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-3.5z" /><circle cx="12" cy="13" r="3.5" /></>),
}

export function PortalIcon({ name, className = 'h-6 w-6' }: { name: PortalIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
