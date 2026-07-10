import { supabase } from '@/lib/supabase'

const DEFAULT_TEXT =
  'Autorizo o uso das minhas imagens (fotos de antes/depois e evolução) para fins de acompanhamento clínico e, quando eu marcar expressamente, para divulgação da clínica. Posso revogar esta autorização a qualquer momento.'

export interface ImageConsentConfig {
  texto: string
  versao: string
}

export async function getImageConsentConfig(): Promise<ImageConsentConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const c = (data?.dados_empresa as { imagem?: { texto?: string; versao?: string } })?.imagem
  return { texto: c?.texto || DEFAULT_TEXT, versao: c?.versao || '1' }
}

export async function saveImageConsentConfig(clinicId: string, cfg: ImageConsentConfig): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const dados = { ...(data?.dados_empresa ?? {}), imagem: { texto: cfg.texto, versao: cfg.versao, atualizado_em: new Date().toISOString() } }
  const { error } = await supabase.from('clinics').update({ dados_empresa: dados }).eq('id', clinicId)
  if (error) throw error
}

export interface ImageConsentLog {
  id: string
  versao: string | null
  origem: 'paciente' | 'profissional'
  created_at: string
}

export async function listImageConsentLogs(patientId: string): Promise<ImageConsentLog[]> {
  const { data, error } = await supabase
    .from('image_consent_logs')
    .select('id, versao, origem, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Registra o consentimento de imagem: grava o log e atualiza o paciente (data/versão). */
export async function recordImageConsent(args: {
  patientId: string
  clinicId: string
  versao: string
  origem: 'paciente' | 'profissional'
}): Promise<void> {
  const { error: logErr } = await supabase.from('image_consent_logs').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    versao: args.versao,
    origem: args.origem,
  })
  if (logErr) throw logErr
  const { error } = await supabase
    .from('patients')
    .update({ consentimento_imagem_em: new Date().toISOString(), consentimento_imagem_versao: args.versao })
    .eq('id', args.patientId)
  if (error) throw error
}
