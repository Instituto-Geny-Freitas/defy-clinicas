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
