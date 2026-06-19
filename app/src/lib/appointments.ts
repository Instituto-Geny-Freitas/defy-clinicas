import { supabase } from '@/lib/supabase'

export type AppointmentStatus = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'

export interface Appointment {
  id: string
  clinic_id: string
  patient_id: string | null
  professional_id: string | null
  procedimento: string | null
  inicio: string
  fim: string | null
  status: AppointmentStatus
  observacoes: string | null
  confirmado_em: string | null
  nome_avulso: string | null
  telefone_avulso: string | null
  patients?: { nome: string; whatsapp: string | null } | null
  professionals?: { nome: string } | null
}

/** Agendamentos da clínica (com nome do paciente e profissional). Pode limitar por período/profissional. */
export async function listAppointments(desde?: string, professionalId?: string, ate?: string): Promise<Appointment[]> {
  let q = supabase
    .from('appointments')
    .select('*, patients(nome, whatsapp), professionals(nome)')
    .order('inicio', { ascending: true })
  if (desde) q = q.gte('inicio', desde)
  if (ate) q = q.lte('inicio', ate)
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
  patientId?: string | null
  professionalId?: string | null
  procedimento?: string | null
  inicio: string
  fim?: string | null
  observacoes?: string | null
  // Agendamento prévio sem cadastro (paciente ainda não cadastrado):
  nomeAvulso?: string | null
  telefoneAvulso?: string | null
}

export async function createAppointment(args: CreateArgs): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId ?? null,
      professional_id: args.professionalId ?? null,
      procedimento: args.procedimento ?? null,
      inicio: args.inicio,
      fim: args.fim ?? null,
      observacoes: args.observacoes ?? null,
      nome_avulso: args.nomeAvulso ?? null,
      telefone_avulso: args.telefoneAvulso ?? null,
      status: 'agendado',
      origem: 'profissional',
    })
    .select('*, patients(nome, whatsapp), professionals(nome)')
    .single()
  if (error) throw error
  return data
}

export type ApptPeriodo = 'semanal' | 'quinzenal' | 'mensal' | 'anual'

function proximaData(d: Date, periodo: ApptPeriodo): Date {
  const n = new Date(d)
  if (periodo === 'semanal') n.setDate(n.getDate() + 7)
  else if (periodo === 'quinzenal') n.setDate(n.getDate() + 15)
  else if (periodo === 'mensal') n.setMonth(n.getMonth() + 1)
  else n.setFullYear(n.getFullYear() + 1)
  return n
}
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Cria uma série de agendamentos recorrentes (uso exclusivo do profissional),
 * da 1ª data até 31/dez do ano informado (inclusive). Devolve quantos foram criados.
 */
export async function createRecurringAppointments(args: {
  clinicId: string
  patientId?: string | null
  nomeAvulso?: string | null
  telefoneAvulso?: string | null
  professionalId?: string | null
  procedimento?: string | null
  observacoes?: string | null
  date: string          // YYYY-MM-DD (primeira ocorrência)
  horaInicio: string    // HH:MM
  horaFim?: string | null
  periodo: ApptPeriodo
  ateAno: number
}): Promise<number> {
  const limite = new Date(args.ateAno, 11, 31, 23, 59, 59) // 31/dez do ano, hora local
  let cursor = new Date(`${args.date}T12:00:00`)
  const rows: Record<string, unknown>[] = []
  const MAX = 600 // trava de segurança
  while (cursor <= limite && rows.length < MAX) {
    const ymd = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`
    rows.push({
      clinic_id: args.clinicId,
      patient_id: args.patientId ?? null,
      professional_id: args.professionalId ?? null,
      procedimento: args.procedimento ?? null,
      inicio: new Date(`${ymd}T${args.horaInicio}:00`).toISOString(),
      fim: args.horaFim ? new Date(`${ymd}T${args.horaFim}:00`).toISOString() : null,
      observacoes: args.observacoes ?? null,
      nome_avulso: args.nomeAvulso ?? null,
      telefone_avulso: args.telefoneAvulso ?? null,
      status: 'agendado',
      origem: 'profissional',
    })
    cursor = proximaData(cursor, args.periodo)
  }
  if (rows.length === 0) return 0
  const { error } = await supabase.from('appointments').insert(rows)
  if (error) throw error
  return rows.length
}

/** Agendamentos prévios sem cadastro (patient_id nulo) — pendentes de regularização. */
export async function listWalkInAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, professionals(nome)')
    .is('patient_id', null)
    .order('inicio', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Regulariza agendamentos avulsos vinculando-os a um paciente cadastrado. */
export async function linkAppointmentsToPatient(patientId: string, apptIds: string[]): Promise<void> {
  if (apptIds.length === 0) return
  const { error } = await supabase
    .from('appointments')
    .update({ patient_id: patientId, nome_avulso: null, telefone_avulso: null })
    .in('id', apptIds)
  if (error) throw error
}

/** Remarca um agendamento para nova data/hora (zera o lembrete enviado). */
export async function rescheduleAppointment(id: string, inicio: string, fim?: string | null): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ inicio, fim: fim ?? null, lembrete_enviado_em: null })
    .eq('id', id)
  if (error) throw error
}

/** Solicitação de horário feita pelo próprio paciente (origem = paciente). */
export async function requestAppointment(args: {
  clinicId: string
  patientId: string
  inicio: string
  procedimento?: string | null
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('appointments').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    procedimento: args.procedimento ?? null,
    inicio: args.inicio,
    status: 'agendado',
    origem: 'paciente',
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', id)
  if (error) throw error
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'confirmado') patch.confirmado_em = new Date().toISOString()
  const { error } = await supabase.from('appointments').update(patch).eq('id', id)
  if (error) throw error
}
