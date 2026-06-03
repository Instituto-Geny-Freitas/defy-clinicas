import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'

const NAV = [
  { to: '/clinica', label: 'Dashboard', end: true },
  { to: '/clinica/agenda', label: 'Agenda' },
  { to: '/clinica/pacientes', label: 'Pacientes' },
  { to: '/clinica/documentos', label: 'Modelos de Documentos' },
  { to: '/clinica/estoque', label: 'Estoque' },
  { to: '/clinica/financeiro', label: 'Financeiro' },
  { to: '/clinica/configuracoes', label: 'Configurações' },
]

export default function ClinicLayout() {
  const { profile, signOut } = useAuth()
  const clinic = useClinic()
  const [menuAberto, setMenuAberto] = useState(false)

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
        {NAV.map((item) => (
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
