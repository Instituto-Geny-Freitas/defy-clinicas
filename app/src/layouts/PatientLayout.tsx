import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'

const NAV = [
  { to: '/portal', label: 'Início', end: true },
  { to: '/portal/agendamentos', label: 'Agenda' },
  { to: '/portal/anamnese', label: 'Anamnese' },
  { to: '/portal/documentos', label: 'Documentos' },
  { to: '/portal/evolucao', label: 'Evolução' },
  { to: '/portal/relatorios', label: 'Relatórios' },
  { to: '/portal/financeiro', label: 'Financeiro' },
]

export default function PatientLayout() {
  const { profile, signOut } = useAuth()
  const clinic = useClinic()

  return (
    <div className="min-h-full bg-black/[0.03]">
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <div className="flex items-center gap-2">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
          ) : (
            <span className="text-lg">💚</span>
          )}
          <span className="text-sm font-semibold text-texto">{clinic?.nome ?? 'Clínica'}</span>
        </div>
        <button onClick={signOut} className="text-xs text-secundaria hover:underline">
          Sair
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 pb-24">
        <p className="mb-3 text-sm text-texto/60">Olá, {profile?.patient?.nome ?? 'paciente'} 👋</p>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-black/5 bg-white px-2 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-lg px-2 py-1 text-xs transition ${
                isActive ? 'font-semibold text-primaria' : 'text-texto/50'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
    </div>
  )
}
