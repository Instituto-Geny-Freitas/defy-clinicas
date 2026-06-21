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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Altura digitada em cm (ex.: 170) é convertida para metros (1,70). */
function alturaEmMetros(v: unknown): number | null {
  let a = toNum(v)
  if (a == null) return null
  if (a > 3) a = a / 100 // veio em centímetros
  return Math.round(a * 100) / 100
}

/** Garante que o número cabe na coluna (numeric(p,2)); senão devolve null. */
function fit(n: number | null, max: number): number | null {
  if (n == null) return null
  if (Math.abs(n) > max) return null
  return Math.round(n * 100) / 100
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

/**
 * Sincroniza no cadastro do paciente os campos da anamnese que também vivem
 * em `patients` (ex.: estilo de trabalho, exibido no Resumo). Não-fatal.
 */
async function syncPatientFields(patientId: string, values: FormValues): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (values.estilo_trabalho === 'sentado' || values.estilo_trabalho === 'em_pe_ativo') {
    patch.estilo_trabalho = values.estilo_trabalho
  }
  if (Object.keys(patch).length === 0) return
  await supabase.from('patients').update(patch).eq('id', patientId)
}

/** Cria ou atualiza a anamnese (upsert manual: update se id, senão insert). */
export async function saveAnamnesis(args: SaveArgs): Promise<AnamnesisRecord> {
  // Normaliza/valida os numéricos para caber nas colunas (evita "numeric field overflow").
  const altura = alturaEmMetros(args.values.altura_m)            // numeric(4,2) → máx 99,99
  const peso = fit(toNum(args.values.peso_kg), 9999.99)          // numeric(6,2)
  const meta = fit(toNum(args.values.peso_meta_kg), 9999.99)
  const imc = peso != null && altura != null && altura > 0 ? fit(Math.round((peso / (altura * altura)) * 100) / 100, 9999.99) : null
  // Reflete a altura normalizada (em metros) no JSON exibido.
  const dados = { ...args.values, altura_m: altura ?? args.values.altura_m }

  const payload = {
    patient_id: args.patientId,
    clinic_id: args.clinicId,
    professional_id: args.professionalId ?? null,
    preenchido_por: args.preenchidoPor,
    dados,
    peso_kg: peso,
    altura_m: fit(altura, 99.99),
    imc,
    peso_meta_kg: meta,
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
    await syncPatientFields(args.patientId, args.values).catch(() => {})
    return data
  }

  const { data, error } = await supabase.from('anamnesis').insert(payload).select().single()
  if (error) throw error
  await syncPatientFields(args.patientId, args.values).catch(() => {})
  return data
}
