import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { usePermissions } from '@/auth/PermissionsProvider'
import { useClinic } from '@/theme/ThemeProvider'

const NAV = [
  { to: '/clinica', label: 'Dashboard', end: true, perm: 'menu.dashboard' },
  { to: '/clinica/agenda', label: 'Agenda', perm: 'menu.agenda' },
  { to: '/clinica/pacientes', label: 'Pacientes', perm: 'menu.pacientes' },
  { to: '/clinica/documentos', label: 'Modelos de Documentos', perm: 'menu.documentos' },
  { to: '/clinica/estoque', label: 'Estoque', perm: 'menu.estoque' },
  { to: '/clinica/financeiro', label: 'Financeiro', perm: 'menu.financeiro' },
  { to: '/clinica/relatorios', label: 'Relatórios', perm: 'menu.relatorios' },
  { to: '/clinica/relacionamento', label: 'Relacionamento', perm: 'menu.relacionamento' },
  { to: '/clinica/crm', label: 'Comercial', perm: 'menu.crm' },
  { to: '/clinica/administrativo', label: 'Administrativo', perm: 'menu.administrativo' },
  { to: '/clinica/configuracoes', label: 'Configurações', perm: 'admin' },
]

export default function ClinicLayout() {
  const { profile, signOut } = useAuth()
  const { can } = usePermissions()
  const clinic = useClinic()
  const isAdmin = profile?.professional?.role === 'admin'
  const [menuAberto, setMenuAberto] = useState(false)

  // Configurações é exclusiva do admin; os demais itens seguem a matriz de permissões.
  const navVisivel = NAV.filter((item) => (item.perm === 'admin' ? isAdmin : can(item.perm)))

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

      <nav className="flex-1 space-y-1 px-3 py-2">
        <Link
          to="/assistente"
          onClick={() => setMenuAberto(false)}
          className="mb-1 block rounded-lg bg-primaria/10 px-3 py-2 text-sm font-medium text-primaria transition hover:bg-primaria/20"
        >
          🤖 Assistente
        </Link>
        {navVisivel.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMenuAberto(false)}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-primaria text-white' : 'text-texto/70 hover:bg-black/5'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-black/5 px-5 py-3 text-xs text-texto/60">
        <div className="truncate">{profile?.professional?.nome}</div>
        <div className="mb-2 uppercase tracking-wide text-texto/40">{profile?.professional?.role}</div>
        <button onClick={signOut} className="text-secundaria hover:underline">
          Sair
        </button>
      </div>
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
        {/* Top bar (só mobile) com botão de menu */}
        <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3 lg:hidden">
          <button
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
            className="rounded-lg p-1.5 text-texto hover:bg-black/5"
          >
            {/* ícone hambúrguer */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="truncate font-semibold text-texto">{clinic?.nome ?? 'Clínica'}</span>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
