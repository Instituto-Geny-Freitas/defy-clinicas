import { supabase } from '@/lib/supabase'

/** Comportamento-base de uma natureza:
 *  - 'termo'      → pede assinatura/leitura do paciente (grava enum tipo='termo')
 *  - 'orientacao' → permite lembretes automáticos (grava enum tipo='orientacao') */
export type DocTypeNatureza = 'termo' | 'orientacao'

export interface DocumentType {
  id: string
  clinic_id: string
  rotulo: string
  natureza: DocTypeNatureza      // comportamento-base (define assinatura/lembretes)
  natureza_key?: string | null   // qual natureza foi escolhida (built-in ou personalizada)
  ordem: number
  ativo: boolean
}

// -- Naturezas ----------------------------------------------------------------
/** Uma natureza escolhível no dropdown de Tipos de Documento. */
export interface DocNature { key: string; rotulo: string; base: DocTypeNatureza; builtin?: boolean }

/** Naturezas de fábrica (sempre presentes; não podem ser excluídas). */
export const BUILTIN_NATURES: DocNature[] = [
  { key: 'termo', rotulo: 'Termo (consentimento)', base: 'termo', builtin: true },
  { key: 'orientacao', rotulo: 'Orientação (cuidados)', base: 'orientacao', builtin: true },
]

async function readClinicNatures(): Promise<{ id: string | null; dados: Record<string, unknown>; custom: DocNature[] }> {
  const { data } = await supabase.from('clinics').select('id, dados_empresa').limit(1).maybeSingle()
  const dados = (data?.dados_empresa as Record<string, unknown>) ?? {}
  const raw = Array.isArray(dados.doc_naturezas) ? (dados.doc_naturezas as DocNature[]) : []
  const custom = raw.filter((n) => n && n.key && n.rotulo && (n.base === 'termo' || n.base === 'orientacao'))
    .map((n) => ({ key: n.key, rotulo: n.rotulo, base: n.base, builtin: false }))
  return { id: data?.id ?? null, dados, custom }
}

/** Lista todas as naturezas: as de fábrica + as personalizadas da clínica. */
export async function listDocNatures(): Promise<DocNature[]> {
  const { custom } = await readClinicNatures()
  return [...BUILTIN_NATURES, ...custom]
}

/** Salva a lista de naturezas PERSONALIZADAS (as de fábrica não entram aqui). */
export async function saveDocNatures(clinicId: string, custom: DocNature[]): Promise<void> {
  const { dados } = await readClinicNatures()
  const limpo = custom
    .filter((n) => !n.builtin)
    .map((n) => ({ key: n.key, rotulo: n.rotulo.trim(), base: n.base }))
  const { error } = await supabase.from('clinics').update({ dados_empresa: { ...dados, doc_naturezas: limpo } }).eq('id', clinicId)
  if (error) throw error
}

/** Rótulo da natureza de um tipo (resolve pela chave; cai no comportamento-base). */
export function natureLabel(natures: DocNature[], t: Pick<DocumentType, 'natureza' | 'natureza_key'>): string {
  const k = t.natureza_key ?? t.natureza
  return natures.find((n) => n.key === k)?.rotulo ?? (t.natureza === 'orientacao' ? 'Orientação' : 'Termo')
}

// -- Tipos de documento -------------------------------------------------------
/** Lista os tipos de documento da clínica. Por padrão só os ativos (para o dropdown). */
export async function listDocumentTypes(incluirInativos = false): Promise<DocumentType[]> {
  let q = supabase.from('document_types').select('*').order('ordem').order('rotulo')
  if (!incluirInativos) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as DocumentType[]
}

/** Resolve uma chave de natureza (built-in ou personalizada) para {base, key}. */
async function resolveNature(natureKey: string): Promise<{ base: DocTypeNatureza; key: string }> {
  const natures = await listDocNatures()
  const nat = natures.find((n) => n.key === natureKey) ?? BUILTIN_NATURES[0]
  return { base: nat.base, key: nat.key }
}

export async function createDocumentType(clinicId: string, rotulo: string, natureKey: string): Promise<void> {
  const nat = await resolveNature(natureKey)
  const { error } = await supabase.from('document_types').insert({ clinic_id: clinicId, rotulo, natureza: nat.base, natureza_key: nat.key })
  if (error) throw error
}

export async function updateDocumentType(
  id: string,
  patch: { rotulo?: string; natureKey?: string; ordem?: number; ativo?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.rotulo !== undefined) row.rotulo = patch.rotulo
  if (patch.ordem !== undefined) row.ordem = patch.ordem
  if (patch.ativo !== undefined) row.ativo = patch.ativo
  if (patch.natureKey !== undefined) {
    const nat = await resolveNature(patch.natureKey)
    row.natureza = nat.base
    row.natureza_key = nat.key
  }
  const { error } = await supabase.from('document_types').update(row).eq('id', id)
  if (error) throw error
}

/** Remove o tipo. Os modelos que o usavam voltam a exibir o rótulo padrão da
 *  natureza (FK on delete set null — o enum tipo do modelo é preservado). */
export async function deleteDocumentType(id: string): Promise<void> {
  const { error } = await supabase.from('document_types').delete().eq('id', id)
  if (error) throw error
}
