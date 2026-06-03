import { supabase } from '@/lib/supabase'

export interface Supplementation {
  id: string
  patient_id: string
  medicacao: string
  via_adm: string | null
  validade: string | null
  lote: string | null
  observacoes: string | null
  data: string
  created_at: string
}

export async function listSupplementations(patientId: string): Promise<Supplementation[]> {
  const { data, error } = await supabase
    .from('supplementations')
    .select('*')
    .eq('patient_id', patientId)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  medicacao: string
  via_adm?: string | null
  validade?: string | null
  lote?: string | null
  observacoes?: string | null
}

export async function createSupplementation(args: CreateArgs): Promise<void> {
  const { error } = await supabase.from('supplementations').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    medicacao: args.medicacao,
    via_adm: args.via_adm ?? null,
    validade: args.validade ?? null,
    lote: args.lote ?? null,
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}
