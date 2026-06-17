import { supabase } from '@/lib/supabase'

export interface Supplementation {
  id: string
  patient_id: string
  medicacao: string
  via_adm: string | null
  validade: string | null
  lote: string | null
  fornecedor: string | null
  valor_venda: number
  observacoes: string | null
  pago: boolean
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

/** Suplementações ainda não pagas (para importar no orçamento). */
export async function listUnpaidSupplementations(patientId: string): Promise<Supplementation[]> {
  const { data, error } = await supabase
    .from('supplementations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('pago', false)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setSupplementationPaid(id: string, pago: boolean): Promise<void> {
  const { error } = await supabase.from('supplementations').update({ pago }).eq('id', id)
  if (error) throw error
}

export async function updateSupplementation(id: string, patch: {
  medicacao?: string
  via_adm?: string | null
  validade?: string | null
  lote?: string | null
  fornecedor?: string | null
  valor_venda?: number
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('supplementations').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSupplementation(id: string): Promise<void> {
  const { error } = await supabase.from('supplementations').delete().eq('id', id)
  if (error) throw error
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  medicacao: string
  via_adm?: string | null
  validade?: string | null
  lote?: string | null
  fornecedor?: string | null
  valor_venda?: number
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
    fornecedor: args.fornecedor ?? null,
    valor_venda: args.valor_venda ?? 0,
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}
