import { supabase } from '@/lib/supabase'

// =============================================================================
// Reuniões Internas (gestão da clínica). Uso interno — nunca no portal.
// RLS (0070): is_staff. As atas geram atividades (internal_activities) na 2b.
// =============================================================================

export type MeetingStatus = 'agendada' | 'realizada' | 'cancelada'
export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada',
}

export interface InternalMeeting {
  id: string
  clinic_id: string
  titulo: string
  data: string | null
  hora: string | null
  topicos: string | null
  ata: string | null
  status: MeetingStatus
  created_by: string | null
  created_by_nome: string | null
  created_at: string
  updated_at: string
}

export interface MeetingParticipant {
  id: string
  meeting_id: string
  professional_id: string
  convocado: boolean
  confirmado_em: string | null
  ciente_em: string | null
  manifestacao: string | null
}

export async function listMeetings(): Promise<InternalMeeting[]> {
  const { data, error } = await supabase
    .from('internal_meetings')
    .select('*')
    .order('data', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as InternalMeeting[]
}

export interface CreateMeetingInput {
  clinicId: string
  titulo: string
  data?: string | null
  hora?: string | null
  topicos?: string | null
  ata?: string | null
  status?: MeetingStatus
  createdBy?: string | null
  createdByNome?: string | null
}

export async function createMeeting(input: CreateMeetingInput): Promise<InternalMeeting> {
  const { data, error } = await supabase.from('internal_meetings').insert({
    clinic_id: input.clinicId,
    titulo: input.titulo,
    data: input.data ?? null,
    hora: input.hora || null,
    topicos: input.topicos ?? null,
    ata: input.ata ?? null,
    status: input.status ?? 'agendada',
    created_by: input.createdBy ?? null,
    created_by_nome: input.createdByNome ?? null,
  }).select().single()
  if (error) throw error
  return data as InternalMeeting
}

export interface MeetingPatch {
  titulo?: string
  data?: string | null
  hora?: string | null
  topicos?: string | null
  ata?: string | null
  status?: MeetingStatus
}

export async function updateMeeting(id: string, patch: MeetingPatch): Promise<void> {
  const { error } = await supabase
    .from('internal_meetings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('internal_meetings').delete().eq('id', id)
  if (error) throw error
}

// ---- Participantes ---------------------------------------------------------
export async function listParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const { data, error } = await supabase
    .from('internal_meeting_participants')
    .select('*')
    .eq('meeting_id', meetingId)
  if (error) throw error
  return (data ?? []) as MeetingParticipant[]
}

export async function listParticipantsForMeetings(meetingIds: string[]): Promise<MeetingParticipant[]> {
  if (meetingIds.length === 0) return []
  const { data, error } = await supabase
    .from('internal_meeting_participants')
    .select('*')
    .in('meeting_id', meetingIds)
  if (error) throw error
  return (data ?? []) as MeetingParticipant[]
}

/** Sincroniza a lista de participantes (roster) do encontro: adiciona os novos e
 *  remove os que saíram (preserva confirmação/ciência dos mantidos). */
export async function setParticipants(clinicId: string, meetingId: string, professionalIds: string[]): Promise<void> {
  const atuais = await listParticipants(meetingId)
  const manter = new Set(professionalIds)
  const remover = atuais.filter((p) => !manter.has(p.professional_id))
  const existentes = new Set(atuais.map((p) => p.professional_id))
  const novos = professionalIds.filter((id) => !existentes.has(id))
  if (remover.length > 0) {
    const { error } = await supabase.from('internal_meeting_participants').delete().in('id', remover.map((r) => r.id))
    if (error) throw error
  }
  if (novos.length > 0) {
    const rows = novos.map((professional_id) => ({ clinic_id: clinicId, meeting_id: meetingId, professional_id }))
    const { error } = await supabase.from('internal_meeting_participants').insert(rows)
    if (error) throw error
  }
}

/** Atualiza a linha do participante (confirmação/ciência/manifestação — usado na 2b). */
export async function updateParticipant(id: string, patch: { confirmado_em?: string | null; ciente_em?: string | null; manifestacao?: string | null }): Promise<void> {
  const { error } = await supabase.from('internal_meeting_participants').update(patch).eq('id', id)
  if (error) throw error
}
