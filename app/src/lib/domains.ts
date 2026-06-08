import { supabase } from '@/lib/supabase'

// ---- Ativos de composição ---------------------------------------------------
export type AtivoCategoria = 'gerais' | 'vitaminas' | 'esclerosantes' | 'anestesicos'

export const ATIVO_CATEGORIAS: { v: AtivoCategoria; l: string }[] = [
  { v: 'gerais', l: 'Ativos Gerais' },
  { v: 'vitaminas', l: 'Vitaminas' },
  { v: 'esclerosantes', l: 'Esclerosantes' },
  { v: 'anestesicos', l: 'Anestésicos' },
]

export interface ActiveIngredient {
  id: string
  codigo: string | null
  nome: string
  categoria: AtivoCategoria
  apresentacao: string | null
  ativo: boolean
}

export async function listActiveIngredients(categoria?: AtivoCategoria): Promise<ActiveIngredient[]> {
  let q = supabase.from('active_ingredients').select('*').eq('ativo', true).order('nome')
  if (categoria) q = q.eq('categoria', categoria)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createActiveIngredient(
  clinicId: string,
  input: { codigo?: string; nome: string; categoria: AtivoCategoria; apresentacao?: string },
): Promise<void> {
  const { error } = await supabase.from('active_ingredients').insert({ clinic_id: clinicId, ...input })
  if (error) throw error
}

export async function deleteActiveIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('active_ingredients').delete().eq('id', id)
  if (error) throw error
}

// ---- Tipos de procedimento --------------------------------------------------
export interface ProcedureType {
  id: string
  nome: string
  ativo: boolean
}

export async function listProcedureTypes(): Promise<ProcedureType[]> {
  const { data, error } = await supabase
    .from('procedure_types')
    .select('id, nome, ativo')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}

export async function createProcedureType(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('procedure_types').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}

export async function deleteProcedureType(id: string): Promise<void> {
  const { error } = await supabase.from('procedure_types').delete().eq('id', id)
  if (error) throw error
}
