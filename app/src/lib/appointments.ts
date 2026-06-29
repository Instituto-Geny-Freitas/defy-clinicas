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
  recorrencia_grupo: string | null
  patients?: { nome: string; whatsapp: string | null } | null
  professionals?: { nome: string } | null
}

/** Agendamentos da clínica (com nome do paciente e profissional). Pode limitar por período/profissional/paciente. */
export async function listAppointments(desde?: string, professionalId?: string, ate?: string, patientId?: string): Promise<Appointment[]> {
  let q = supabase
    .from('appointments')
    .select('*, patients(nome, whatsapp), professionals(nome)')
    .order('inicio', { ascending: true })
  if (desde) q = q.gte('inicio', desde)
  if (ate) q = q.lte('inicio', ate)
  if (professionalId) q = q.or(`professional_id.eq.${professionalId},professional_id.is.null`)
  if (patientId) q = q.eq('patient_id', patientId)
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
  const grupo = crypto.randomUUID() // agrupa a série p/ editar/excluir todas
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
      recorrencia_grupo: grupo,
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

/** Vincula toda uma série recorrente (recorrencia_grupo) a um paciente — links all null-patient occurrences. */
export async function linkGroupToPatient(patientId: string, grupo: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ patient_id: patientId, nome_avulso: null, telefone_avulso: null })
    .eq('recorrencia_grupo', grupo)
    .is('patient_id', null)
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
  professionalId?: string | null
  inicio: string
  fim?: string | null
  procedimento?: string | null
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('appointments').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    procedimento: args.procedimento ?? null,
    inicio: args.inicio,
    fim: args.fim ?? null,
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

/**
 * Exclui uma série recorrente inteira. `desde` (ISO) limita a "esta e as
 * futuras"; sem ele, exclui todas as ocorrências do grupo.
 */
export async function deleteAppointmentSeries(grupo: string, desde?: string): Promise<void> {
  let q = supabase.from('appointments').delete().eq('recorrencia_grupo', grupo)
  if (desde) q = q.gte('inicio', desde)
  const { error } = await q
  if (error) throw error
}

/**
 * Edita campos comuns de uma série recorrente (procedimento, profissional,
 * status). `desde` limita a "esta e as futuras". A hora (início/fim) é aplicada
 * preservando a DATA de cada ocorrência, quando informada.
 */
export async function updateAppointmentSeries(
  grupo: string,
  patch: { procedimento?: string | null; professionalId?: string | null; status?: AppointmentStatus; horaInicio?: string; horaFim?: string | null },
  desde?: string,
): Promise<void> {
  // Campos diretos (mesmo valor para todas as ocorrências).
  const row: Record<string, unknown> = {}
  if (patch.procedimento !== undefined) row.procedimento = patch.procedimento
  if (patch.professionalId !== undefined) row.professional_id = patch.professionalId
  if (patch.status !== undefined) row.status = patch.status
  if (Object.keys(row).length > 0) {
    let q = supabase.from('appointments').update(row).eq('recorrencia_grupo', grupo)
    if (desde) q = q.gte('inicio', desde)
    const { error } = await q
    if (error) throw error
  }

  // Reaplicar a hora preservando a data de cada ocorrência (precisa ler as linhas).
  if (patch.horaInicio) {
    let sel = supabase.from('appointments').select('id, inicio').eq('recorrencia_grupo', grupo)
    if (desde) sel = sel.gte('inicio', desde)
    const { data, error } = await sel
    if (error) throw error
    for (const ap of data ?? []) {
      const ymd = ap.inicio.slice(0, 10)
      const novoInicio = new Date(`${ymd}T${patch.horaInicio}:00`).toISOString()
      const novoFim = patch.horaFim ? new Date(`${ymd}T${patch.horaFim}:00`).toISOString() : null
      await supabase.from('appointments').update({ inicio: novoInicio, fim: novoFim, lembrete_enviado_em: null }).eq('id', ap.id)
    }
  }
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'confirmado') patch.confirmado_em = new Date().toISOString()
  const { error } = await supabase.from('appointments').update(patch).eq('id', id)
  if (error) throw error
}
