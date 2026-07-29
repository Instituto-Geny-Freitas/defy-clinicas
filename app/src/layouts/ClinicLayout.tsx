import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { usePermissions } from '@/auth/PermissionsProvider'
import { useClinic } from '@/theme/ThemeProvider'

// Itens principais (topo do menu), na ordem definida.
const NAV_MAIN = [
  { to: '/clinica', label: 'Dashboard', end: true, perm: 'menu.dashboard' },
  { to: '/clinica/agenda', label: 'Agenda', perm: 'menu.agenda' },
  { to: '/clinica/pacientes', label: 'Pacientes', perm: 'menu.pacientes' },
  { to: '/clinica/relacionamento', label: 'Relacionamento', perm: 'menu.relacionamento' },
  { to: '/clinica/crm', label: 'Comercial', perm: 'menu.crm' },
  { to: '/clinica/financeiro', label: 'Financeiro', perm: 'menu.financeiro' },
  { to: '/clinica/relatorios', label: 'Relatórios', perm: 'menu.relatorios' },
]

// Grupo "Gestão" (colapsável). Reuniões Internas entra na Fase 2.
const NAV_GESTAO = [
  { to: '/clinica/administrativo', label: 'Administrativo', perm: 'menu.administrativo' },
  { to: '/clinica/estoque', label: 'Estoque', perm: 'menu.estoque' },
  { to: '/clinica/configuracoes', label: 'Configurações', perm: 'admin' },
  { to: '/clinica/reunioes', label: 'Reuniões Internas', perm: 'menu.reunioes' },
  { to: '/clinica/atividades', label: 'Atividades Internas', perm: 'menu.atividades' },
  { to: '/clinica/documentos', label: 'Modelos de Documentos', perm: 'menu.documentos' },
]

export default function ClinicLayout() {
  const { profile, signOut } = useAuth()
  const { can } = usePermissions()
  const clinic = useClinic()
  const isAdmin = profile?.professional?.role === 'admin'
  const [menuAberto, setMenuAberto] = useState(false)
  const [gestaoAberto, setGestaoAberto] = useState(true)

  // Configurações é exclusiva do admin; os demais itens seguem a matriz de permissões.
  const podeVer = (item: { perm: string }) => (item.perm === 'admin' ? isAdmin : can(item.perm))
  const mainVisivel = NAV_MAIN.filter(podeVer)
  const gestaoVisivel = NAV_GESTAO.filter(podeVer)

  const renderItem = (item: { to: string; label: string; end?: boolean }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setMenuAberto(false)}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-primaria text-white' : 'text-texto/70 hover:bg-black/5'}`
      }
    >
      {item.label}
    </NavLink>
  )

  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-5 py-4">
        {clinic?.logo_url ? (
          <img src={clinic.logo_url} alt="" className="h-9 w-9 rounded object-contain" />
        ) : (
          <span className="text-xl">💚</span>
        )}
        <span className="truncate font-semibold text-texto">{clinic?.nome ?? 'Clínica'}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <Link
          to="/assistente"
          onClick={() => setMenuAberto(false)}
          className="mb-1 block rounded-lg bg-primaria/10 px-3 py-2 text-sm font-medium text-primaria transition hover:bg-primaria/20"
        >
          🤖 Assistente
        </Link>
        {mainVisivel.map(renderItem)}
        {gestaoVisivel.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setGestaoAberto((v) => !v)}
              className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-texto/70 transition hover:bg-black/5"
              aria-expanded={gestaoAberto}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 transition-transform ${gestaoAberto ? 'rotate-90' : ''}`}>
                <polyline points="9 6 15 12 9 18" />
              </svg>
              <span>Gestão</span>
            </button>
            {gestaoAberto && (
              <div className="ml-3 mt-1 space-y-1 border-l border-black/10 pl-2">
                {gestaoVisivel.map(renderItem)}
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  )

  return (
    <div className="flex min-h-full">
      {/* Sidebar fixa no desktop (lg+) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/5 bg-white lg:flex">
        {sidebar}
      </aside>

      {/* Drawer no mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (todas as telas): menu (mobile) à esquerda; usuário + Sair à direita */}
        <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
          <button
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
            className="rounded-lg p-1.5 text-texto hover:bg-black/5 lg:hidden"
          >
            {/* ícone hambúrguer */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="truncate font-semibold text-texto lg:hidden">{clinic?.nome ?? 'Clínica'}</span>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="max-w-[150px] truncate text-sm font-medium text-texto sm:max-w-[260px]">{profile?.professional?.nome}</div>
              {profile?.professional?.role && <div className="hidden text-[11px] uppercase tracking-wide text-texto/40 sm:block">{profile.professional.role}</div>}
            </div>
            <button
              onClick={signOut}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-texto/70 transition hover:bg-black/5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
