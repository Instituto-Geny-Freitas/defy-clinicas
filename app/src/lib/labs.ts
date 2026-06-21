import { supabase } from '@/lib/supabase'

const BUCKET = 'patient-files'

export interface LabOrder {
  id: string
  patient_id: string
  exames: string[]
  observacoes: string | null
  data: string
  created_at: string
}

export interface LabResult {
  id: string
  order_id: string | null
  patient_id: string
  arquivo_url: string
  data_coleta: string | null
  created_at: string
  signedUrl?: string
}

/** Painel laboratorial padrão (do documento da clínica). */
export const EXAMES_PADRAO = [
  'Vitamina D', 'Vit. B12', 'Testosterona', 'Testost. Livre', 'Hemoglobina Glicada', 'Glicemia',
  'Insulina', 'PCR', 'Vit. C', 'Ferro', 'Ferritina', 'Cortisol sérico', 'Ácido Fólico', 'TSH',
  'T4 Livre', 'T3', 'T4', 'Hemograma Completo', 'HB + HT', 'Plaquetas', 'Na+', 'K+', 'Ca+', 'Mg',
  'Cálcio Iônico', 'Colesterol total', 'HDL', 'LDL', 'VLDL', 'Triglicerídeos', 'Cobre', 'Zinco',
  'Amilase', 'Lipase', 'TGO', 'TGP', 'Ureia', 'Creatinina', 'Homocisteína', 'Eosinófilos',
]

export async function listLabOrders(patientId: string): Promise<LabOrder[]> {
  const { data, error } = await supabase
    .from('lab_orders')
    .select('*')
    .eq('patient_id', patientId)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createLabOrder(args: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  exames: string[]
  observacoes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('lab_orders').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    exames: args.exames,
    observacoes: args.observacoes ?? null,
  })
  if (error) throw error
}

export async function listLabResults(patientId: string): Promise<LabResult[]> {
  const { data, error } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const results = data ?? []
  const paths = results.map((r) => r.arquivo_url).filter(Boolean)
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const r of results) r.signedUrl = map.get(r.arquivo_url) ?? undefined
  }
  return results
}

/** Faz upload de um resultado de exame (PDF/imagem) para o bucket privado. */
export async function uploadLabResult(args: {
  patientId: string
  clinicId: string
  orderId?: string | null
  file: File
}): Promise<void> {
  const ext = args.file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${args.patientId}/exames/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, args.file, { contentType: args.file.type || 'application/octet-stream' })
  if (upErr) throw upErr
  // Obs.: lab_results não possui coluna clinic_id.
  const { error } = await supabase.from('lab_results').insert({
    patient_id: args.patientId,
    order_id: args.orderId ?? null,
    arquivo_url: path,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]) // evita arquivo órfão
    throw error
  }
}

/** Remove um resultado de exame (arquivo + registro). */
export async function deleteLabResult(r: LabResult): Promise<void> {
  if (r.arquivo_url) await supabase.storage.from(BUCKET).remove([r.arquivo_url])
  const { error } = await supabase.from('lab_results').delete().eq('id', r.id)
  if (error) throw error
}
