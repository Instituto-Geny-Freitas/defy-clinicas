import { supabase } from '@/lib/supabase'
import type { FormValues } from '@/forms/types'

export interface AnamnesisRecord {
  id: string
  patient_id: string
  clinic_id: string
  professional_id: string | null
  preenchido_por: 'paciente' | 'profissional'
  dados: FormValues
  peso_kg: number | null
  altura_m: number | null
  imc: number | null
  peso_meta_kg: number | null
  consentimento_em: string | null
  data: string
  updated_at: string
}

/** Carrega a anamnese mais recente do paciente (ou null). */
export async function getLatestAnamnesis(patientId: string): Promise<AnamnesisRecord | null> {
  const { data, error } = await supabase
    .from('anamnesis')
    .select('*')
    .eq('patient_id', patientId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

function calcImc(values: FormValues): number | null {
  const peso = Number(values.peso_kg)
  const altura = Number(values.altura_m)
  if (!peso || !altura) return null
  return Math.round((peso / (altura * altura)) * 100) / 100
}

interface SaveArgs {
  id?: string
  patientId: string
  clinicId: string
  professionalId?: string | null
  preenchidoPor: 'paciente' | 'profissional'
  values: FormValues
  consentir?: boolean
}

/** Cria ou atualiza a anamnese (upsert manual: update se id, senão insert). */
export async function saveAnamnesis(args: SaveArgs): Promise<AnamnesisRecord> {
  const payload = {
    patient_id: args.patientId,
    clinic_id: args.clinicId,
    professional_id: args.professionalId ?? null,
    preenchido_por: args.preenchidoPor,
    dados: args.values,
    peso_kg: (args.values.peso_kg as number) ?? null,
    altura_m: (args.values.altura_m as number) ?? null,
    imc: calcImc(args.values),
    peso_meta_kg: (args.values.peso_meta_kg as number) ?? null,
    ...(args.consentir ? { consentimento_em: new Date().toISOString() } : {}),
  }

  if (args.id) {
    const { data, error } = await supabase
      .from('anamnesis')
      .update(payload)
      .eq('id', args.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase.from('anamnesis').insert(payload).select().single()
  if (error) throw error
  return data
}
