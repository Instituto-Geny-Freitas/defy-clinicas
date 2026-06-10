import { supabase } from '@/lib/supabase'

// ---- Tipos de despesa -------------------------------------------------------
export interface ExpenseType { id: string; nome: string; ativo: boolean }

export async function listExpenseTypes(): Promise<ExpenseType[]> {
  const { data, error } = await supabase.from('expense_types').select('id, nome, ativo').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}
export async function createExpenseType(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('expense_types').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}
export async function deleteExpenseType(id: string): Promise<void> {
  const { error } = await supabase.from('expense_types').delete().eq('id', id)
  if (error) throw error
}

// ---- Despesas ---------------------------------------------------------------
export interface Expense {
  id: string
  expense_type_id: string | null
  descricao: string | null
  valor: number
  data: string
  pago: boolean
  recorrencia_grupo: string | null
  expense_types?: { nome: string } | null
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
    .select('*, expense_types(nome)')
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
  recorrente?: boolean
  periodo?: Periodo
  repeticoes?: number
}): Promise<void> {
  const grupo = args.recorrente ? crypto.randomUUID() : null
  const n = args.recorrente ? Math.max(1, args.repeticoes ?? 1) : 1
  const rows = Array.from({ length: n }, (_, i) => ({
    clinic_id: args.clinicId,
    expense_type_id: args.expenseTypeId ?? null,
    descricao: args.descricao ?? null,
    valor: args.valor,
    data: i === 0 ? args.data : addPeriodo(args.data, args.periodo ?? 'mensal', i),
    pago: i === 0 ? args.pago : false,
    recorrencia_grupo: grupo,
  }))
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
