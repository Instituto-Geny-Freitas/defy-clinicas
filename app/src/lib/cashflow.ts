import { supabase } from '@/lib/supabase'

// ---- Tipos de despesa -------------------------------------------------------
export type Classificacao = 'produto' | 'fixo'
export interface ExpenseType { id: string; nome: string; tipo: Classificacao; ativo: boolean }

export async function listExpenseTypes(): Promise<ExpenseType[]> {
  const { data, error } = await supabase.from('expense_types').select('id, nome, tipo, ativo').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}
export async function createExpenseType(clinicId: string, nome: string, tipo: Classificacao = 'fixo'): Promise<void> {
  const { error } = await supabase.from('expense_types').insert({ clinic_id: clinicId, nome, tipo })
  if (error) throw error
}
export async function updateExpenseType(id: string, patch: { nome?: string; tipo?: Classificacao }): Promise<void> {
  const { error } = await supabase.from('expense_types').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteExpenseType(id: string): Promise<void> {
  const { error } = await supabase.from('expense_types').delete().eq('id', id)
  if (error) throw error
}

// ---- Despesas ---------------------------------------------------------------
export type FormaPagamento = 'pix' | 'cartao' | 'outro'

export interface Expense {
  id: string
  expense_type_id: string | null
  descricao: string | null
  valor: number
  data: string
  pago: boolean
  classificacao: Classificacao
  forma_pagamento: FormaPagamento | null
  quantidade: number
  parcela_num: number | null
  parcela_total: number | null
  recorrencia_grupo: string | null
  expense_types?: { nome: string; tipo?: Classificacao } | null
}

export type Periodo = 'semanal' | 'quinzenal' | 'mensal' | 'anual'

function addPeriodo(isoDate: string, periodo: Periodo, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  if (periodo === 'semanal') base.setDate(base.getDate() + 7 * n)
  else if (periodo === 'quinzenal') base.setDate(base.getDate() + 15 * n)
  else if (periodo === 'mensal') base.setMonth(base.getMonth() + n)
  else if (periodo === 'anual') base.setFullYear(base.getFullYear() + n)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

export async function listExpenses(de: string, ate: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_types(nome, tipo)')
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createExpense(args: {
  clinicId: string
  expenseTypeId?: string | null
  descricao?: string | null
  valor: number
  data: string
  pago: boolean
  classificacao: Classificacao
  formaPagamento?: FormaPagamento | null
  quantidade?: number
  // Produto comprado parcelado: divide o valor total em N parcelas mensais.
  parcelado?: boolean
  parcelas?: number
  // Gasto fixo recorrente: repete o valor cheio a cada período.
  recorrente?: boolean
  periodo?: Periodo
  repeticoes?: number
}): Promise<void> {
  const base = {
    clinic_id: args.clinicId,
    expense_type_id: args.expenseTypeId ?? null,
    descricao: args.descricao ?? null,
    classificacao: args.classificacao,
    forma_pagamento: args.formaPagamento ?? null,
    quantidade: Math.max(1, args.quantidade ?? 1),
  }

  let rows: Record<string, unknown>[]

  if (args.parcelado) {
    // Parcelamento: valor total dividido em N parcelas mensais subsequentes.
    const n = Math.max(1, args.parcelas ?? 1)
    const grupo = crypto.randomUUID()
    const cada = Math.round((args.valor / n) * 100) / 100
    const ajuste = Math.round((args.valor - cada * n) * 100) / 100 // sobra de centavos na 1ª
    rows = Array.from({ length: n }, (_, i) => ({
      ...base,
      valor: i === 0 ? cada + ajuste : cada,
      data: i === 0 ? args.data : addPeriodo(args.data, 'mensal', i),
      pago: i === 0 ? args.pago : false,
      parcela_num: i + 1,
      parcela_total: n,
      recorrencia_grupo: grupo,
    }))
  } else if (args.recorrente) {
    // Recorrência: valor cheio repetido a cada período.
    const n = Math.max(1, args.repeticoes ?? 1)
    const grupo = crypto.randomUUID()
    rows = Array.from({ length: n }, (_, i) => ({
      ...base,
      valor: args.valor,
      data: i === 0 ? args.data : addPeriodo(args.data, args.periodo ?? 'mensal', i),
      pago: i === 0 ? args.pago : false,
      recorrencia_grupo: grupo,
    }))
  } else {
    rows = [{ ...base, valor: args.valor, data: args.data, pago: args.pago }]
  }

  const { error } = await supabase.from('expenses').insert(rows)
  if (error) throw error
}

export async function setExpensePaid(id: string, pago: boolean): Promise<void> {
  const { error } = await supabase.from('expenses').update({ pago }).eq('id', id)
  if (error) throw error
}
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ---- Movimentos financeiros (caixa/aplicação/aporte) ------------------------
export type MovTipo = 'caixa' | 'aplicacao' | 'aporte'
export interface FinancialMovement {
  id: string
  tipo: MovTipo
  descricao: string | null
  valor: number
  data: string
}

export async function listMovements(): Promise<FinancialMovement[]> {
  const { data, error } = await supabase.from('financial_movements').select('*').order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}
export async function createMovement(clinicId: string, input: { tipo: MovTipo; descricao?: string; valor: number; data: string }): Promise<void> {
  const { error } = await supabase.from('financial_movements').insert({ clinic_id: clinicId, ...input })
  if (error) throw error
}
export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from('financial_movements').delete().eq('id', id)
  if (error) throw error
}

// ---- Receitas (pagamentos) --------------------------------------------------
export interface PaymentRow {
  id: string
  valor: number
  metodo: string
  status: string
  pago_em: string | null
  patients?: { nome: string } | null
}

export async function listPaymentsPeriodo(de: string, ate: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, valor, metodo, status, pago_em, patients(nome)')
    .eq('status', 'pago')
    .gte('pago_em', de + 'T00:00:00')
    .lte('pago_em', ate + 'T23:59:59')
    .order('pago_em', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as PaymentRow[]
}
