import { supabase } from '@/lib/supabase'

export type AppointmentStatus = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'

export interface Appointment {
  id: string
  clinic_id: string
  patient_id: string
  professional_id: string | null
  procedimento: string | null
  inicio: string
  fim: string | null
  status: AppointmentStatus
  observacoes: string | null
  confirmado_em: string | null
  patients?: { nome: string; whatsapp: string | null }
  professionals?: { nome: string } | null
}

/** Agendamentos da clínica a partir de uma data (com nome do paciente e profissional). */
export async function listAppointments(desde?: string, professionalId?: string): Promise<Appointment[]> {
  let q = supabase
    .from('appointments')
    .select('*, patients(nome, whatsapp), professionals(nome)')
    .order('inicio', { ascending: true })
  if (desde) q = q.gte('inicio', desde)
  if (professionalId) q = q.eq('professional_id', professionalId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/** Agendamentos de um paciente (para o portal). */
export async function listPatientAppointments(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('inicio', { ascending: true })
  if (error) throw error
  return data ?? []
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  procedimento?: string | null
  inicio: string
  fim?: string | null
  observacoes?: string | null
}

export async function createAppointment(args: CreateArgs): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
      procedimento: args.procedimento ?? null,
      inicio: args.inicio,
      fim: args.fim ?? null,
      observacoes: args.observacoes ?? null,
      status: 'agendado',
      origem: 'profissional',
    })
    .select('*, patients(nome, whatsapp), professionals(nome)')
    .single()
  if (error) throw error
  return data
}

/** Remarca um agendamento para nova data/hora (zera o lembrete enviado). */
export async function rescheduleAppointment(id: string, inicio: string, fim?: string | null): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ inicio, fim: fim ?? null, lembrete_enviado_em: null })
    .eq('id', id)
  if (error) throw error
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'confirmado') patch.confirmado_em = new Date().toISOString()
  const { error } = await supabase.from('appointments').update(patch).eq('id', id)
  if (error) throw error
}
