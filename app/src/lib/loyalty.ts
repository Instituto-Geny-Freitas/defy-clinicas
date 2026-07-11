import { supabase } from '@/lib/supabase'

// ---- Configuração (clinics.dados_empresa.fidelidade) ------------------------
export interface LoyaltyConfig {
  ativo: boolean
  /** Percentual de cashback sobre pagamentos reais (ex.: 5 = 5%). */
  cashbackPct: number
}

const DEFAULT_CONFIG: LoyaltyConfig = { ativo: false, cashbackPct: 0 }

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const f = (data?.dados_empresa as { fidelidade?: Partial<LoyaltyConfig> } | null)?.fidelidade
  if (!f) return { ...DEFAULT_CONFIG }
  return { ativo: !!f.ativo, cashbackPct: Number(f.cashbackPct) || 0 }
}

export async function saveLoyaltyConfig(clinicId: string, cfg: LoyaltyConfig): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const dados = { ...((data?.dados_empresa as Record<string, unknown>) ?? {}), fidelidade: cfg }
  const { error } = await supabase.from('clinics').update({ dados_empresa: dados }).eq('id', clinicId)
  if (error) throw error
}

// ---- Cashback por paciente (equipe) -----------------------------------------
export interface LoyaltyRow {
  patientId: string
  nome: string
  totalGasto: number
  acumulado: number   // cashback gerado (pct * total gasto)
  concedido: number   // cashback já convertido em crédito
  disponivel: number  // acumulado - concedido (>= 0)
}

/**
 * Calcula o cashback por paciente: acumulado = pct × pagamentos reais;
 * concedido = grants de cashback já feitos; disponível = acumulado − concedido.
 */
export async function listLoyalty(): Promise<LoyaltyRow[]> {
  const cfg = await getLoyaltyConfig()
  const pct = cfg.cashbackPct / 100

  const [{ data: pays }, { data: grants }] = await Promise.all([
    supabase.from('payments').select('patient_id, valor').eq('status', 'pago').neq('metodo', 'credito'),
    supabase.from('patient_credit_grants').select('patient_id, valor').eq('tipo', 'cashback'),
  ])

  const gastoPorPac = new Map<string, number>()
  for (const p of pays ?? []) if (p.patient_id) gastoPorPac.set(p.patient_id, (gastoPorPac.get(p.patient_id) ?? 0) + Number(p.valor))
  const concedidoPorPac = new Map<string, number>()
  for (const g of grants ?? []) if (g.patient_id) concedidoPorPac.set(g.patient_id, (concedidoPorPac.get(g.patient_id) ?? 0) + Number(g.valor))

  const ids = Array.from(gastoPorPac.keys())
  if (ids.length === 0) return []
  const { data: nomes } = await supabase.from('patients').select('id, nome').in('id', ids)
  const nomePorId = new Map((nomes ?? []).map((n) => [n.id, n.nome]))

  const rows: LoyaltyRow[] = ids.map((id) => {
    const totalGasto = gastoPorPac.get(id) ?? 0
    const acumulado = Math.round(totalGasto * pct * 100) / 100
    const concedido = concedidoPorPac.get(id) ?? 0
    const disponivel = Math.max(0, Math.round((acumulado - concedido) * 100) / 100)
    return { patientId: id, nome: nomePorId.get(id) ?? '—', totalGasto, acumulado, concedido, disponivel }
  })
  return rows.filter((r) => r.acumulado > 0.005).sort((a, b) => b.disponivel - a.disponivel)
}

/** Concede o cashback disponível como crédito do paciente. */
export async function grantCashback(args: {
  clinicId: string
  patientId: string
  valor: number
  createdBy?: string | null
}): Promise<void> {
  if (args.valor <= 0) return
  const { error } = await supabase.from('patient_credit_grants').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    valor: args.valor,
    motivo: 'Cashback — programa de fidelidade',
    tipo: 'cashback',
    created_by: args.createdBy ?? null,
  })
  if (error) throw error
}

// ---- Portal do paciente -----------------------------------------------------
/** Cashback do próprio paciente (acumulado, já creditado e disponível a creditar). */
export async function myLoyaltyInfo(patientId: string): Promise<{ acumulado: number; concedido: number; disponivel: number }> {
  const cfg = await getLoyaltyConfig()
  const pct = cfg.cashbackPct / 100
  const [{ data: pays }, { data: grants }] = await Promise.all([
    supabase.from('payments').select('valor').eq('patient_id', patientId).eq('status', 'pago').neq('metodo', 'credito'),
    supabase.from('patient_credit_grants').select('valor').eq('patient_id', patientId).eq('tipo', 'cashback'),
  ])
  const totalGasto = (pays ?? []).reduce((s, p) => s + Number(p.valor), 0)
  const acumulado = Math.round(totalGasto * pct * 100) / 100
  const concedido = (grants ?? []).reduce((s, g) => s + Number(g.valor), 0)
  return { acumulado, concedido, disponivel: Math.max(0, Math.round((acumulado - concedido) * 100) / 100) }
}
