import { supabase } from '@/lib/supabase'

export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'outro'
export type PaymentStatus = 'pendente' | 'pago' | 'estornado' | 'cancelado'

export interface QuoteItem {
  descricao: string
  qtd: number
  valor_unit: number
  total: number
  /** Origem do item, quando importado — o valor é travado e ajustado no painel de origem. */
  origem?: 'procedimento' | 'suplementacao'
  ref_id?: string
}

export interface Quote {
  id: string
  clinic_id: string
  patient_id: string
  treatment_plan_id: string | null
  numero: string | null
  itens: QuoteItem[]
  valor_bruto: number
  desconto: number
  valor_total: number
  status: QuoteStatus
  created_at: string
  patients?: { nome: string }
}

export interface Payment {
  id: string
  quote_id: string | null
  patient_id: string
  valor: number
  metodo: PaymentMethod
  status: PaymentStatus
  vencimento: string | null
  pago_em: string | null
  pix_copia_cola: string | null
  created_at: string
}

export const brl = (n: number) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function calcItensTotal(itens: QuoteItem[]): number {
  return itens.reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor_unit) || 0), 0)
}

// ---- Orçamentos -----------------------------------------------------------
export async function listQuotes(patientId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listAllQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, patients(nome)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

interface CreateQuoteArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  treatmentPlanId?: string | null
  itens: QuoteItem[]
  desconto: number
}

export async function createQuote(args: CreateQuoteArgs): Promise<Quote> {
  const itens = args.itens.map((i) => ({ ...i, total: (i.qtd || 0) * (i.valor_unit || 0) }))
  const valor_bruto = calcItensTotal(itens)
  const valor_total = Math.max(0, valor_bruto - (args.desconto || 0))
  const { data, error } = await supabase
    .from('quotes')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
      treatment_plan_id: args.treatmentPlanId ?? null,
      itens,
      valor_bruto,
      desconto: args.desconto || 0,
      valor_total,
      status: 'aprovado',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
  if (error) throw error
}

/** Atualiza os itens/desconto de um orçamento, recalculando os totais. */
export async function updateQuote(id: string, args: { itens: QuoteItem[]; desconto: number }): Promise<void> {
  const itens = args.itens.map((i) => ({ ...i, total: (i.qtd || 0) * (i.valor_unit || 0) }))
  const valor_bruto = calcItensTotal(itens)
  const valor_total = Math.max(0, valor_bruto - (args.desconto || 0))
  const { error } = await supabase
    .from('quotes')
    .update({ itens, valor_bruto, desconto: args.desconto || 0, valor_total })
    .eq('id', id)
  if (error) throw error
}

/** Exclui um orçamento. Falha se houver pagamentos vinculados (FK). */
export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error
}

// ---- Pagamentos -----------------------------------------------------------
export async function listPaymentsByPatient(patientId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

interface RegisterPaymentArgs {
  clinicId: string
  quoteId: string
  patientId: string
  valor: number
  metodo: PaymentMethod
  status: PaymentStatus
}

export async function registerPayment(args: RegisterPaymentArgs): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      clinic_id: args.clinicId,
      quote_id: args.quoteId,
      patient_id: args.patientId,
      valor: args.valor,
      metodo: args.metodo,
      status: args.status,
      pago_em: args.status === 'pago' ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePayment(id: string, patch: { valor?: number; metodo?: PaymentMethod }): Promise<void> {
  const { error } = await supabase.from('payments').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}

/** Total já pago (status 'pago') de um orçamento, a partir da lista de pagamentos. */
export function totalPago(payments: Payment[], quoteId: string): number {
  return payments
    .filter((p) => p.quote_id === quoteId && p.status === 'pago')
    .reduce((s, p) => s + Number(p.valor), 0)
}
