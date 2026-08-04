import { supabase } from '@/lib/supabase'

// ---- Configuração (clinics.dados_empresa.nps) -------------------------------
export type NpsQuestionType = 'texto' | 'nota' | 'escolha'
export const NPS_TIPO_LABEL: Record<NpsQuestionType, string> = {
  texto: 'Texto livre', nota: 'Nota (0 a 10)', escolha: 'Escolha (opções)',
}

/** Pergunta adicional do NPS (definida pelo admin). */
export interface NpsQuestion {
  id: string
  label: string
  tipo: NpsQuestionType
  opcoes?: string[]        // para 'escolha'
  obrigatoria?: boolean
}

export interface NpsConfig {
  ativo: boolean
  /** Título do card no portal (ex.: "Como foi seu atendimento?"). */
  convite: string
  /** Pergunta da nota 0–10 (a que calcula o NPS). */
  pergunta: string
  /** Texto de apoio do campo de comentário. */
  comentarioLabel: string
  /** Só reapresenta a pesquisa após estes dias (padrão 90). */
  periodicidadeDias: number
  /** Nº mínimo de atendimentos realizados para convidar (padrão 1). */
  minAtendimentos: number
  perguntas: NpsQuestion[]
}

export const NPS_DEFAULT: NpsConfig = {
  ativo: true,
  convite: 'Como foi seu atendimento?',
  pergunta: 'De 0 a 10, o quanto você recomendaria a clínica a um amigo?',
  comentarioLabel: 'Quer deixar um comentário? (opcional)',
  periodicidadeDias: 90,
  minAtendimentos: 1,
  perguntas: [],
}

export async function getNpsConfig(): Promise<NpsConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const c = (data?.dados_empresa as { nps?: Partial<NpsConfig> } | null)?.nps
  if (!c) return { ...NPS_DEFAULT }
  return {
    ativo: c.ativo !== false,
    convite: c.convite || NPS_DEFAULT.convite,
    pergunta: c.pergunta || NPS_DEFAULT.pergunta,
    comentarioLabel: c.comentarioLabel || NPS_DEFAULT.comentarioLabel,
    periodicidadeDias: Number(c.periodicidadeDias) > 0 ? Number(c.periodicidadeDias) : NPS_DEFAULT.periodicidadeDias,
    minAtendimentos: Number(c.minAtendimentos) > 0 ? Number(c.minAtendimentos) : NPS_DEFAULT.minAtendimentos,
    perguntas: Array.isArray(c.perguntas) ? (c.perguntas as NpsQuestion[]) : [],
  }
}

export async function saveNpsConfig(clinicId: string, cfg: NpsConfig): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const dados = { ...((data?.dados_empresa as Record<string, unknown>) ?? {}), nps: cfg }
  const { error } = await supabase.from('clinics').update({ dados_empresa: dados }).eq('id', clinicId)
  if (error) throw error
}

export interface NpsResponse {
  id: string
  patient_id: string
  appointment_id: string | null
  score: number
  comentario: string | null
  respostas: Record<string, unknown>
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

/** Respostas num intervalo de datas (YYYY-MM-DD), para o painel consolidado. */
export async function listNpsPeriodo(de?: string | null, ate?: string | null): Promise<NpsResponse[]> {
  let q = supabase.from('nps_responses').select('*, patients(nome)').order('created_at', { ascending: false })
  if (de) q = q.gte('created_at', `${de}T00:00:00`)
  if (ate) q = q.lte('created_at', `${ate}T23:59:59`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as NpsResponse[]
}

/** NPS mês a mês (mais antigo → mais recente), para a evolução. */
export function npsPorMes(respostas: NpsResponse[]): { mes: string; nps: number; total: number }[] {
  const grupos = new Map<string, NpsResponse[]>()
  for (const r of respostas) {
    const mes = r.created_at.slice(0, 7)   // YYYY-MM
    const arr = grupos.get(mes) ?? []
    arr.push(r); grupos.set(mes, arr)
  }
  return [...grupos.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, rs]) => ({ mes, ...calcNps(rs) }))
    .map(({ mes, nps, total }) => ({ mes, nps, total }))
}

/** CSV das respostas (inclui as perguntas adicionais configuradas). */
export function npsCsv(respostas: NpsResponse[], perguntas: NpsQuestion[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Data', 'Paciente', 'Nota', 'Faixa', 'Comentário', ...perguntas.map((p) => p.label)]
  const faixa = (s: number) => (s >= 9 ? 'Promotor' : s >= 7 ? 'Passivo' : 'Detrator')
  const linhas = respostas.map((r) => [
    new Date(r.created_at).toLocaleString('pt-BR'),
    r.patients?.nome ?? '',
    r.score,
    faixa(r.score),
    r.comentario ?? '',
    ...perguntas.map((p) => r.respostas?.[p.id] ?? ''),
  ])
  return [head, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n')
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
  respostas?: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabase.from('nps_responses').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    appointment_id: args.appointmentId ?? null,
    score: args.score,
    comentario: args.comentario ?? null,
    respostas: args.respostas ?? {},
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
