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
  tipo: 'procedimento' | 'suplementacao'
  sessoes_compradas: number
  valor_total: number
  desconto: number
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
  tipo?: 'procedimento' | 'suplementacao'
  sessoesCompradas: number
  valorTotal?: number
  desconto?: number
  quoteId?: string | null
  treatmentPlanId?: string | null
  data?: string
  observacoes?: string | null
}

export async function createPackage(input: PackageInput): Promise<string> {
  const { data, error } = await supabase.from('treatment_packages').insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    professional_id: input.professionalId ?? null,
    procedure_type_id: input.procedureTypeId ?? null,
    procedimento: input.procedimento,
    tipo: input.tipo ?? 'procedimento',
    sessoes_compradas: input.sessoesCompradas,
    valor_total: input.valorTotal ?? 0,
    desconto: input.desconto ?? 0,
    quote_id: input.quoteId ?? null,
    treatment_plan_id: input.treatmentPlanId ?? null,
    data: input.data ?? undefined,
    observacoes: input.observacoes ?? null,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updatePackage(id: string, patch: {
  procedimento?: string
  procedure_type_id?: string | null
  tipo?: 'procedimento' | 'suplementacao'
  sessoes_compradas?: number
  valor_total?: number
  desconto?: number
  quote_id?: string | null
  treatment_plan_id?: string | null
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('treatment_packages').update(patch).eq('id', id)
  if (error) throw error
}

// ---- Itens do pacote (Pacotes 2.0) -----------------------------------------
export interface PackageItem {
  id: string
  package_id: string
  procedure_type_id: string | null
  active_ingredient_id: string | null
  nome: string
  preco_unit: number
  ordem: number
}
export interface PackageItemInput {
  id?: string
  procedure_type_id?: string | null
  active_ingredient_id?: string | null
  nome: string
  preco_unit: number
}

export async function listPackageItems(packageId: string): Promise<PackageItem[]> {
  const { data, error } = await supabase.from('treatment_package_items').select('*').eq('package_id', packageId).order('ordem').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function listPackageItemsForPackages(packageIds: string[]): Promise<PackageItem[]> {
  if (packageIds.length === 0) return []
  const { data, error } = await supabase.from('treatment_package_items').select('*').in('package_id', packageIds).order('ordem')
  if (error) throw error
  return data ?? []
}

/** Nº de realizações vinculadas a cada item do pacote (procedimentos + suplementações). */
export async function packageItemsRealizadas(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {}
  const [{ data: p }, { data: s }] = await Promise.all([
    supabase.from('procedures_log').select('treatment_package_item_id').in('treatment_package_item_id', itemIds),
    supabase.from('supplementations').select('treatment_package_item_id').in('treatment_package_item_id', itemIds),
  ])
  const map: Record<string, number> = {}
  for (const r of [...(p ?? []), ...(s ?? [])]) {
    const id = (r as { treatment_package_item_id: string | null }).treatment_package_item_id
    if (id) map[id] = (map[id] ?? 0) + 1
  }
  return map
}

/** Itens do pacote com saldo (sessoes_compradas − realizadas) por item. */
export async function listPackageItemsComSaldo(packageId: string, sessoesCompradas: number): Promise<(PackageItem & { realizadas: number; saldo: number })[]> {
  const items = await listPackageItems(packageId)
  const realiz = await packageItemsRealizadas(items.map((i) => i.id))
  return items.map((i) => { const r = realiz[i.id] ?? 0; return { ...i, realizadas: r, saldo: Math.max(0, sessoesCompradas - r) } })
}

/** Salva os itens do pacote (diff preservando ids; bloqueia remover item já realizado). */
export async function savePackageItems(clinicId: string, packageId: string, items: PackageItemInput[]): Promise<void> {
  const existentes = await listPackageItems(packageId)
  const manter = new Set(items.filter((i) => i.id).map((i) => i.id as string))
  const remover = existentes.filter((e) => !manter.has(e.id))
  if (remover.length > 0) {
    const realiz = await packageItemsRealizadas(remover.map((r) => r.id))
    const comUso = remover.filter((r) => (realiz[r.id] ?? 0) > 0)
    if (comUso.length > 0) throw new Error(`Não é possível remover itens já realizados: ${comUso.map((r) => r.nome).join(', ')}.`)
    const { error } = await supabase.from('treatment_package_items').delete().in('id', remover.map((r) => r.id))
    if (error) throw error
  }
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]
    const row = {
      clinic_id: clinicId, package_id: packageId,
      procedure_type_id: it.procedure_type_id ?? null, active_ingredient_id: it.active_ingredient_id ?? null,
      nome: it.nome, preco_unit: it.preco_unit, ordem: idx,
    }
    if (it.id) { const { error } = await supabase.from('treatment_package_items').update(row).eq('id', it.id); if (error) throw error }
    else { const { error } = await supabase.from('treatment_package_items').insert(row); if (error) throw error }
  }
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
