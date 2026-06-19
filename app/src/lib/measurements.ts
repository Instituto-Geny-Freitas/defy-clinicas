import { supabase } from '@/lib/supabase'

export interface BodyMeasurement {
  id: string
  patient_id: string
  sessao: number | null
  data: string
  peso_kg: number | null
  imc: number | null
  gordura_corporal_pct: number | null
  musculo_pct: number | null
  rm: number | null
  kcal: number | null
  idade_corporal: number | null
  gordura_visceral: number | null
  created_at: string
}

export async function listMeasurements(patientId: string): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('patient_id', patientId)
    .order('data', { ascending: true })
  if (error) throw error
  return data ?? []
}

export interface MeasurementInput {
  sessao?: number | null
  data: string
  peso_kg?: number | null
  imc?: number | null
  gordura_corporal_pct?: number | null
  musculo_pct?: number | null
  rm?: number | null
  kcal?: number | null
  idade_corporal?: number | null
  gordura_visceral?: number | null
}

export async function createMeasurement(
  clinicId: string,
  patientId: string,
  professionalId: string | null | undefined,
  input: MeasurementInput,
): Promise<void> {
  const { error } = await supabase.from('body_measurements').insert({
    clinic_id: clinicId,
    patient_id: patientId,
    professional_id: professionalId ?? null,
    ...input,
  })
  if (error) throw error
}

export async function updateMeasurement(id: string, input: MeasurementInput): Promise<void> {
  const { error } = await supabase.from('body_measurements').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id)
  if (error) throw error
}
