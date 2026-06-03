import { supabase } from '@/lib/supabase'

export interface InventoryItem {
  id: string
  produto: string
  marca: string | null
  lote: string | null
  validade: string | null
  custo_unit: number
  preco_venda: number
  margem_unit: number
  qtd_atual: number
  qtd_minima: number
  unidade: string | null
  categoria: string | null
  ativo: boolean
}

export interface InventoryInput {
  produto: string
  marca?: string | null
  lote?: string | null
  validade?: string | null
  custo_unit?: number
  preco_venda?: number
  qtd_atual?: number
  qtd_minima?: number
  unidade?: string | null
  categoria?: string | null
}

export async function listInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('ativo', true)
    .order('produto')
  if (error) throw error
  return data ?? []
}

export async function createInventoryItem(clinicId: string, input: InventoryInput) {
  const { data, error } = await supabase
    .from('inventory')
    .insert({ clinic_id: clinicId, ...input })
    .select()
    .single()
  if (error) throw error
  return data as InventoryItem
}

/** Lança uma entrada de estoque (o trigger soma em qtd_atual). */
export async function addStockEntry(
  clinicId: string,
  inventoryId: string,
  quantidade: number,
  custoUnit?: number,
) {
  const { error } = await supabase.from('stock_movements').insert({
    clinic_id: clinicId,
    inventory_id: inventoryId,
    tipo: 'entrada',
    quantidade,
    custo_unit: custoUnit ?? null,
  })
  if (error) throw error
}

/** TRUE se o item está no/abaixo do mínimo. */
export function estoqueBaixo(i: InventoryItem): boolean {
  return i.qtd_atual <= i.qtd_minima
}

/** TRUE se a validade está vencida ou a menos de 30 dias. */
export function validadeProxima(i: InventoryItem): boolean {
  if (!i.validade) return false
  const dias = (new Date(i.validade).getTime() - Date.now()) / 86400000
  return dias <= 30
}
