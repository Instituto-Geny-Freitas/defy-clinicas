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
  lote: string | null
  validade: string | null
  preco_aquisicao: number
  margem_pct: number
  preco_venda: number
  unidade: string | null
  estoque_minimo: number
  anexo_url: string | null
  ativo: boolean
}

export interface AtivoInput {
  codigo?: string | null
  nome: string
  categoria: AtivoCategoria
  apresentacao?: string | null
  via?: string | null
  fornecedor?: string | null
  lote?: string | null
  validade?: string | null
  preco_aquisicao?: number
  margem_pct?: number
  preco_venda?: number
  unidade?: string | null
  estoque_minimo?: number
  anexo_url?: string | null
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

/** Soft delete — preserva lotes/movimentações e histórico (relação 1->N). */
export async function deleteActiveIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('active_ingredients').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

/** Venda com margem: aquisição * (1 + margem%/100). */
export function calcVendaComMargem(aquisicao: number, margemPct: number): number {
  return Math.round(aquisicao * (1 + (margemPct || 0) / 100) * 100) / 100
}

// ---- Lotes de Ativo (estoque por lote) -------------------------------------
export interface AtivoLote {
  id: string
  ativo_id: string
  fornecedor: string | null
  lote: string | null
  validade: string | null
  qtd_atual: number
  custo_aquisicao: number
  margem_pct: number
  preco_venda: number
  ativo: boolean
}

const normStr = (v?: string | null) => (v ?? '').trim().toLowerCase()

/** Lotes ativos de todos os ativos (para exibir controle por lote e saldo). */
export async function listAtivoLotes(): Promise<AtivoLote[]> {
  const { data, error } = await supabase
    .from('ativo_lotes')
    .select('id, ativo_id, fornecedor, lote, validade, qtd_atual, custo_aquisicao, margem_pct, preco_venda, ativo')
    .eq('ativo', true)
    .order('validade', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

/**
 * Entrada de estoque de ATIVO por lote: soma no mesmo lote (fornecedor+lote+validade)
 * ou cria um novo. O gatilho atualiza o saldo do lote.
 */
export async function addAtivoEntryLot(args: {
  clinicId: string
  ativoId: string
  fornecedor?: string | null
  lote?: string | null
  validade?: string | null
  quantidade: number
  custoAquisicao?: number
  margemPct?: number
  precoVenda?: number
}): Promise<void> {
  const forn = args.fornecedor ?? null, lote = args.lote ?? null, validade = args.validade ?? null
  const { data: lots } = await supabase
    .from('ativo_lotes')
    .select('id, fornecedor, lote, validade')
    .eq('ativo_id', args.ativoId)
    .eq('ativo', true)
  const match = (lots ?? []).find(
    (l) => normStr(l.fornecedor) === normStr(forn) && normStr(l.lote) === normStr(lote) && (l.validade ?? '') === (validade ?? ''),
  )

  let lotId: string
  if (match) {
    lotId = match.id
    const patch: Record<string, unknown> = {}
    if (args.custoAquisicao != null) patch.custo_aquisicao = args.custoAquisicao
    if (args.margemPct != null) patch.margem_pct = args.margemPct
    if (args.precoVenda != null) patch.preco_venda = args.precoVenda
    if (Object.keys(patch).length) await supabase.from('ativo_lotes').update(patch).eq('id', lotId)
  } else {
    const { data: novo, error } = await supabase
      .from('ativo_lotes')
      .insert({
        clinic_id: args.clinicId, ativo_id: args.ativoId, fornecedor: forn, lote, validade,
        qtd_atual: 0, custo_aquisicao: args.custoAquisicao ?? 0, margem_pct: args.margemPct ?? 0, preco_venda: args.precoVenda ?? 0,
      })
      .select('id')
      .single()
    if (error) throw error
    lotId = novo.id
  }

  const { error: mErr } = await supabase.from('ativo_movements').insert({
    clinic_id: args.clinicId, ativo_lote_id: lotId, tipo: 'entrada', quantidade: args.quantidade,
    custo_aquisicao: args.custoAquisicao ?? null, preco_venda: args.precoVenda ?? null,
  })
  if (mErr) throw mErr
}

/** Ajuste de saldo de um lote de ativo (delta pode ser negativo). Registra movimentação 'ajuste'. */
export async function adjustAtivoLote(clinicId: string, ativoLoteId: string, delta: number, motivo?: string): Promise<void> {
  if (!delta) return
  const { error } = await supabase.from('ativo_movements').insert({
    clinic_id: clinicId, ativo_lote_id: ativoLoteId, tipo: 'ajuste', quantidade: delta, motivo: motivo ?? 'Ajuste de saldo inicial',
  })
  if (error) throw error
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
  telefone: string | null
  ativo: boolean
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('id, nome, contato, telefone, ativo').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}
export async function createSupplier(clinicId: string, input: { nome: string; contato?: string; telefone?: string }): Promise<void> {
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
