import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { PermissionsProvider } from '@/auth/PermissionsProvider'
import Login from '@/pages/Login'
import ForcePasswordChange from '@/pages/ForcePasswordChange'
import ClinicLayout from '@/layouts/ClinicLayout'
import PatientLayout from '@/layouts/PatientLayout'
import Dashboard from '@/pages/clinic/Dashboard'
import PatientsList from '@/pages/clinic/PatientsList'
import PatientDetail from '@/pages/clinic/PatientDetail'
import Inventory from '@/pages/clinic/Inventory'
import Agenda from '@/pages/clinic/Agenda'
import Finance from '@/pages/clinic/Finance'
import Reports from '@/pages/clinic/Reports'
import Settings from '@/pages/clinic/Settings'
import Templates from '@/pages/clinic/Templates'
import PatientHome from '@/pages/patient/PatientHome'
import Anamnese from '@/pages/patient/Anamnese'
import PatientDocuments from '@/pages/patient/PatientDocuments'
import PatientAppointments from '@/pages/patient/PatientAppointments'
import PatientFinance from '@/pages/patient/PatientFinance'
import PatientEvolution from '@/pages/patient/PatientEvolution'
import PatientReports from '@/pages/patient/PatientReports'
import PatientLabs from '@/pages/patient/PatientLabs'
import PatientLgpd from '@/pages/patient/PatientLgpd'

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center text-sm text-texto/60">{children}</div>
}

export default function App() {
  const { session, profile, loading, recoveryMode } = useAuth()

  if (loading) return <FullScreen>Carregando…</FullScreen>
  // Recuperação de senha (link do e-mail) — antes de tudo, exige nova senha.
  if (recoveryMode && session) return <ForcePasswordChange reason="recuperacao" />
  if (!session) return <Login />

  // Conta autenticada mas ainda não vinculada a profissional/paciente.
  if (profile?.kind === 'unknown') {
    return (
      <FullScreen>
        <div className="max-w-sm rounded-xl border border-black/5 bg-white p-6 text-center">
          <p className="text-texto">Sua conta ainda não está vinculada à clínica.</p>
          <p className="mt-1 text-sm text-texto/60">Entre em contato com a recepção para concluir o cadastro.</p>
        </div>
      </FullScreen>
    )
  }

  const isStaff = profile?.kind === 'staff'

  // Senha provisória + login por senha (não Google) → força redefinição.
  const provider = session.user.app_metadata?.provider
  const senhaProvisoria =
    (profile?.kind === 'patient' && profile.patient?.senha_provisoria) ||
    (profile?.kind === 'staff' && profile.professional?.senha_provisoria)
  if (senhaProvisoria && provider !== 'google') {
    return <ForcePasswordChange reason="provisoria" />
  }

  return (
    <PermissionsProvider>
    <BrowserRouter>
      <Routes>
        {isStaff ? (
          <Route path="/clinica" element={<ClinicLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="pacientes" element={<PatientsList />} />
            <Route path="pacientes/:id" element={<PatientDetail />} />
            <Route path="documentos" element={<Templates />} />
            <Route path="estoque" element={<Inventory />} />
            <Route path="financeiro" element={<Finance />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>
        ) : (
          <Route path="/portal" element={<PatientLayout />}>
            <Route index element={<PatientHome />} />
            <Route path="agendamentos" element={<PatientAppointments />} />
            <Route path="anamnese" element={<Anamnese />} />
            <Route path="documentos" element={<PatientDocuments />} />
            <Route path="exames" element={<PatientLabs />} />
            <Route path="evolucao" element={<PatientEvolution />} />
            <Route path="relatorios" element={<PatientReports />} />
            <Route path="lgpd" element={<PatientLgpd />} />
            <Route path="financeiro" element={<PatientFinance />} />
          </Route>
        )}

        <Route path="*" element={<Navigate to={isStaff ? '/clinica' : '/portal'} replace />} />
      </Routes>
    </BrowserRouter>
    </PermissionsProvider>
  )
}
