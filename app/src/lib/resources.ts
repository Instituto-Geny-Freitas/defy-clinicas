import { supabase } from '@/lib/supabase'

export interface Resource {
  id: string
  nome: string
  tipo: 'sala' | 'equipamento'
  ativo: boolean
}

export async function listResources(): Promise<Resource[]> {
  const { data, error } = await supabase.from('resources').select('id, nome, tipo, ativo').order('nome')
  if (error) throw error
  return (data ?? []) as Resource[]
}

export async function createResource(clinicId: string, nome: string, tipo: 'sala' | 'equipamento'): Promise<void> {
  const { error } = await supabase.from('resources').insert({ clinic_id: clinicId, nome, tipo })
  if (error) throw error
}

export async function updateResource(id: string, patch: { nome?: string; tipo?: 'sala' | 'equipamento'; ativo?: boolean }): Promise<void> {
  const { error } = await supabase.from('resources').update(patch).eq('id', id)
  if (error) throw error
}

/** Soft-delete: preserva o histórico de agendamentos que usaram o recurso. */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

/**
 * Há agendamento (não cancelado) do MESMO recurso com período sobreposto?
 * Sobreposição: ap.inicio < novoFim e ap.fim(coalesce +30min) > novoInicio.
 */
export async function resourceConflict(resourceId: string, inicioISO: string, fimISO: string | null, exceptId?: string): Promise<boolean> {
  const novoFim = fimISO ?? new Date(new Date(inicioISO).getTime() + 30 * 60000).toISOString()
  let q = supabase.from('appointments')
    .select('id, inicio, fim')
    .eq('resource_id', resourceId)
    .neq('status', 'cancelado')
    .lt('inicio', novoFim)
  if (exceptId) q = q.neq('id', exceptId)
  const { data, error } = await q
  if (error) return false
  return (data ?? []).some((a) => {
    const apFim = a.fim ?? new Date(new Date(a.inicio).getTime() + 30 * 60000).toISOString()
    return apFim > inicioISO
  })
}
