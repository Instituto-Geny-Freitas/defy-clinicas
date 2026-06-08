import { supabase } from '@/lib/supabase'

const BUCKET = 'patient-files'

export interface PatientReport {
  id: string
  patient_id: string
  titulo: string | null
  secoes: string[]
  periodo_inicio: string | null
  periodo_fim: string | null
  arquivo_url: string | null
  gerado_por: 'paciente' | 'profissional'
  created_at: string
  signedUrl?: string
}

export async function listPatientReports(patientId: string): Promise<PatientReport[]> {
  const { data, error } = await supabase
    .from('patient_reports')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const reports = data ?? []
  const paths = reports.map((r) => r.arquivo_url).filter(Boolean) as string[]
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const r of reports) if (r.arquivo_url) r.signedUrl = map.get(r.arquivo_url) ?? undefined
  }
  return reports
}

/** Uso atual e limite de relatórios do paciente. */
export async function getReportUsage(patientId: string): Promise<{ count: number; limite: number }> {
  const [{ count }, { data: pat }] = await Promise.all([
    supabase.from('patient_reports').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
    supabase.from('patients').select('limite_relatorios').eq('id', patientId).maybeSingle(),
  ])
  return { count: count ?? 0, limite: pat?.limite_relatorios ?? 10 }
}

interface SaveArgs {
  clinicId: string
  patientId: string
  titulo: string
  secoes: string[]
  periodoInicio?: string | null
  periodoFim?: string | null
  blob: Blob
  geradoPor?: 'paciente' | 'profissional'
}

/**
 * Salva o relatório: faz upload do PDF e registra a linha. O limite é imposto
 * por trigger no banco — se exceder, lança erro.
 */
export async function savePatientReport(args: SaveArgs): Promise<void> {
  const path = `${args.patientId}/relatorios/${crypto.randomUUID()}.pdf`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, args.blob, { contentType: 'application/pdf' })
  if (upErr) throw upErr
  const { error } = await supabase.from('patient_reports').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    titulo: args.titulo,
    secoes: args.secoes,
    periodo_inicio: args.periodoInicio ?? null,
    periodo_fim: args.periodoFim ?? null,
    arquivo_url: path,
    gerado_por: args.geradoPor ?? 'paciente',
  })
  if (error) {
    // limite atingido (trigger) — remove o arquivo recém-enviado
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
}

export async function deletePatientReport(r: PatientReport): Promise<void> {
  if (r.arquivo_url) await supabase.storage.from(BUCKET).remove([r.arquivo_url])
  const { error } = await supabase.from('patient_reports').delete().eq('id', r.id)
  if (error) throw error
}
