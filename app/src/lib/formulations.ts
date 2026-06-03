import { supabase } from '@/lib/supabase'

export interface Ativo {
  ativo: string
  quantidade: string
  unidade: string
}

export interface FormulationPrescription {
  id: string
  patient_id: string
  composicao: Ativo[]
  posologia: string | null
  data: string
  created_at: string
}

export async function listPrescriptions(patientId: string): Promise<FormulationPrescription[]> {
  const { data, error } = await supabase
    .from('formulation_prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  composicao: Ativo[]
  posologia: string
  salvarBiblioteca?: boolean
  nomeBiblioteca?: string
}

export async function createPrescription(args: CreateArgs): Promise<void> {
  const { error } = await supabase.from('formulation_prescriptions').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    composicao: args.composicao,
    posologia: args.posologia,
  })
  if (error) throw error

  // opcional: guarda a fórmula na biblioteca reutilizável
  if (args.salvarBiblioteca && args.nomeBiblioteca) {
    await supabase.from('formulations').insert({
      clinic_id: args.clinicId,
      nome: args.nomeBiblioteca,
      composicao: args.composicao,
      posologia: args.posologia,
      is_biblioteca: true,
    })
  }
}

export interface FormulationLib {
  id: string
  nome: string
  composicao: Ativo[]
  posologia: string | null
}

export async function listFormulationLibrary(): Promise<FormulationLib[]> {
  const { data, error } = await supabase
    .from('formulations')
    .select('id, nome, composicao, posologia')
    .eq('is_biblioteca', true)
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}
