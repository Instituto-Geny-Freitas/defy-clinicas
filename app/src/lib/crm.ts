import { supabase } from '@/lib/supabase'
import { createPatient } from '@/lib/patients'

export type LeadEtapa = 'novo' | 'contato' | 'avaliacao' | 'orcamento' | 'ganho' | 'perdido'

/** Etapas do funil na ordem, com rótulo e cor do chip. 'perdido' é terminal lateral. */
export const ETAPAS: { key: LeadEtapa; label: string; chip: string }[] = [
  { key: 'novo', label: 'Novo', chip: 'bg-sky-100 text-sky-700' },
  { key: 'contato', label: 'Em contato', chip: 'bg-violet-100 text-violet-700' },
  { key: 'avaliacao', label: 'Avaliação', chip: 'bg-amber-100 text-amber-700' },
  { key: 'orcamento', label: 'Orçamento', chip: 'bg-indigo-100 text-indigo-700' },
  { key: 'ganho', label: 'Ganho', chip: 'bg-emerald-100 text-emerald-700' },
  { key: 'perdido', label: 'Perdido', chip: 'bg-rose-100 text-rose-700' },
]
/** Sequência do funil para o botão "Avançar" (perdido fica fora). */
export const FUNIL: LeadEtapa[] = ['novo', 'contato', 'avaliacao', 'orcamento', 'ganho']
export const ORIGENS = ['Instagram', 'Facebook', 'WhatsApp', 'Indicação', 'Google', 'Site', 'Presencial', 'Outro']

export interface Lead {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
  origem: string | null
  interesse: string | null
  etapa: LeadEtapa
  responsavel_id: string | null
  valor_estimado: number
  proxima_acao: string | null
  observacoes: string | null
  motivo_perda: string | null
  patient_id: string | null
  created_at: string
  professionals?: { nome: string } | null
}

export interface LeadInput {
  nome: string
  whatsapp?: string | null
  email?: string | null
  origem?: string | null
  interesse?: string | null
  etapa?: LeadEtapa
  responsavel_id?: string | null
  valor_estimado?: number
  proxima_acao?: string | null
  observacoes?: string | null
  motivo_perda?: string | null
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*, professionals(nome)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((l) => ({
    ...l,
    professionals: Array.isArray(l.professionals) ? (l.professionals[0] ?? null) : l.professionals,
  })) as Lead[]
}

function clean(input: LeadInput): Record<string, unknown> {
  return {
    nome: input.nome.trim(),
    whatsapp: input.whatsapp?.trim() || null,
    email: input.email?.trim() || null,
    origem: input.origem?.trim() || null,
    interesse: input.interesse?.trim() || null,
    etapa: input.etapa ?? 'novo',
    responsavel_id: input.responsavel_id || null,
    valor_estimado: Number(input.valor_estimado) || 0,
    proxima_acao: input.proxima_acao || null, // '' → null (coluna date)
    observacoes: input.observacoes?.trim() || null,
    motivo_perda: input.motivo_perda?.trim() || null,
  }
}

export async function createLead(clinicId: string, input: LeadInput): Promise<void> {
  const { error } = await supabase.from('crm_leads').insert({ clinic_id: clinicId, ...clean(input) })
  if (error) throw error
}

export async function updateLead(id: string, input: LeadInput): Promise<void> {
  const { error } = await supabase.from('crm_leads').update(clean(input)).eq('id', id)
  if (error) throw error
}

/** Move o lead de etapa (kanban). Para 'perdido', informe o motivo. */
export async function moveLeadEtapa(id: string, etapa: LeadEtapa, motivoPerda?: string | null): Promise<void> {
  const patch: Record<string, unknown> = { etapa }
  if (etapa === 'perdido') patch.motivo_perda = motivoPerda?.trim() || null
  const { error } = await supabase.from('crm_leads').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('crm_leads').delete().eq('id', id)
  if (error) throw error
}

// ---- Timeline de interações / follow-ups -----------------------------------
export type AtividadeTipo = 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'etapa' | 'outro'
/** Tipos que o usuário escolhe ao registrar ('etapa' é gerado automaticamente). */
export const TIPOS_ATIVIDADE: { key: AtividadeTipo; label: string }[] = [
  { key: 'nota', label: 'Nota' },
  { key: 'ligacao', label: 'Ligação' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'reuniao', label: 'Reunião' },
  { key: 'outro', label: 'Outro' },
]
export const ATIVIDADE_LABEL: Record<AtividadeTipo, string> = {
  nota: 'Nota', ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', reuniao: 'Reunião', etapa: 'Etapa', outro: 'Outro',
}

export interface LeadActivity {
  id: string
  lead_id: string
  tipo: AtividadeTipo
  nota: string | null
  created_by: string | null
  created_at: string
}

export async function listLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from('crm_lead_activities')
    .select('id, lead_id, tipo, nota, created_by, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeadActivity[]
}

export async function addLeadActivity(args: {
  clinicId: string; leadId: string; tipo: AtividadeTipo; nota?: string | null; createdBy?: string | null
}): Promise<void> {
  const { error } = await supabase.from('crm_lead_activities').insert({
    clinic_id: args.clinicId, lead_id: args.leadId, tipo: args.tipo,
    nota: args.nota?.trim() || null, created_by: args.createdBy ?? null,
  })
  if (error) throw error
}

/** Atualiza só a data do próximo follow-up do lead. */
export async function setLeadFollowup(id: string, proximaAcao: string | null): Promise<void> {
  const { error } = await supabase.from('crm_leads').update({ proxima_acao: proximaAcao || null }).eq('id', id)
  if (error) throw error
}

/** Converte um lead em paciente: cria o cadastro e vincula (etapa vira 'ganho'). */
export async function convertLeadToPatient(clinicId: string, lead: Lead): Promise<string> {
  const paciente = await createPatient(clinicId, {
    nome: lead.nome,
    whatsapp: lead.whatsapp ?? null,
    email: lead.email ?? null,
  })
  const { error } = await supabase.from('crm_leads').update({ patient_id: paciente.id, etapa: 'ganho' }).eq('id', lead.id)
  if (error) throw error
  return paciente.id
}
