import { supabase } from '@/lib/supabase'
import { localDateToday } from '@/lib/format'

export type Periodicidade = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export const PERIOD_MESES: Record<Periodicidade, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }
export const PERIOD_LABEL: Record<Periodicidade, string> = { mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }

/** Soma meses a uma data YYYY-MM-DD (sem shift de fuso). */
export function addMonthsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, (m - 1) + n, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
/** Soma dias a uma data YYYY-MM-DD (sem shift de fuso). */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export interface RecurrenceRec {
  id: string
  clinic_id: string
  patient_id: string
  professional_id: string | null
  tipo: 'procedimento' | 'suplementacao'
  descricao: string
  periodicidade: Periodicidade
  dias_antecedencia: number
  data_base: string
  proxima_data: string
  status: 'ativa' | 'encerrada'
  patients?: { nome: string } | null
}

/** Cria (ou atualiza, se já houver uma ativa igual) uma recomendação de recorrência. */
export async function createRecurrence(args: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  tipo: 'procedimento' | 'suplementacao'
  procedureId?: string | null
  supplementationId?: string | null
  descricao: string
  periodicidade: Periodicidade
  diasAntecedencia: number
  dataBase: string
}): Promise<void> {
  const proxima = addMonthsYmd(args.dataBase, PERIOD_MESES[args.periodicidade])
  const patch = {
    periodicidade: args.periodicidade,
    dias_antecedencia: args.diasAntecedencia,
    data_base: args.dataBase.slice(0, 10),
    proxima_data: proxima,
    status: 'ativa' as const,
  }
  // Evita recomendações ativas duplicadas para o mesmo paciente/tipo/descrição.
  const { data: existente } = await supabase
    .from('recurrence_recommendations')
    .select('id')
    .eq('patient_id', args.patientId)
    .eq('tipo', args.tipo)
    .eq('descricao', args.descricao)
    .eq('status', 'ativa')
    .limit(1)
  if (existente && existente.length > 0) {
    const { error } = await supabase.from('recurrence_recommendations').update(patch).eq('id', existente[0].id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('recurrence_recommendations').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    tipo: args.tipo,
    procedure_id: args.procedureId ?? null,
    supplementation_id: args.supplementationId ?? null,
    descricao: args.descricao,
    ...patch,
  })
  if (error) throw error
}

function normalize(rows: unknown[]): RecurrenceRec[] {
  return (rows as (RecurrenceRec & { patients?: { nome: string } | { nome: string }[] | null })[]).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as RecurrenceRec[]
}
/** Uma recomendação está "vencendo" quando hoje já entrou na janela de antecedência. */
function noPrazo(r: RecurrenceRec): boolean {
  return r.proxima_data <= addDaysYmd(localDateToday(), r.dias_antecedencia)
}

/** Retornos recomendados (equipe) já dentro da janela de alerta e não agendados. */
export async function listDueRecurrences(): Promise<RecurrenceRec[]> {
  const { data, error } = await supabase
    .from('recurrence_recommendations')
    .select('*, patients(nome)')
    .eq('status', 'ativa')
    .order('proxima_data', { ascending: true })
  if (error) throw error
  return normalize(data ?? []).filter(noPrazo)
}

/** Retornos recomendados do próprio paciente (portal). */
export async function listDuePatientRecurrences(patientId: string): Promise<RecurrenceRec[]> {
  const { data, error } = await supabase
    .from('recurrence_recommendations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'ativa')
    .order('proxima_data', { ascending: true })
  if (error) return []
  return normalize(data ?? []).filter(noPrazo)
}

/** Avança a próxima data em um período (após agendar o retorno). */
export async function advanceRecurrence(rec: Pick<RecurrenceRec, 'id' | 'proxima_data' | 'periodicidade'>): Promise<void> {
  const nova = addMonthsYmd(rec.proxima_data, PERIOD_MESES[rec.periodicidade])
  const { error } = await supabase.from('recurrence_recommendations').update({ proxima_data: nova }).eq('id', rec.id)
  if (error) throw error
}

/** Encerra a recomendação (não gera mais alertas). */
export async function dismissRecurrence(id: string): Promise<void> {
  const { error } = await supabase.from('recurrence_recommendations').update({ status: 'encerrada' }).eq('id', id)
  if (error) throw error
}
