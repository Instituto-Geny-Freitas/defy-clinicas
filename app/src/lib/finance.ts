import { supabase } from '@/lib/supabase'

export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'outro' | 'credito'
export type PaymentStatus = 'pendente' | 'pago' | 'estornado' | 'cancelado'

export interface QuoteItem {
  descricao: string
  qtd: number
  valor_unit: number
  total: number
  /** Origem do item, quando importado — o valor é travado e ajustado no painel de origem. */
  origem?: 'procedimento' | 'suplementacao' | 'produto'
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
  parcela: number
  total_parcelas: number
  parcelamento_grupo: string | null
  liquidado_paciente: boolean
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

// ---- Crédito do paciente ----------------------------------------------------
export interface PatientCredit {
  patient_id: string
  credito_gerado: number
  credito_consumido: number
  credito_disponivel: number
  patients?: { nome: string } | null
}

/** Crédito disponível de UM paciente (0 se não houver). */
export async function getPatientCredit(patientId: string): Promise<number> {
  const { data, error } = await supabase
    .from('v_patient_credits')
    .select('credito_disponivel')
    .eq('patient_id', patientId)
    .maybeSingle()
  if (error) throw error
  const v = data ? Number(data.credito_disponivel) : 0
  return v > 0 ? v : 0
}

/** Lista pacientes que possuem crédito disponível (para a aba de créditos). */
export async function listPatientCredits(): Promise<PatientCredit[]> {
  const { data, error } = await supabase
    .from('v_patient_credits')
    .select('patient_id, credito_gerado, credito_consumido, credito_disponivel, patients(nome)')
    .gt('credito_disponivel', 0.005)
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as PatientCredit[]
}

/** Total já pago (status 'pago') de um orçamento — caixa efetivamente realizado. */
export function totalPago(payments: Payment[], quoteId: string): number {
  return payments
    .filter((p) => p.quote_id === quoteId && p.status === 'pago')
    .reduce((s, p) => s + Number(p.valor), 0)
}

/** O paciente liquidou esta linha? (pago à vista OU parcela de cartão não estornada) */
export function liquidadoPaciente(p: Payment): boolean {
  if (p.status === 'estornado' || p.status === 'cancelado') return false
  return p.status === 'pago' || p.liquidado_paciente
}

/** Total liquidado pelo PACIENTE (à vista + cartão parcelado não estornado). */
export function totalLiquidado(payments: Payment[], quoteId: string): number {
  return payments
    .filter((p) => p.quote_id === quoteId && liquidadoPaciente(p))
    .reduce((s, p) => s + Number(p.valor), 0)
}

// ---- Parcelamento no cartão de crédito -------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0')
function addMeses(base: Date, n: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Registra uma venda parcelada no cartão: o paciente liquida no ato, mas a clínica
 * recebe em N parcelas mensais (1ª após ~30 dias). Cada parcela é um "a receber".
 */
export async function registerCardInstallments(args: {
  clinicId: string
  quoteId: string
  patientId: string
  valorTotal: number
  parcelas: number
  baseDate?: string // YYYY-MM-DD (default: hoje)
}): Promise<void> {
  const n = Math.max(2, Math.floor(args.parcelas))
  const grupo = crypto.randomUUID()
  const base = args.baseDate ? new Date(`${args.baseDate}T12:00:00`) : new Date()
  const cada = Math.round((args.valorTotal / n) * 100) / 100
  const ajuste = Math.round((args.valorTotal - cada * n) * 100) / 100 // sobra de centavos na 1ª
  const rows = Array.from({ length: n }, (_, i) => ({
    clinic_id: args.clinicId,
    quote_id: args.quoteId,
    patient_id: args.patientId,
    valor: i === 0 ? cada + ajuste : cada,
    metodo: 'cartao_credito' as PaymentMethod,
    status: 'pendente' as PaymentStatus,
    parcela: i + 1,
    total_parcelas: n,
    vencimento: addMeses(base, i + 1), // +1 mês .. +N meses (1ª após ~30 dias)
    liquidado_paciente: true,
    parcelamento_grupo: grupo,
  }))
  const { error } = await supabase.from('payments').insert(rows)
  if (error) throw error
}

/** Marca uma parcela como efetivamente recebida pela clínica (vira caixa). */
export async function markInstallmentReceived(id: string): Promise<void> {
  const { error } = await supabase.from('payments').update({ status: 'pago', pago_em: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Chargeback de uma parcela: reabre a obrigação do paciente e sai do a receber. */
export async function chargebackPayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').update({ status: 'estornado', liquidado_paciente: false }).eq('id', id)
  if (error) throw error
}

/** Chargeback de toda a venda parcelada (grupo). */
export async function chargebackGroup(grupo: string): Promise<void> {
  const { error } = await supabase.from('payments').update({ status: 'estornado', liquidado_paciente: false }).eq('parcelamento_grupo', grupo)
  if (error) throw error
}

export interface Receivable {
  id: string
  quote_id: string | null
  valor: number
  vencimento: string | null
  parcela: number
  total_parcelas: number
  patients?: { nome: string } | null
}

/** Parcelas de cartão a receber (status pendente) num intervalo de vencimento. */
export async function listCardReceivables(de: string, ate: string): Promise<Receivable[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, quote_id, valor, vencimento, parcela, total_parcelas, patients(nome)')
    .not('parcelamento_grupo', 'is', null)
    .eq('status', 'pendente')
    .gte('vencimento', de).lte('vencimento', ate)
    .order('vencimento', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as Receivable[]
}
