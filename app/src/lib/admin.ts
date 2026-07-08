import { supabase } from '@/lib/supabase'

// =============================================================================
// Camada de dados da Área Administrativa: registros genéricos, numerador,
// anexos e domínios (Serviços Prestados, Vacinas).
// =============================================================================

export interface AdminRecord {
  id: string
  clinic_id: string
  form_chave: string
  patient_id: string | null
  ref_data: string | null
  seq: string | null
  dados: Record<string, unknown>
  created_by: string | null
  created_by_nome: string | null
  created_at: string
  updated_at: string
  patients?: { nome: string } | null
}

export interface RecordsFilter {
  modo: 'tudo' | 'mes' | 'faixa'
  mes?: number        // 0-11
  ano?: number
  de?: string         // YYYY-MM-DD
  ate?: string        // YYYY-MM-DD
}

function ultimoDiaMes(ano: number, mes: number): string {
  const d = new Date(ano, mes + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Converte o filtro em um intervalo [de, ate] (ou null para "tudo"). */
export function filtroIntervalo(f: RecordsFilter): { de: string; ate: string } | null {
  if (f.modo === 'mes' && f.ano != null && f.mes != null) {
    const de = `${f.ano}-${String(f.mes + 1).padStart(2, '0')}-01`
    return { de, ate: ultimoDiaMes(f.ano, f.mes) }
  }
  if (f.modo === 'faixa' && f.de && f.ate) return { de: f.de, ate: f.ate }
  return null
}

export async function listRecords(formChave: string, filtro?: RecordsFilter): Promise<AdminRecord[]> {
  let q = supabase
    .from('admin_records')
    .select('*, patients(nome)')
    .eq('form_chave', formChave)
    .order('ref_data', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (filtro) {
    const iv = filtroIntervalo(filtro)
    if (iv) q = q.gte('ref_data', iv.de).lte('ref_data', iv.ate)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    patients: Array.isArray(r.patients) ? (r.patients[0] ?? null) : r.patients,
  })) as AdminRecord[]
}

export interface SaveRecordInput {
  clinicId: string
  formChave: string
  patientId?: string | null
  refData?: string | null
  dados: Record<string, unknown>
  createdByNome?: string | null
  seq?: string | null
}

export async function createRecord(input: SaveRecordInput): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase.from('admin_records').insert({
    clinic_id: input.clinicId,
    form_chave: input.formChave,
    patient_id: input.patientId ?? null,
    ref_data: input.refData ?? null,
    seq: input.seq ?? null,
    dados: input.dados,
    created_by: uid,
    created_by_nome: input.createdByNome ?? null,
  })
  if (error) throw error
}

export async function updateRecord(id: string, patch: { patientId?: string | null; refData?: string | null; dados: Record<string, unknown> }): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .update({ patient_id: patch.patientId ?? null, ref_data: patch.refData ?? null, dados: patch.dados, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('admin_records').delete().eq('id', id)
  if (error) throw error
}

/** Próximo número formatado: nnnnn/AAAA/CODIGO. */
export async function nextSeq(clinicId: string, escopo: string, codigo: string, ano: number): Promise<string> {
  const { data, error } = await supabase.rpc('next_admin_seq', { p_clinic: clinicId, p_escopo: escopo, p_ano: ano })
  if (error) throw error
  const n = String(data ?? 1).padStart(5, '0')
  return `${n}/${ano}/${codigo}`
}

// ---- Anexos (bucket privado admin-files) -----------------------------------
export async function uploadAdminFile(formChave: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'dat'
  const path = `${formChave}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('admin-files').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function signedAdminUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('admin-files').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// ---- Domínios: Serviços Prestados ------------------------------------------
export interface DomItem { id: string; nome: string; ativo: boolean; ordem: number }

export async function listServicos(): Promise<DomItem[]> {
  const { data, error } = await supabase.from('servico_tipos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem').order('nome')
  if (error) throw error
  return data ?? []
}
export async function createServico(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('servico_tipos').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}
export async function updateServico(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('servico_tipos').update({ nome }).eq('id', id)
  if (error) throw error
}
export async function deleteServico(id: string): Promise<void> {
  const { error } = await supabase.from('servico_tipos').delete().eq('id', id)
  if (error) throw error
}

// ---- Domínios: Unidades de medida (ativos/estoque) -------------------------
export async function listUnidades(): Promise<DomItem[]> {
  const { data, error } = await supabase.from('unidades').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem').order('nome')
  if (error) throw error
  return data ?? []
}
export async function createUnidade(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('unidades').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}
export async function updateUnidade(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('unidades').update({ nome }).eq('id', id)
  if (error) throw error
}
export async function deleteUnidade(id: string): Promise<void> {
  const { error } = await supabase.from('unidades').delete().eq('id', id)
  if (error) throw error
}

// ---- Domínios: Vacinas ------------------------------------------------------
export async function listVacinas(): Promise<DomItem[]> {
  const { data, error } = await supabase.from('vacina_tipos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem').order('nome')
  if (error) throw error
  return data ?? []
}
export async function createVacina(clinicId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('vacina_tipos').insert({ clinic_id: clinicId, nome })
  if (error) throw error
}
export async function updateVacina(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('vacina_tipos').update({ nome }).eq('id', id)
  if (error) throw error
}
export async function deleteVacina(id: string): Promise<void> {
  const { error } = await supabase.from('vacina_tipos').delete().eq('id', id)
  if (error) throw error
}
