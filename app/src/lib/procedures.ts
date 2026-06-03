import { supabase } from '@/lib/supabase'

export interface UsedProduct {
  inventory_id: string
  produto: string
  lote?: string | null
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
  produtos_usados: UsedProduct[]
  created_at: string
}

/** Agrupa (somando quantidades) os produtos usados nos procedimentos de um orçamento. */
export function produtosDoOrcamento(procedimentos: ProcedureRecord[], quoteId: string): UsedProduct[] {
  const mapa = new Map<string, UsedProduct>()
  for (const proc of procedimentos.filter((p) => p.quote_id === quoteId)) {
    for (const u of proc.produtos_usados ?? []) {
      const ex = mapa.get(u.produto)
      if (ex) ex.qtd += u.qtd
      else mapa.set(u.produto, { ...u })
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

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  quoteId?: string | null
  procedimento: string
  data: string
  regiao?: string | null
  observacoes?: string | null
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
      produtos_usados: args.produtos,
    })
    .select()
    .single()
  if (error) throw error

  const movimentos = args.produtos
    .filter((p) => p.inventory_id && p.qtd > 0)
    .map((p) => ({
      clinic_id: args.clinicId,
      inventory_id: p.inventory_id,
      tipo: 'saida_uso',
      quantidade: p.qtd,
      procedure_id: proc.id,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
    }))

  if (movimentos.length > 0) {
    const { error: mErr } = await supabase.from('stock_movements').insert(movimentos)
    if (mErr) throw mErr
  }

  return proc
}
