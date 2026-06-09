import { supabase } from '@/lib/supabase'

const DEFAULT_TEXT =
  'Autorizo o tratamento dos meus dados pessoais e de saúde para fins do meu atendimento, nos termos da Lei 13.709/2018 (LGPD).'

export interface LgpdConfig {
  texto: string
  versao: string
}

export async function getLgpdConfig(): Promise<LgpdConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const l = (data?.dados_empresa as { lgpd?: { texto?: string; versao?: string } })?.lgpd
  return { texto: l?.texto || DEFAULT_TEXT, versao: l?.versao || '1' }
}

export interface ConsentLog {
  id: string
  versao: string | null
  origem: 'paciente' | 'profissional'
  created_at: string
}

export async function listConsentLogs(patientId: string): Promise<ConsentLog[]> {
  const { data, error } = await supabase
    .from('lgpd_consent_logs')
    .select('id, versao, origem, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Registra o consentimento: grava o log e atualiza o paciente (data/versão). */
export async function recordConsent(args: {
  patientId: string
  clinicId: string
  versao: string
  origem: 'paciente' | 'profissional'
}): Promise<void> {
  const { error: logErr } = await supabase.from('lgpd_consent_logs').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    versao: args.versao,
    origem: args.origem,
  })
  if (logErr) throw logErr
  const { error } = await supabase
    .from('patients')
    .update({ consentimento_lgpd_em: new Date().toISOString(), consentimento_lgpd_versao: args.versao })
    .eq('id', args.patientId)
  if (error) throw error
}
