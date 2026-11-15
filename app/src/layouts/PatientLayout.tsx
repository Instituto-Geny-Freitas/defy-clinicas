import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { PortalIcon, type PortalIconName } from '@/components/PortalIcons'
import { anamneseSituacao, getLatestAnamnesis, type AnamneseSituacao } from '@/lib/anamnesis'

// Mesmas rotas de antes; a Anamnese sobe para 2º lugar para ficar mais acessível.
const NAV: { to: string; label: string; icon: PortalIconName; end?: boolean }[] = [
  { to: '/portal', label: 'Início', icon: 'inicio', end: true },
  { to: '/portal/anamnese', label: 'Anamnese', icon: 'anamnese' },
  { to: '/portal/agendamentos', label: 'Agenda', icon: 'agenda' },
  { to: '/portal/documentos', label: 'Documentos', icon: 'documentos' },
  { to: '/portal/plano', label: 'Plano', icon: 'plano' },
  { to: '/portal/exames', label: 'Exames', icon: 'exames' },
  { to: '/portal/evolucao', label: 'Evolução', icon: 'evolucao' },
  { to: '/portal/relatorios', label: 'Relatórios', icon: 'relatorios' },
  { to: '/portal/financeiro', label: 'Financeiro', icon: 'financeiro' },
  { to: '/portal/lgpd', label: 'LGPD', icon: 'lgpd' },
  { to: '/portal/imagem', label: 'Uso de imagem', icon: 'imagem' },
]

export default function PatientLayout() {
  const { profile, signOut } = useAuth()
  const clinic = useClinic()
  const location = useLocation()
  const patientId = profile?.patient?.id
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [podeEsq, setPodeEsq] = useState(false)
  const [podeDir, setPodeDir] = useState(false)
  const [anamnese, setAnamnese] = useState<AnamneseSituacao | null>(null)

  // Situação da anamnese (badge no ícone). Reconsulta ao trocar de tela para
  // refletir na hora quando o paciente salva a ficha.
  useEffect(() => {
    if (!patientId) return
    getLatestAnamnesis(patientId)
      .then((a) => setAnamnese(anamneseSituacao(a?.updated_at ?? null)))
      .catch(() => {})
  }, [patientId, location.pathname])

  function atualizarSetas() {
    const el = trilhoRef.current
    if (!el) return
    setPodeEsq(el.scrollLeft > 4)
    setPodeDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    atualizarSetas()
    window.addEventListener('resize', atualizarSetas)
    return () => window.removeEventListener('resize', atualizarSetas)
  }, [])

  // Mantém o ícone da tela atual visível no carrossel.
  useEffect(() => {
    const ativo = trilhoRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    ativo?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    const t = setTimeout(atualizarSetas, 350)
    return () => clearTimeout(t)
  }, [location.pathname])

  function rolar(dir: -1 | 1) {
    trilhoRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })
  }

  const anamneseAlerta = anamnese === 'pendente' || anamnese === 'desatualizada'

  return (
    <div className="min-h-full bg-black/[0.03]">
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white shadow-sm">
      {/* Cabeçalho + carrossel de acesso (fixos no topo) */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <header className="flex items-center justify-between px-4 py-3">
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

        <nav className="relative" aria-label="Menu do paciente">
          {podeEsq && (
            <button
              onClick={() => rolar(-1)}
              aria-label="Ver opções anteriores"
              className="absolute left-0 top-0 z-10 flex h-full w-8 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-1 text-texto/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 6 9 12 15 18" /></svg>
            </button>
          )}
          <div
            ref={trilhoRef}
            onScroll={atualizarSetas}
            className="no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-1.5 overflow-x-auto px-3 pb-3 pt-1"
          >
            {NAV.map((item) => {
              const ehAnamnese = item.icon === 'anamnese'
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative flex w-[4.6rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] leading-tight transition ${
                      isActive
                        ? 'bg-primaria font-semibold text-white shadow-sm'
                        : ehAnamnese && anamneseAlerta
                          ? 'bg-amber-50 font-medium text-amber-800 ring-1 ring-amber-200'
                          : 'text-texto/70 hover:bg-black/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-white/15' : ehAnamnese && anamneseAlerta ? 'bg-amber-100' : 'bg-black/[0.04]'}`}>
                        <PortalIcon name={item.icon} />
                      </span>
                      <span>{item.label}</span>
                      {ehAnamnese && anamneseAlerta && !isActive && (
                        <span className="absolute right-2.5 top-1.5 h-2.5 w-2.5 rounded-full bg-secundaria ring-2 ring-white" aria-label="Anamnese pendente" />
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
          {podeDir && (
            <button
              onClick={() => rolar(1)}
              aria-label="Ver mais opções"
              className="absolute right-0 top-0 z-10 flex h-full w-8 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-1 text-texto/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
            </button>
          )}
        </nav>
      </div>

      <main className="flex-1 overflow-auto p-4 pb-8">
        <p className="mb-3 text-sm text-texto/60">Olá, {profile?.patient?.nome ?? 'paciente'} 👋</p>
        <Outlet />
      </main>
    </div>
    </div>
  )
}
