import { supabase } from '@/lib/supabase'

// ---- Configuração do programa (clinics.dados_empresa.indicacao) -------------
export interface ReferralConfig {
  ativo: boolean
  /** Valor do crédito concedido ao indicador quando o indicado converte. */
  valor: number
  /** Mensagem sugerida ao compartilhar (o código é anexado automaticamente). */
  mensagem: string
}

const DEFAULT_CONFIG: ReferralConfig = { ativo: false, valor: 0, mensagem: '' }

export async function getReferralConfig(): Promise<ReferralConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const r = (data?.dados_empresa as { indicacao?: Partial<ReferralConfig> } | null)?.indicacao
  if (!r) return { ...DEFAULT_CONFIG }
  return { ativo: !!r.ativo, valor: Number(r.valor) || 0, mensagem: r.mensagem ?? '' }
}

export async function saveReferralConfig(clinicId: string, cfg: ReferralConfig): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const dados = { ...((data?.dados_empresa as Record<string, unknown>) ?? {}), indicacao: cfg }
  const { error } = await supabase.from('clinics').update({ dados_empresa: dados }).eq('id', clinicId)
  if (error) throw error
}

// ---- Indicações (equipe) ----------------------------------------------------
export interface ReferralRow {
  indicadoId: string
  indicadoNome: string
  criadoEm: string
  indicadorId: string
  indicadorNome: string
  /** O indicado já fez algum pagamento real (converteu). */
  convertido: boolean
  /** O indicador já recebeu a recompensa desta indicação. */
  recompensado: boolean
  valorRecompensa: number | null
}

/**
 * Lista as indicações (pacientes com indicado_por preenchido), marcando quem
 * converteu (fez pagamento real) e quem já foi recompensado.
 */
export async function listReferrals(): Promise<ReferralRow[]> {
  const { data: refs, error } = await supabase
    .from('patients')
    .select('id, nome, created_at, indicado_por_patient_id')
    .not('indicado_por_patient_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  const lista = refs ?? []
  if (lista.length === 0) return []

  const indicadoIds = lista.map((p) => p.id)
  const indicadorIds = Array.from(new Set(lista.map((p) => p.indicado_por_patient_id).filter(Boolean))) as string[]

  const [{ data: nomes }, { data: pays }, { data: grants }] = await Promise.all([
    supabase.from('patients').select('id, nome').in('id', indicadorIds),
    supabase.from('payments').select('patient_id, valor').eq('status', 'pago').neq('metodo', 'credito').in('patient_id', indicadoIds),
    supabase.from('patient_credit_grants').select('referral_patient_id, patient_id, valor').in('referral_patient_id', indicadoIds),
  ])

  const nomePorId = new Map((nomes ?? []).map((n) => [n.id, n.nome]))
  const converteu = new Set((pays ?? []).map((p) => p.patient_id))
  const recompensa = new Map<string, number>()
  for (const g of grants ?? []) if (g.referral_patient_id) recompensa.set(g.referral_patient_id, Number(g.valor))

  const rows: ReferralRow[] = lista.map((p) => ({
    indicadoId: p.id,
    indicadoNome: p.nome,
    criadoEm: p.created_at as string,
    indicadorId: p.indicado_por_patient_id as string,
    indicadorNome: nomePorId.get(p.indicado_por_patient_id as string) ?? '—',
    convertido: converteu.has(p.id),
    recompensado: recompensa.has(p.id),
    valorRecompensa: recompensa.get(p.id) ?? null,
  }))

  // Elegíveis (converteu e ainda não recompensado) primeiro.
  const rank = (r: ReferralRow) => (r.convertido && !r.recompensado ? 0 : r.recompensado ? 2 : 1)
  return rows.sort((a, b) => rank(a) - rank(b) || b.criadoEm.localeCompare(a.criadoEm))
}

/** Concede a recompensa de indicação como crédito ao indicador (idempotente). */
export async function grantReferralReward(args: {
  clinicId: string
  referrerId: string
  referredId: string
  referredNome: string
  valor: number
  createdBy?: string | null
}): Promise<void> {
  const { data: existing } = await supabase
    .from('patient_credit_grants')
    .select('id')
    .eq('patient_id', args.referrerId)
    .eq('referral_patient_id', args.referredId)
    .limit(1)
  if (existing && existing.length > 0) return
  const { error } = await supabase.from('patient_credit_grants').insert({
    clinic_id: args.clinicId,
    patient_id: args.referrerId,
    valor: args.valor,
    motivo: `Indicação de ${args.referredNome}`,
    referral_patient_id: args.referredId,
    created_by: args.createdBy ?? null,
  })
  if (error) throw error
}

// ---- Portal do paciente -----------------------------------------------------
/** Quanto o paciente já ganhou em crédito por indicações e quantas foram recompensadas. */
export async function myReferralInfo(patientId: string): Promise<{ total: number; count: number }> {
  const { data, error } = await supabase
    .from('patient_credit_grants')
    .select('valor')
    .eq('patient_id', patientId)
    .not('referral_patient_id', 'is', null)
  if (error) return { total: 0, count: 0 }
  const total = (data ?? []).reduce((s, g) => s + Number(g.valor), 0)
  return { total, count: (data ?? []).length }
}
