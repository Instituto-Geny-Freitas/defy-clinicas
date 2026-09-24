import { supabase } from '@/lib/supabase'

/**
 * Relatório de pagamentos efetuados PELOS PACIENTES, por mês/ano.
 *
 * Critério "pagamento do paciente" (e não "caixa recebido"):
 *  - Pagamentos à vista (Pix, dinheiro, cartão à vista, débito, transferência):
 *    uma linha por pagamento liquidado ('pago'), datado por `pago_em`.
 *  - Cartão parcelado: o paciente liquida no ato, então vira UMA linha pelo
 *    valor total, datada pela venda (`created_at` do grupo), marcada "parcelado".
 *  - `metodo = 'credito'` (consumo de crédito do paciente) é ignorado: não é
 *    entrada nova, apenas abate de saldo — consistente com os demais relatórios.
 *
 * `liquidado_paciente = true` já exclui parcelas estornadas/canceladas (o
 * chargeback e o cancelamento zeram esse campo), então filtramos só por ele.
 */
export interface PatientPaymentRow {
  patientId: string
  nome: string
  cpf: string | null
  data: string // ISO do pagamento (à vista: pago_em; parcelado: venda)
  valor: number
  metodo: string // metodo bruto (pix, cartao_credito, ...)
  cartaoParcelado: boolean
  parcelas: number // N (1 quando à vista)
  aReceber: number // saldo atual do paciente (todos os orçamentos)
}

function monthRange(ano: number, mes: number): { de: string; ate: string } {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const mm = String(mes + 1).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

type Joined = { patients?: { nome: string; cpf: string | null } | { nome: string; cpf: string | null }[] | null }
const paciente = (r: Joined) => (Array.isArray(r.patients) ? r.patients[0] ?? null : r.patients)

export async function listPatientPaymentsMonth(ano: number, mes: number): Promise<PatientPaymentRow[]> {
  const { de, ate } = monthRange(ano, mes)

  const [avista, parc, bal] = await Promise.all([
    // 1) Pagamentos à vista (sem parcelamento) liquidados no mês.
    supabase
      .from('payments')
      .select('valor, metodo, pago_em, patient_id, patients(nome, cpf)')
      .eq('status', 'pago')
      .neq('metodo', 'credito')
      .is('parcelamento_grupo', null)
      .gte('pago_em', de + 'T00:00:00')
      .lte('pago_em', ate + 'T23:59:59'),
    // 2) Cartão parcelado: parcelas liquidadas pelo paciente, venda no mês.
    supabase
      .from('payments')
      .select('valor, metodo, total_parcelas, parcelamento_grupo, created_at, patient_id, patients(nome, cpf)')
      .not('parcelamento_grupo', 'is', null)
      .eq('liquidado_paciente', true)
      .gte('created_at', de + 'T00:00:00')
      .lte('created_at', ate + 'T23:59:59'),
    // 3) Saldo a receber por paciente (atual, somando todos os orçamentos).
    supabase.from('v_quote_balances').select('patient_id, saldo_a_receber'),
  ])
  if (avista.error) throw avista.error
  if (parc.error) throw parc.error
  if (bal.error) throw bal.error

  const aReceberPorPaciente = new Map<string, number>()
  for (const b of bal.data ?? []) {
    const v = Number(b.saldo_a_receber) || 0
    if (v > 0.005) aReceberPorPaciente.set(b.patient_id, (aReceberPorPaciente.get(b.patient_id) ?? 0) + v)
  }

  const rows: PatientPaymentRow[] = []

  for (const r of avista.data ?? []) {
    const p = paciente(r as Joined)
    rows.push({
      patientId: r.patient_id,
      nome: p?.nome ?? '—',
      cpf: p?.cpf ?? null,
      data: (r.pago_em as string) ?? '',
      valor: Number(r.valor) || 0,
      metodo: r.metodo as string,
      cartaoParcelado: false,
      parcelas: 1,
      aReceber: aReceberPorPaciente.get(r.patient_id) ?? 0,
    })
  }

  // Agrupa parcelas de cartão por grupo → uma linha pelo valor total da venda.
  type G = { valor: number; data: string; metodo: string; parcelas: number; patientId: string; nome: string; cpf: string | null }
  const grupos = new Map<string, G>()
  for (const r of parc.data ?? []) {
    const p = paciente(r as Joined)
    const grupo = r.parcelamento_grupo as string
    const g = grupos.get(grupo) ?? {
      valor: 0,
      data: (r.created_at as string) ?? '',
      metodo: r.metodo as string,
      parcelas: 0,
      patientId: r.patient_id,
      nome: p?.nome ?? '—',
      cpf: p?.cpf ?? null,
    }
    g.valor += Number(r.valor) || 0
    if (r.created_at && r.created_at < g.data) g.data = r.created_at as string
    g.parcelas = Math.max(g.parcelas, Number(r.total_parcelas) || 0)
    grupos.set(grupo, g)
  }
  for (const g of grupos.values()) {
    rows.push({
      patientId: g.patientId,
      nome: g.nome,
      cpf: g.cpf,
      data: g.data,
      valor: Math.round(g.valor * 100) / 100,
      metodo: g.metodo,
      cartaoParcelado: true,
      parcelas: g.parcelas,
      aReceber: aReceberPorPaciente.get(g.patientId) ?? 0,
    })
  }

  rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  return rows
}

/** Rótulo da forma de pagamento (cartão indica à vista/parcelado). */
export function formaPagamentoLabel(row: PatientPaymentRow): string {
  switch (row.metodo) {
    case 'pix':
      return 'Pix'
    case 'cartao_credito':
      return row.cartaoParcelado ? `Cartão de crédito · parcelado (${row.parcelas}x)` : 'Cartão de crédito · à vista'
    case 'cartao_debito':
      return 'Cartão de débito'
    case 'dinheiro':
      return 'Dinheiro'
    case 'transferencia':
      return 'Transferência'
    default:
      return 'Outro'
  }
}

/** Formata CPF (11 dígitos) como XXX.XXX.XXX-XX; devolve o original se inesperado. */
export function formatCPF(cpf?: string | null): string {
  const d = (cpf ?? '').replace(/\D/g, '')
  if (d.length !== 11) return cpf?.trim() || '—'
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
