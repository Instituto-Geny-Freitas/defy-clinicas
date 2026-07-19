import { supabase } from '@/lib/supabase'

/** Natureza do tipo — define o comportamento no editor de modelos:
 *  - 'termo'      → pede assinatura/leitura do paciente (grava enum tipo='termo')
 *  - 'orientacao' → permite lembretes automáticos (grava enum tipo='orientacao') */
export type DocTypeNatureza = 'termo' | 'orientacao'

export interface DocumentType {
  id: string
  clinic_id: string
  rotulo: string
  natureza: DocTypeNatureza
  ordem: number
  ativo: boolean
}

/** Lista os tipos de documento da clínica. Por padrão só os ativos (para o dropdown). */
export async function listDocumentTypes(incluirInativos = false): Promise<DocumentType[]> {
  let q = supabase.from('document_types').select('*').order('ordem').order('rotulo')
  if (!incluirInativos) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as DocumentType[]
}

export async function createDocumentType(clinicId: string, rotulo: string, natureza: DocTypeNatureza): Promise<void> {
  const { error } = await supabase.from('document_types').insert({ clinic_id: clinicId, rotulo, natureza })
  if (error) throw error
}

export async function updateDocumentType(
  id: string,
  patch: Partial<Pick<DocumentType, 'rotulo' | 'natureza' | 'ordem' | 'ativo'>>,
): Promise<void> {
  const { error } = await supabase.from('document_types').update(patch).eq('id', id)
  if (error) throw error
}

/** Remove o tipo. Os modelos que o usavam voltam a exibir o rótulo padrão da
 *  natureza (FK on delete set null — o enum tipo do modelo é preservado). */
export async function deleteDocumentType(id: string): Promise<void> {
  const { error } = await supabase.from('document_types').delete().eq('id', id)
  if (error) throw error
}
