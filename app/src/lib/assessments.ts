import { supabase } from '@/lib/supabase'
import type { FormValues } from '@/forms/types'

export type AssessmentType = 'dermato' | 'capilar' | 'corporal'

export interface AssessmentRecord {
  id: string
  patient_id: string
  clinic_id: string
  professional_id: string | null
  tipo: AssessmentType
  dados: FormValues
  tratamento_proposto: string | null
  num_sessoes: number | null
  frequencia: string | null
  valor_total: number | null
  data: string
  updated_at: string
}

/** Avaliação mais recente do paciente para um tipo (ou null). */
export async function getLatestAssessment(
  patientId: string,
  tipo: AssessmentType,
): Promise<AssessmentRecord | null> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('tipo', tipo)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

interface SaveArgs {
  id?: string
  patientId: string
  clinicId: string
  professionalId?: string | null
  tipo: AssessmentType
  values: FormValues
}

/** Cria/atualiza a avaliação. Campos de planejamento também vão para colunas. */
export async function saveAssessment(args: SaveArgs): Promise<AssessmentRecord> {
  const v = args.values
  const payload = {
    patient_id: args.patientId,
    clinic_id: args.clinicId,
    professional_id: args.professionalId ?? null,
    tipo: args.tipo,
    dados: v,
    tratamento_proposto: (v.tratamento_proposto as string) ?? null,
    num_sessoes: (v.num_sessoes as number) ?? null,
    frequencia: (v.frequencia as string) ?? null,
    valor_total: (v.valor_total as number) ?? null,
  }

  if (args.id) {
    const { data, error } = await supabase
      .from('assessments')
      .update(payload)
      .eq('id', args.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase.from('assessments').insert(payload).select().single()
  if (error) throw error
  return data
}
