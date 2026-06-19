import { supabase } from '@/lib/supabase'

export interface Ativo {
  ativo: string
  quantidade: string
  unidade: string
}

export interface FormulationPrescription {
  id: string
  patient_id: string
  formulation_id: string | null
  nome: string | null
  composicao: Ativo[]
  posologia: string | null
  data: string
  created_at: string
  formulations?: { nome: string } | null
}

export async function listPrescriptions(patientId: string): Promise<FormulationPrescription[]> {
  const { data, error } = await supabase
    .from('formulation_prescriptions')
    .select('*, formulations(nome)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Designa (prescreve) uma fórmula da biblioteca para o paciente. */
export async function prescribeFormula(args: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  formula: FormulationLib
}): Promise<void> {
  const { error } = await supabase.from('formulation_prescriptions').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    formulation_id: args.formula.id,
    nome: args.formula.nome,
    composicao: args.formula.composicao,
    posologia: args.formula.posologia,
  })
  if (error) throw error
}

export async function deletePrescription(id: string): Promise<void> {
  const { error } = await supabase.from('formulation_prescriptions').delete().eq('id', id)
  if (error) throw error
}

export async function updatePrescription(
  id: string,
  input: { nome?: string | null; composicao?: Ativo[]; posologia?: string | null },
): Promise<void> {
  const { error } = await supabase.from('formulation_prescriptions').update(input).eq('id', id)
  if (error) throw error
}

// ---- Biblioteca de fórmulas (CRUD — Configurações) --------------------------
export interface FormulationLib {
  id: string
  nome: string
  forma: string | null
  composicao: Ativo[]
  posologia: string | null
}

export interface FormulaInput {
  nome: string
  forma?: string | null
  composicao: Ativo[]
  posologia?: string | null
}

export async function listFormulationLibrary(): Promise<FormulationLib[]> {
  const { data, error } = await supabase
    .from('formulations')
    .select('id, nome, forma, composicao, posologia')
    .eq('is_biblioteca', true)
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}

export async function createFormulation(clinicId: string, input: FormulaInput): Promise<void> {
  const { error } = await supabase.from('formulations').insert({ clinic_id: clinicId, is_biblioteca: true, ...input })
  if (error) throw error
}

export async function updateFormulation(id: string, input: FormulaInput): Promise<void> {
  const { error } = await supabase.from('formulations').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteFormulation(id: string): Promise<void> {
  const { error } = await supabase.from('formulations').delete().eq('id', id)
  if (error) throw error
}
