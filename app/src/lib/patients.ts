import { supabase, digitsOnly } from '@/lib/supabase'
import { parseLocalDate } from '@/lib/format'
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

/** Lista enxuta de profissionais ativos (para o paciente escolher no agendamento). */
export interface PublicProfessional { id: string; nome: string }
export async function listPublicProfessionals(): Promise<PublicProfessional[]> {
  const { data, error } = await supabase.from('professionals').select('id, nome').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabase.from('patients').select('*').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}

/** Remove (desativa) um paciente — soft delete para preservar histórico/relacionamentos. */
export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').update({ ativo: false }).eq('id', id)
  if (error) throw error
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

export interface PatientUpdate extends Partial<PatientInput> {
  consentimento_lgpd_em?: string | null
  consentimento_lgpd_versao?: string | null
  senha_provisoria?: boolean
  limite_relatorios?: number
}

export async function updatePatient(id: string, patch: PatientUpdate): Promise<Patient> {
  const body = { ...patch }
  if (body.cpf) body.cpf = digitsOnly(body.cpf)
  const { data, error } = await supabase.from('patients').update(body).eq('id', id).select().single()
  if (error) throw error
  return data
}

/**
 * Provisiona o acesso do paciente: cria o usuário com senha provisória via
 * Edge Function (server-side). Requer a function 'provision-patient-access'
 * deployada. Retorna o identificador de login (CPF sintético ou e-mail).
 */
export async function provisionPatientAccess(
  patientId: string,
  password: string,
): Promise<{ login: string }> {
  const { data, error } = await supabase.functions.invoke('provision-patient-access', {
    body: { patient_id: patientId, password },
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as { login: string }
}

/** Gera uma senha provisória legível (8 caracteres). */
export function gerarSenhaProvisoria(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const nums = '23456789'
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${pick(letras, 4)}${pick(nums, 4)}`
}

/** Idade em anos a partir da data de nascimento. Trata data-only sem shift de fuso. */
export function calcAge(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const b = parseLocalDate(nascimento)
  if (!b) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}
