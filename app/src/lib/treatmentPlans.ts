import { supabase } from '@/lib/supabase'

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
