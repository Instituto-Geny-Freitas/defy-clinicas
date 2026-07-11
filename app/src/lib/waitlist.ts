import { supabase } from '@/lib/supabase'

export type WaitlistStatus = 'aguardando' | 'agendado' | 'cancelado'

export interface WaitlistEntry {
  id: string
  patient_id: string | null
  nome_avulso: string | null
  telefone_avulso: string | null
  professional_id: string | null
  procedimento: string | null
  observacoes: string | null
  status: WaitlistStatus
  created_at: string
  patients?: { nome: string } | null
  professionals?: { nome: string } | null
}

export async function listWaitlist(status: WaitlistStatus = 'aguardando'): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist')
    .select('*, patients(nome), professionals(nome)')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((w) => ({
    ...w,
    patients: Array.isArray(w.patients) ? (w.patients[0] ?? null) : w.patients,
    professionals: Array.isArray(w.professionals) ? (w.professionals[0] ?? null) : w.professionals,
  })) as WaitlistEntry[]
}

export async function countWaitlist(): Promise<number> {
  const { count } = await supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('status', 'aguardando')
  return count ?? 0
}

export async function addWaitlist(args: {
  clinicId: string
  patientId?: string | null
  nomeAvulso?: string | null
  telefoneAvulso?: string | null
  professionalId?: string | null
  procedimento?: string | null
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('waitlist').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId ?? null,
    nome_avulso: args.nomeAvulso ?? null,
    telefone_avulso: args.telefoneAvulso ?? null,
    professional_id: args.professionalId ?? null,
    procedimento: args.procedimento ?? null,
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}

export async function updateWaitlistStatus(id: string, status: WaitlistStatus): Promise<void> {
  const { error } = await supabase.from('waitlist').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteWaitlist(id: string): Promise<void> {
  const { error } = await supabase.from('waitlist').delete().eq('id', id)
  if (error) throw error
}
