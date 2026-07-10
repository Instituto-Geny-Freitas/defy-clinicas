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

export interface InventoryLot {
  id: string
  inventory_id: string
  marca: string | null
  lote: string | null
  validade: string | null
  qtd_atual: number
  custo_unit: number
  preco_venda: number
  ativo: boolean
}

/** Lotes ativos de todos os produtos (para exibir o controle por lote). */
export async function listInventoryLots(): Promise<InventoryLot[]> {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('id, inventory_id, marca, lote, validade, qtd_atual, custo_unit, preco_venda, ativo')
    .eq('ativo', true)
    .order('validade', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase()

export async function createInventoryItem(clinicId: string, input: InventoryInput) {
  const { data, error } = await supabase
    .from('inventory')
    .insert({ clinic_id: clinicId, ...input })
    .select()
    .single()
  if (error) throw error
  // Cria o primeiro lote espelhando o cadastro (quantidade inicial direta, como no produto).
  await supabase.from('inventory_lots').insert({
    clinic_id: clinicId, inventory_id: data.id,
    marca: input.marca ?? null, lote: input.lote ?? null, validade: input.validade ?? null,
    qtd_atual: input.qtd_atual ?? 0, custo_unit: input.custo_unit ?? 0, preco_venda: input.preco_venda ?? 0,
  }).select('id').single().then(() => {}, () => {})
  return data as InventoryItem
}

/**
 * Entrada de estoque POR LOTE: se já existe um lote com a mesma marca+lote+validade,
 * soma a quantidade nele; caso contrário cria um novo lote (relação 1 produto -> N lotes).
 * O gatilho atualiza o saldo do lote e o total do produto.
 */
export async function addStockEntryLot(args: {
  clinicId: string
  inventoryId: string
  marca?: string | null
  lote?: string | null
  validade?: string | null
  quantidade: number
  custoUnit?: number
  precoVenda?: number
}): Promise<void> {
  const { clinicId, inventoryId, quantidade } = args
  const marca = args.marca ?? null, lote = args.lote ?? null, validade = args.validade ?? null

  const { data: lots } = await supabase
    .from('inventory_lots')
    .select('id, marca, lote, validade')
    .eq('inventory_id', inventoryId)
    .eq('ativo', true)
  const match = (lots ?? []).find(
    (l) => norm(l.marca) === norm(marca) && norm(l.lote) === norm(lote) && (l.validade ?? '') === (validade ?? ''),
  )

  let lotId: string
  if (match) {
    lotId = match.id
    const patch: Record<string, unknown> = {}
    if (args.custoUnit != null) patch.custo_unit = args.custoUnit
    if (args.precoVenda != null) patch.preco_venda = args.precoVenda
    if (Object.keys(patch).length) await supabase.from('inventory_lots').update(patch).eq('id', lotId)
  } else {
    const { data: novo, error } = await supabase
      .from('inventory_lots')
      .insert({
        clinic_id: clinicId, inventory_id: inventoryId, marca, lote, validade,
        qtd_atual: 0, custo_unit: args.custoUnit ?? 0, preco_venda: args.precoVenda ?? 0,
      })
      .select('id')
      .single()
    if (error) throw error
    lotId = novo.id
  }

  const { error: mErr } = await supabase.from('stock_movements').insert({
    clinic_id: clinicId, inventory_id: inventoryId, lot_id: lotId, tipo: 'entrada',
    quantidade, custo_unit: args.custoUnit ?? null, preco_venda: args.precoVenda ?? null,
  })
  if (mErr) throw mErr
}

/** Atualiza os dados cadastrais de um item (não altera a quantidade atual). */
export async function updateInventoryItem(id: string, input: InventoryInput) {
  const patch: Record<string, unknown> = { ...input }
  delete patch.qtd_atual // quantidade é controlada por movimentações, não pela edição
  const { data, error } = await supabase
    .from('inventory')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as InventoryItem
}

/** Ajuste direto de quantidade (uso exclusivo de admin para correções de inventário). */
export async function setInventoryQty(id: string, qtd: number): Promise<void> {
  const { error } = await supabase.from('inventory').update({ qtd_atual: qtd }).eq('id', id)
  if (error) throw error
}

/** Remove (desativa) um item do estoque — soft delete para preservar histórico. */
export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from('inventory').update({ ativo: false }).eq('id', id)
  if (error) throw error
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

/** Edita os dados cadastrais de um lote (não altera a quantidade). */
export async function updateInventoryLot(id: string, patch: {
  marca?: string | null
  lote?: string | null
  validade?: string | null
  custo_unit?: number
  preco_venda?: number
  ativo?: boolean
}): Promise<void> {
  const { error } = await supabase.from('inventory_lots').update(patch).eq('id', id)
  if (error) throw error
}

/** Ajusta o saldo de um lote (delta pode ser negativo). O gatilho atualiza lote e total do produto. */
export async function adjustInventoryLot(clinicId: string, inventoryId: string, lotId: string, delta: number, motivo?: string): Promise<void> {
  if (!delta) return
  const { error } = await supabase.from('stock_movements').insert({
    clinic_id: clinicId, inventory_id: inventoryId, lot_id: lotId, tipo: 'ajuste', quantidade: delta, motivo: motivo ?? 'Ajuste de saldo (lote)',
  })
  if (error) throw error
}

/** Exclui um lote: zera o saldo (reduz o total do produto) e desativa o lote (preserva histórico). */
export async function deleteInventoryLot(clinicId: string, inventoryId: string, lotId: string, qtdAtual: number): Promise<void> {
  if (Number(qtdAtual) !== 0) await adjustInventoryLot(clinicId, inventoryId, lotId, -Number(qtdAtual), 'Exclusão de lote')
  await updateInventoryLot(lotId, { ativo: false })
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
