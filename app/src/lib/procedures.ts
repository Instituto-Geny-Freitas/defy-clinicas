import { supabase } from '@/lib/supabase'

export interface UsedProduct {
  inventory_id: string
  produto: string
  lot_id?: string | null
  marca?: string | null
  lote?: string | null
  validade?: string | null
  qtd: number
  preco_venda?: number
}

export interface ProcedureRecord {
  id: string
  patient_id: string
  professional_id: string | null
  quote_id: string | null
  procedimento: string
  data: string
  regiao: string | null
  observacoes: string | null
  valor_cobrado: number
  produtos_usados: UsedProduct[]
  created_at: string
}

/** Agrupa (somando quantidades) os produtos usados nos procedimentos de um orçamento.
 *  A chave inclui lote e validade para preservar a rastreabilidade por lote. */
export function produtosDoOrcamento(procedimentos: ProcedureRecord[], quoteId: string): UsedProduct[] {
  const mapa = new Map<string, UsedProduct>()
  for (const proc of procedimentos.filter((p) => p.quote_id === quoteId)) {
    for (const u of proc.produtos_usados ?? []) {
      const chave = `${u.produto}|${u.lote ?? ''}|${u.validade ?? ''}`
      const ex = mapa.get(chave)
      if (ex) ex.qtd += u.qtd
      else mapa.set(chave, { ...u })
    }
  }
  return [...mapa.values()]
}

export async function listProcedures(patientId: string): Promise<ProcedureRecord[]> {
  const { data, error } = await supabase
    .from('procedures_log')
    .select('*')
    .eq('patient_id', patientId)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Procedimentos avulsos: sem orçamento, com valor a cobrar e ainda não pagos. */
export async function listUnbilledProcedures(patientId: string): Promise<ProcedureRecord[]> {
  const { data, error } = await supabase
    .from('procedures_log')
    .select('*')
    .eq('patient_id', patientId)
    .is('quote_id', null)
    .gt('valor_cobrado', 0)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Vincula procedimentos avulsos a um orçamento (após importá-los no orçamento). */
export async function linkProceduresToQuote(quoteId: string, procedureIds: string[]): Promise<void> {
  if (procedureIds.length === 0) return
  const { error } = await supabase.from('procedures_log').update({ quote_id: quoteId }).in('id', procedureIds)
  if (error) throw error
}

/** Desvincula um procedimento do orçamento (volta a ser avulso/importável). */
export async function unlinkProcedureFromQuote(procedureId: string): Promise<void> {
  const { error } = await supabase.from('procedures_log').update({ quote_id: null }).eq('id', procedureId)
  if (error) throw error
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  quoteId?: string | null
  procedimento: string
  data: string
  regiao?: string | null
  observacoes?: string | null
  valorCobrado?: number
  produtos: UsedProduct[]
}

/**
 * Registra um procedimento e dá baixa nos produtos utilizados.
 * Cada movimentação 'saida_uso' aciona o trigger que decrementa o estoque.
 */
export async function createProcedure(args: CreateArgs): Promise<ProcedureRecord> {
  const { data: proc, error } = await supabase
    .from('procedures_log')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
      quote_id: args.quoteId ?? null,
      procedimento: args.procedimento,
      data: args.data,
      regiao: args.regiao ?? null,
      observacoes: args.observacoes ?? null,
      valor_cobrado: args.valorCobrado ?? 0,
      produtos_usados: args.produtos,
    })
    .select()
    .single()
  if (error) throw error

  await aplicarSaidas(args.clinicId, proc.id, args.patientId, args.professionalId ?? null, args.produtos)
  return proc
}

/** Posta as saídas de estoque (baixa por uso) dos produtos de um procedimento. */
async function aplicarSaidas(clinicId: string, procedureId: string, patientId: string, professionalId: string | null, produtos: UsedProduct[]) {
  const movimentos = produtos
    .filter((p) => p.inventory_id && p.qtd > 0)
    .map((p) => ({
      clinic_id: clinicId, inventory_id: p.inventory_id, lot_id: p.lot_id ?? null, tipo: 'saida_uso', quantidade: p.qtd,
      procedure_id: procedureId, patient_id: patientId, professional_id: professionalId,
    }))
  if (movimentos.length > 0) {
    const { error } = await supabase.from('stock_movements').insert(movimentos)
    if (error) throw error
  }
}

/** Estorna (devolve ao estoque) os produtos atualmente baixados de um procedimento. */
async function estornarSaidas(clinicId: string, proc: ProcedureRecord) {
  const movimentos = (proc.produtos_usados ?? [])
    .filter((p) => p.inventory_id && p.qtd > 0)
    .map((p) => ({
      clinic_id: clinicId, inventory_id: p.inventory_id, lot_id: p.lot_id ?? null, tipo: 'entrada', quantidade: p.qtd,
      procedure_id: proc.id, patient_id: proc.patient_id, professional_id: proc.professional_id,
      motivo: 'Estorno (edição/exclusão de procedimento)',
    }))
  if (movimentos.length > 0) {
    const { error } = await supabase.from('stock_movements').insert(movimentos)
    if (error) throw error
  }
}

interface UpdateArgs {
  clinicId: string
  anterior: ProcedureRecord
  procedimento: string
  data: string
  regiao?: string | null
  observacoes?: string | null
  valorCobrado?: number
  produtos: UsedProduct[]
}

/** Edita um procedimento; reconcilia o estoque (estorna os produtos antigos e aplica os novos). */
export async function updateProcedure(args: UpdateArgs): Promise<void> {
  const novos = args.produtos.filter((p) => p.inventory_id)
  // Reconcilia estoque: devolve os antigos e dá baixa nos novos.
  await estornarSaidas(args.clinicId, args.anterior)
  await aplicarSaidas(args.clinicId, args.anterior.id, args.anterior.patient_id, args.anterior.professional_id, novos)
  const { error } = await supabase
    .from('procedures_log')
    .update({
      procedimento: args.procedimento,
      data: args.data,
      regiao: args.regiao ?? null,
      observacoes: args.observacoes ?? null,
      valor_cobrado: args.valorCobrado ?? 0,
      produtos_usados: novos,
    })
    .eq('id', args.anterior.id)
  if (error) throw error
}

/** Exclui um procedimento devolvendo os produtos ao estoque. */
export async function deleteProcedure(clinicId: string, proc: ProcedureRecord): Promise<void> {
  await estornarSaidas(clinicId, proc)
  const { error } = await supabase.from('procedures_log').delete().eq('id', proc.id)
  if (error) throw error
}
