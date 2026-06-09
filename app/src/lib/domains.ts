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
  via: string | null
  fornecedor: string | null
  preco_aquisicao: number
  margem_pct: number
  preco_venda: number
  ativo: boolean
}

export interface AtivoInput {
  codigo?: string | null
  nome: string
  categoria: AtivoCategoria
  apresentacao?: string | null
  via?: string | null
  fornecedor?: string | null
  preco_aquisicao?: number
  margem_pct?: number
  preco_venda?: number
}

export async function listActiveIngredients(categoria?: AtivoCategoria): Promise<ActiveIngredient[]> {
  let q = supabase.from('active_ingredients').select('*').eq('ativo', true).order('nome')
  if (categoria) q = q.eq('categoria', categoria)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createActiveIngredient(clinicId: string, input: AtivoInput): Promise<void> {
  const { error } = await supabase.from('active_ingredients').insert({ clinic_id: clinicId, ...input })
  if (error) throw error
}

export async function updateActiveIngredient(id: string, input: AtivoInput): Promise<void> {
  const { error } = await supabase.from('active_ingredients').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteActiveIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('active_ingredients').delete().eq('id', id)
  if (error) throw error
}

/** Venda com margem: aquisição * (1 + margem%/100). */
export function calcVendaComMargem(aquisicao: number, margemPct: number): number {
  return Math.round(aquisicao * (1 + (margemPct || 0) / 100) * 100) / 100
}

// ---- Vias de administração --------------------------------------------------
export interface DomainItem {
  id: string
  nome: string
  ativo: boolean
}

export async function listRoutes(): Promise<DomainItem[]> {
  const { data, error } = await supabase.from('administration_routes').select('id, nome, ativo').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}
export async function createRoute(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('administration_routes').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}
export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase.from('administration_routes').delete().eq('id', id)
  if (error) throw error
}

// ---- Fornecedores -----------------------------------------------------------
export interface Supplier {
  id: string
  nome: string
  contato: string | null
  ativo: boolean
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('id, nome, contato, ativo').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}
export async function createSupplier(clinicId: string, input: { nome: string; contato?: string }): Promise<void> {
  const { error } = await supabase.from('suppliers').insert({ clinic_id: clinicId, ...input })
  if (error) throw error
}
export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
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
