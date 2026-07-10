import { supabase } from '@/lib/supabase'

export interface NpsResponse {
  id: string
  patient_id: string
  appointment_id: string | null
  score: number
  comentario: string | null
  created_at: string
  patients?: { nome: string } | null
}

/** Respostas de NPS da clínica (equipe) — para o indicador e comentários. */
export async function listNpsResponses(limite = 200): Promise<NpsResponse[]> {
  const { data, error } = await supabase
    .from('nps_responses')
    .select('*, patients(nome)')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as NpsResponse[]
}

/** Quantas respostas de NPS o paciente já enviou (para não repetir a pesquisa). */
export async function countNpsByPatient(patientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('nps_responses')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
  if (error) return 0
  return count ?? 0
}

/** Data da última resposta do paciente (para reapresentar a pesquisa após um intervalo). */
export async function lastNpsAt(patientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('nps_responses')
    .select('created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.created_at ?? null
}

export async function submitNps(args: {
  clinicId: string
  patientId: string
  appointmentId?: string | null
  score: number
  comentario?: string | null
}): Promise<void> {
  const { error } = await supabase.from('nps_responses').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    appointment_id: args.appointmentId ?? null,
    score: args.score,
    comentario: args.comentario ?? null,
  })
  if (error) throw error
}

/** Calcula o NPS (%promotores − %detratores) e a distribuição a partir das respostas. */
export function calcNps(respostas: { score: number }[]): { nps: number; total: number; promotores: number; passivos: number; detratores: number } {
  const total = respostas.length
  const promotores = respostas.filter((r) => r.score >= 9).length
  const passivos = respostas.filter((r) => r.score >= 7 && r.score <= 8).length
  const detratores = respostas.filter((r) => r.score <= 6).length
  const nps = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0
  return { nps, total, promotores, passivos, detratores }
}
