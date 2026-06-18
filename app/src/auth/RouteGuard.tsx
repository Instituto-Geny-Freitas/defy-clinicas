import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { usePermissions } from '@/auth/PermissionsProvider'

/** Rotas do menu na ordem de preferência para o fallback. */
const MENU_ROUTES: { path: string; perm: string }[] = [
  { path: '/clinica', perm: 'menu.dashboard' },
  { path: '/clinica/agenda', perm: 'menu.agenda' },
  { path: '/clinica/pacientes', perm: 'menu.pacientes' },
  { path: '/clinica/documentos', perm: 'menu.documentos' },
  { path: '/clinica/estoque', perm: 'menu.estoque' },
  { path: '/clinica/financeiro', perm: 'menu.financeiro' },
  { path: '/clinica/relatorios', perm: 'menu.relatorios' },
  { path: '/clinica/configuracoes', perm: 'admin' },
]

/** Protege uma rota da clínica: se o nível não tem a permissão, redireciona para
 *  a primeira página permitida. A segurança real dos dados continua na RLS. */
export function RouteGuard({ perm, children }: { perm: string; children: ReactNode }) {
  const { profile } = useAuth()
  const { can, matrix } = usePermissions()
  const isAdmin = profile?.professional?.role === 'admin'

  // Aguarda a matriz carregar (não-admin) para não redirecionar indevidamente.
  if (!isAdmin && matrix === null) return <p className="p-6 text-sm text-texto/50">Carregando…</p>

  const allowed = perm === 'admin' ? isAdmin : can(perm)
  if (allowed) return <>{children}</>

  const fallback = MENU_ROUTES.find((r) => (r.perm === 'admin' ? isAdmin : can(r.perm)))?.path ?? '/clinica'
  return <Navigate to={fallback} replace />
}
