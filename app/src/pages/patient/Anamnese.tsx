import { useAuth } from '@/auth/AuthProvider'
import AnamnesisForm from '@/forms/AnamnesisForm'

export default function Anamnese() {
  const { profile } = useAuth()
  const patient = profile?.patient

  if (!patient) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Minha Anamnese</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">
        Preencha sua ficha antes da consulta. Você pode salvar e continuar depois.
      </p>

      <AnamnesisForm
        patientId={patient.id}
        clinicId={patient.clinic_id}
        preenchidoPor="paciente"
        withConsent
        prefill={patient.estilo_trabalho ? { estilo_trabalho: patient.estilo_trabalho } : undefined}
      />
    </div>
  )
}
