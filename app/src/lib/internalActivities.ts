import { supabase } from '@/lib/supabase'

// =============================================================================
// Atividades Internas (gestão da clínica). Uso interno — nunca no portal.
// RLS (0068): admin CRUD tudo; membro vê atribuídas/criadas por si e edita só
// as que criou. Ajustes das atividades do Admin ficam em internal_activity_log.
// =============================================================================

export type ActivityStatus = 'pendente' | 'executado' | 'redirecionado'
export type ActivityOrigin = 'admin' | 'membro' | 'reuniao'

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  pendente: 'Pendente', executado: 'Executado', redirecionado: 'Redirecionado',
}
export const ORIGEM_LABEL: Record<ActivityOrigin, string> = {
  admin: 'Admin', membro: 'Membro', reuniao: 'Reunião',
}

export interface InternalActivity {
  id: string
  clinic_id: string
  titulo: string
  descricao: string | null
  responsavel_professional_id: string | null
  origem: ActivityOrigin
  meeting_id: string | null
  data: string | null
  hora: string | null
  status: ActivityStatus
  data_efetivada: string | null
  created_by: string | null
  created_by_nome: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLogEntry {
  id: string
  activity_id: string
  changed_by_nome: string | null
  campo: string
  de: string | null
  para: string | null
  created_at: string
}

/** Lista as atividades visíveis ao usuário (RLS decide o escopo), com filtros opcionais. */
export async function listActivities(opts?: { de?: string; ate?: string }): Promise<InternalActivity[]> {
  let q = supabase
    .from('internal_activities')
    .select('*')
    .order('data', { ascending: true, nullsFirst: false })
    .order('hora', { ascending: true, nullsFirst: true })
  if (opts?.de) q = q.gte('data', opts.de)
  if (opts?.ate) q = q.lte('data', opts.ate)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as InternalActivity[]
}

/** Atividades geradas/vinculadas a uma reunião (origem 'reuniao'). */
export async function listMeetingActivities(meetingId: string): Promise<InternalActivity[]> {
  const { data, error } = await supabase
    .from('internal_activities')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('data', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as InternalActivity[]
}

export interface CreateActivityInput {
  clinicId: string
  titulo: string
  descricao?: string | null
  responsavelProfessionalId?: string | null
  origem: ActivityOrigin
  meetingId?: string | null
  data?: string | null
  hora?: string | null
  status?: ActivityStatus
  dataEfetivada?: string | null
  createdBy: string           // professional id de quem cria
  createdByNome?: string | null
}

export async function createActivity(input: CreateActivityInput): Promise<InternalActivity> {
  const { data, error } = await supabase.from('internal_activities').insert({
    clinic_id: input.clinicId,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    responsavel_professional_id: input.responsavelProfessionalId ?? null,
    origem: input.origem,
    meeting_id: input.meetingId ?? null,
    data: input.data ?? null,
    hora: input.hora || null,
    status: input.status ?? 'pendente',
    data_efetivada: input.dataEfetivada ?? null,
    created_by: input.createdBy,
    created_by_nome: input.createdByNome ?? null,
  }).select().single()
  if (error) throw error
  return data as InternalActivity
}

export interface ActivityPatch {
  titulo?: string
  descricao?: string | null
  responsavel_professional_id?: string | null
  data?: string | null
  hora?: string | null
  status?: ActivityStatus
  data_efetivada?: string | null
}

export async function updateActivity(id: string, patch: ActivityPatch): Promise<void> {
  const { error } = await supabase
    .from('internal_activities')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('internal_activities').delete().eq('id', id)
  if (error) throw error
}

/** Muda só o status (e a data efetivada) — permitido a admin, criador OU responsável.
 *  Via RPC SECURITY DEFINER (0069): restringe as colunas e registra log em atividades do Admin. */
export async function setActivityStatus(id: string, status: ActivityStatus, dataEfetivada?: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_internal_activity_status', {
    p_id: id, p_status: status, p_data_efetivada: dataEfetivada ?? null,
  })
  if (error) throw error
}

// ---- Log de ajustes --------------------------------------------------------
export async function listActivityLog(activityId: string): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('internal_activity_log')
    .select('id, activity_id, changed_by_nome, campo, de, para, created_at')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ActivityLogEntry[]
}

export interface LogInput { campo: string; de: string | null; para: string | null }

/** Grava entradas de log de ajuste (usado ao editar atividades criadas pelo Admin). */
export async function addActivityLog(clinicId: string, activityId: string, changedBy: string | null, changedByNome: string | null, entries: LogInput[]): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({
    clinic_id: clinicId, activity_id: activityId, changed_by: changedBy, changed_by_nome: changedByNome,
    campo: e.campo, de: e.de, para: e.para,
  }))
  const { error } = await supabase.from('internal_activity_log').insert(rows)
  if (error) throw error
}
