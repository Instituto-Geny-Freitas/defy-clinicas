import { supabase } from '@/lib/supabase'

export type PlanStatus = 'rascunho' | 'pendente' | 'consentido' | 'cancelado'

export interface TreatmentPlan {
  id: string
  patient_id: string
  titulo: string | null
  texto: string | null
  num_sessoes: number | null
  frequencia: string | null
  valor_total: number | null
  origem_ia: boolean
  data: string
  created_at: string
  status: PlanStatus
  enviado_em: string | null
  consentido_em: string | null
  consentido_via: 'portal' | 'staff' | null
  assinatura_hash: string | null
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface TextSnippet {
  id: string
  categoria: string | null
  titulo: string
  conteudo: string
}

export async function listTreatmentPlans(patientId: string): Promise<TreatmentPlan[]> {
  const { data, error } = await supabase
    .from('treatment_plans')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ---- Itens do plano (procedimentos/suplementações com sessões e preço) ------
export interface PlanItem {
  id: string
  treatment_plan_id: string
  tipo: 'procedimento' | 'suplementacao'
  procedure_type_id: string | null
  active_ingredient_id: string | null
  nome: string
  preco_unit: number
  sessoes: number
  frequencia: string | null
  ordem: number
}
export interface PlanItemInput {
  id?: string
  tipo: 'procedimento' | 'suplementacao'
  procedure_type_id?: string | null
  active_ingredient_id?: string | null
  nome: string
  preco_unit: number
  sessoes: number
  frequencia?: string | null
}

export async function listPlanItems(planId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('treatment_plan_items')
    .select('*')
    .eq('treatment_plan_id', planId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Itens de vários planos de uma vez (para exibir na lista). */
export async function listPlanItemsForPlans(planIds: string[]): Promise<PlanItem[]> {
  if (planIds.length === 0) return []
  const { data, error } = await supabase
    .from('treatment_plan_items')
    .select('*')
    .in('treatment_plan_id', planIds)
    .order('ordem', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Nº de realizações vinculadas a cada item (procedimentos + suplementações). */
export async function planItemsRealizadas(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {}
  const [{ data: p }, { data: s }] = await Promise.all([
    supabase.from('procedures_log').select('treatment_plan_item_id').in('treatment_plan_item_id', itemIds),
    supabase.from('supplementations').select('treatment_plan_item_id').in('treatment_plan_item_id', itemIds),
  ])
  const map: Record<string, number> = {}
  for (const r of [...(p ?? []), ...(s ?? [])]) {
    const id = (r as { treatment_plan_item_id: string | null }).treatment_plan_item_id
    if (id) map[id] = (map[id] ?? 0) + 1
  }
  return map
}

/** Um item do plano pelo id (para derivar o plano ao editar procedimento/suplementação). */
export async function getPlanItem(id: string): Promise<PlanItem | null> {
  const { data, error } = await supabase.from('treatment_plan_items').select('*').eq('id', id).maybeSingle()
  if (error) return null
  return data
}

/** Itens de um plano com saldo de sessões (sessões − realizadas). */
export async function listPlanItemsComSaldo(planId: string): Promise<(PlanItem & { realizadas: number; saldo: number })[]> {
  const items = await listPlanItems(planId)
  const realiz = await planItemsRealizadas(items.map((i) => i.id))
  return items.map((i) => { const r = realiz[i.id] ?? 0; return { ...i, realizadas: r, saldo: Math.max(0, i.sessoes - r) } })
}

/** Salva os itens do plano preservando ids (update/insert/delete-diff).
 *  Bloqueia a remoção de itens que já têm realizações vinculadas. */
export async function savePlanItems(clinicId: string, planId: string, items: PlanItemInput[]): Promise<void> {
  const existentes = await listPlanItems(planId)
  const manter = new Set(items.filter((i) => i.id).map((i) => i.id as string))
  const remover = existentes.filter((e) => !manter.has(e.id))
  if (remover.length > 0) {
    const realiz = await planItemsRealizadas(remover.map((r) => r.id))
    const comUso = remover.filter((r) => (realiz[r.id] ?? 0) > 0)
    if (comUso.length > 0) throw new Error(`Não é possível remover itens já realizados: ${comUso.map((r) => r.nome).join(', ')}.`)
    const { error } = await supabase.from('treatment_plan_items').delete().in('id', remover.map((r) => r.id))
    if (error) throw error
  }
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]
    const row = {
      clinic_id: clinicId, treatment_plan_id: planId, tipo: it.tipo,
      procedure_type_id: it.procedure_type_id ?? null, active_ingredient_id: it.active_ingredient_id ?? null,
      nome: it.nome, preco_unit: it.preco_unit, sessoes: it.sessoes, frequencia: it.frequencia ?? null, ordem: idx,
    }
    if (it.id) { const { error } = await supabase.from('treatment_plan_items').update(row).eq('id', it.id); if (error) throw error }
    else { const { error } = await supabase.from('treatment_plan_items').insert(row); if (error) throw error }
  }
}

export async function listSnippets(categoria = 'plano'): Promise<TextSnippet[]> {
  const { data, error } = await supabase
    .from('treatment_text_snippets')
    .select('id, categoria, titulo, conteudo')
    .eq('ativo', true)
    .eq('categoria', categoria)
    .order('titulo')
  if (error) throw error
  return data ?? []
}

/** Textos-padrão ativos de uma ou mais categorias (ex.: ['orientacao','outro']). */
export async function listSnippetsByCategorias(categorias: string[]): Promise<TextSnippet[]> {
  if (categorias.length === 0) return []
  const { data, error } = await supabase
    .from('treatment_text_snippets')
    .select('id, categoria, titulo, conteudo')
    .eq('ativo', true)
    .in('categoria', categorias)
    .order('titulo')
  if (error) throw error
  return data ?? []
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  titulo?: string | null
  texto: string
  num_sessoes?: number | null
  frequencia?: string | null
  valor_total?: number | null
}

/** Sugere o texto do plano via IA (Edge Function). Requer OPENAI_API_KEY no servidor. */
export async function suggestPlanIA(patientId: string, instrucao?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('treatment-plan-suggest', {
    body: { patient_id: patientId, instrucao },
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return (data as { texto: string }).texto
}

export async function updateTreatmentPlan(
  id: string,
  patch: { titulo?: string | null; texto?: string; num_sessoes?: number | null; frequencia?: string | null; valor_total?: number | null },
): Promise<void> {
  const { error } = await supabase.from('treatment_plans').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTreatmentPlan(id: string): Promise<void> {
  const { error } = await supabase.from('treatment_plans').delete().eq('id', id)
  if (error) throw error
}

export async function createTreatmentPlan(args: CreateArgs): Promise<TreatmentPlan> {
  const { data, error } = await supabase
    .from('treatment_plans')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
      titulo: args.titulo ?? null,
      texto: args.texto,
      num_sessoes: args.num_sessoes ?? null,
      frequencia: args.frequencia ?? null,
      valor_total: args.valor_total ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// --- Envio ao paciente + consentimento (ciência) ----------------------------

/** Envia o plano ao paciente: passa a "pendente" e registra o envio. */
export async function sendTreatmentPlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('treatment_plans')
    .update({ status: 'pendente', enviado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** A equipe registra manualmente que o paciente consentiu (ex.: presencialmente). */
export async function markPlanConsentByStaff(id: string): Promise<void> {
  const { error } = await supabase
    .from('treatment_plans')
    .update({ status: 'consentido', consentido_em: new Date().toISOString(), consentido_via: 'staff' })
    .eq('id', id)
  if (error) throw error
}

/** Planos que o paciente pode ver no portal (enviados; nunca rascunhos). */
export async function listPatientPlans(patientId: string): Promise<TreatmentPlan[]> {
  const { data, error } = await supabase
    .from('treatment_plans')
    .select('*')
    .eq('patient_id', patientId)
    .neq('status', 'rascunho')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Ciência do paciente no portal. Gera um hash de autenticidade (conteúdo do plano +
 * identidade do paciente + instante) e grava via RPC security definer, que só altera
 * as colunas de consentimento do próprio plano quando ele está "pendente".
 */
export async function acknowledgePlan(
  plano: TreatmentPlan,
  paciente: { nome?: string | null; cpf?: string | null },
): Promise<void> {
  const agora = new Date().toISOString()
  const hash = await sha256Hex(
    [plano.id, plano.titulo ?? '', plano.texto ?? '', paciente.nome ?? '', paciente.cpf ?? '', agora].join('|'),
  )
  const { error } = await supabase.rpc('plan_patient_acknowledge', { p_plan: plano.id, p_hash: hash })
  if (error) throw error
}
