import { supabase } from '@/lib/supabase'

export interface PackageSession {
  id: string
  package_id: string
  professional_id: string | null
  procedure_id: string | null
  data: string
  observacoes: string | null
  created_at: string
}

export interface TreatmentPackage {
  id: string
  patient_id: string
  professional_id: string | null
  procedure_type_id: string | null
  procedimento: string
  sessoes_compradas: number
  valor_total: number
  quote_id: string | null
  treatment_plan_id: string | null
  data: string
  observacoes: string | null
  ativo: boolean
  created_at: string
  /** Sessões já realizadas (nº de linhas em package_sessions), preenchido na listagem. */
  realizadas?: number
}

/** Lista os pacotes ativos do paciente com a contagem de sessões realizadas. */
export async function listPackages(patientId: string): Promise<TreatmentPackage[]> {
  const { data, error } = await supabase
    .from('treatment_packages')
    .select('*, package_sessions(id)')
    .eq('patient_id', patientId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p) => {
    const { package_sessions, ...rest } = p as TreatmentPackage & { package_sessions?: { id: string }[] }
    return { ...rest, realizadas: package_sessions?.length ?? 0 }
  })
}

export interface PackageInput {
  clinicId: string
  patientId: string
  professionalId?: string | null
  procedureTypeId?: string | null
  procedimento: string
  sessoesCompradas: number
  valorTotal?: number
  quoteId?: string | null
  treatmentPlanId?: string | null
  data?: string
  observacoes?: string | null
}

export async function createPackage(input: PackageInput): Promise<void> {
  const { error } = await supabase.from('treatment_packages').insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    professional_id: input.professionalId ?? null,
    procedure_type_id: input.procedureTypeId ?? null,
    procedimento: input.procedimento,
    sessoes_compradas: input.sessoesCompradas,
    valor_total: input.valorTotal ?? 0,
    quote_id: input.quoteId ?? null,
    treatment_plan_id: input.treatmentPlanId ?? null,
    data: input.data ?? undefined,
    observacoes: input.observacoes ?? null,
  })
  if (error) throw error
}

export async function updatePackage(id: string, patch: {
  procedimento?: string
  procedure_type_id?: string | null
  sessoes_compradas?: number
  valor_total?: number
  quote_id?: string | null
  treatment_plan_id?: string | null
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('treatment_packages').update(patch).eq('id', id)
  if (error) throw error
}

/** Remove (desativa) um pacote — soft delete, preserva o histórico de sessões. */
export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from('treatment_packages').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function listPackageSessions(packageId: string): Promise<PackageSession[]> {
  const { data, error } = await supabase
    .from('package_sessions')
    .select('*')
    .eq('package_id', packageId)
    .order('data', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addPackageSession(args: {
  clinicId: string
  packageId: string
  professionalId?: string | null
  procedureId?: string | null
  data?: string
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('package_sessions').insert({
    clinic_id: args.clinicId,
    package_id: args.packageId,
    professional_id: args.professionalId ?? null,
    procedure_id: args.procedureId ?? null,
    data: args.data ?? undefined,
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}

export async function deletePackageSession(id: string): Promise<void> {
  const { error } = await supabase.from('package_sessions').delete().eq('id', id)
  if (error) throw error
}
