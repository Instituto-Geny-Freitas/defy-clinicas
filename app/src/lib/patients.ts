import { supabase, digitsOnly } from '@/lib/supabase'
import type { Patient } from '@/lib/types'

export interface PatientInput {
  nome: string
  cpf?: string
  nascimento?: string | null
  sexo?: string | null
  email?: string | null
  whatsapp?: string | null
  telefone?: string | null
  profissao?: string | null
  estilo_trabalho?: string | null
  alergias?: string | null
  observacoes?: string | null
}

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, clinic_id, auth_user_id, nome, cpf, email, whatsapp')
    .order('nome')
  if (error) throw error
  return data ?? []
}

export async function getPatient(id: string): Promise<Patient | null> {
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createPatient(clinicId: string, input: PatientInput): Promise<Patient> {
  const payload = {
    clinic_id: clinicId,
    ...input,
    cpf: input.cpf ? digitsOnly(input.cpf) : null,
  }
  const { data, error } = await supabase.from('patients').insert(payload).select().single()
  if (error) throw error
  return data
}
