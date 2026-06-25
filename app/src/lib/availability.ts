import { supabase } from '@/lib/supabase'

// =============================================================================
// Disponibilidade do profissional: janelas semanais e bloqueios de datas.
// =============================================================================

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface AvailabilityWindow {
  id: string
  professional_id: string
  dia_semana: number   // 0=Dom ... 6=Sáb
  hora_inicio: string  // HH:MM[:SS]
  hora_fim: string
}

export async function listAvailability(professionalId: string): Promise<AvailabilityWindow[]> {
  const { data, error } = await supabase
    .from('professional_availability')
    .select('id, professional_id, dia_semana, hora_inicio, hora_fim')
    .eq('professional_id', professionalId)
    .order('dia_semana').order('hora_inicio')
  if (error) throw error
  return data ?? []
}

export async function createAvailability(clinicId: string, professionalId: string, dia: number, inicio: string, fim: string): Promise<void> {
  const { error } = await supabase.from('professional_availability').insert({
    clinic_id: clinicId, professional_id: professionalId, dia_semana: dia, hora_inicio: inicio, hora_fim: fim,
  })
  if (error) throw error
}

export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await supabase.from('professional_availability').delete().eq('id', id)
  if (error) throw error
}

export interface BlockRange {
  id: string
  professional_id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
}

export async function listBlocks(professionalId: string): Promise<BlockRange[]> {
  const { data, error } = await supabase
    .from('professional_blocks')
    .select('id, professional_id, data_inicio, data_fim, motivo')
    .eq('professional_id', professionalId)
    .order('data_inicio', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBlock(clinicId: string, professionalId: string, inicio: string, fim: string, motivo: string | null): Promise<void> {
  const { error } = await supabase.from('professional_blocks').insert({
    clinic_id: clinicId, professional_id: professionalId, data_inicio: inicio, data_fim: fim, motivo,
  })
  if (error) throw error
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await supabase.from('professional_blocks').delete().eq('id', id)
  if (error) throw error
}

// ---- Verificação de horário (via RPC, respeita a agenda de todos) ----------
export type SlotStatus = 'ok' | 'ocupado' | 'fora_horario' | 'bloqueado'

export const SLOT_MENSAGEM: Record<SlotStatus, string> = {
  ok: 'Horário disponível.',
  ocupado: 'Horário indisponível — já está reservado.',
  fora_horario: 'Fora do horário de atendimento do profissional.',
  bloqueado: 'O profissional não atende nesta data (indisponível/férias).',
}

export async function checkSlot(professionalId: string | null, inicioISO: string, fimISO?: string | null): Promise<SlotStatus> {
  if (!professionalId) return 'ok'
  const { data, error } = await supabase.rpc('check_slot', { p_prof: professionalId, p_inicio: inicioISO, p_fim: fimISO ?? null })
  if (error) throw error
  return (data as SlotStatus) ?? 'ok'
}
