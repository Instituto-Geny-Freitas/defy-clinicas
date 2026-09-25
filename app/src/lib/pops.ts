import { supabase } from '@/lib/supabase'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

/** Uma linha de um bloco: duas colunas de texto rico (HTML sanitizado). */
export interface PopLinha { col1: string; col2: string }
/** Bloco = subtítulo (texto simples) + uma ou mais linhas de 2 colunas. */
export interface PopBloco { id: string; subtitulo: string; linhas: PopLinha[] }

export interface Pop {
  id: string
  clinic_id: string
  titulo: string
  estrutura: PopBloco[]
  elaborado_por: string | null
  revisado_por: string | null
  data_aprovacao: string | null
  gestor_professional_id: string | null
  gestor_nome: string | null
  gestor_conselho: string | null
  ativo: boolean
  created_by: string | null
  created_by_nome: string | null
  created_at: string
  updated_at: string
}

export interface PopInput {
  titulo: string
  estrutura: PopBloco[]
  elaborado_por: string | null
  revisado_por: string | null
  data_aprovacao: string | null
}

/** Snapshot do gestor (admin) que criou/editou o POP — usado no rodapé do documento. */
export interface GestorSnapshot {
  professionalId: string | null
  nome: string | null
  conselho: string | null
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export function novoBloco(): PopBloco {
  return { id: uuid(), subtitulo: '', linhas: [{ col1: '', col2: '' }] }
}

/** Sanitiza toda a estrutura (subtítulo em texto puro; colunas em HTML seguro). */
function sanitizarEstrutura(estrutura: PopBloco[]): PopBloco[] {
  return (estrutura ?? []).map((b) => ({
    id: b.id || uuid(),
    subtitulo: (b.subtitulo ?? '').toString(),
    linhas: (b.linhas ?? []).map((l) => ({ col1: sanitizeHtml(l.col1), col2: sanitizeHtml(l.col2) })),
  }))
}

export async function listPops(): Promise<Pop[]> {
  const { data, error } = await supabase
    .from('pops')
    .select('*')
    .eq('ativo', true)
    .order('titulo', { ascending: true })
  if (error) throw error
  return (data ?? []) as Pop[]
}

export async function getPop(id: string): Promise<Pop | null> {
  const { data, error } = await supabase.from('pops').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Pop) ?? null
}

export async function createPop(clinicId: string, input: PopInput, gestor: GestorSnapshot): Promise<Pop> {
  const { data, error } = await supabase
    .from('pops')
    .insert({
      clinic_id: clinicId,
      titulo: input.titulo.trim(),
      estrutura: sanitizarEstrutura(input.estrutura),
      elaborado_por: input.elaborado_por,
      revisado_por: input.revisado_por,
      data_aprovacao: input.data_aprovacao || null,
      gestor_professional_id: gestor.professionalId,
      gestor_nome: gestor.nome,
      gestor_conselho: gestor.conselho,
      created_by: gestor.professionalId,
      created_by_nome: gestor.nome,
    })
    .select()
    .single()
  if (error) throw error
  return data as Pop
}

export async function updatePop(id: string, input: PopInput, gestor: GestorSnapshot): Promise<void> {
  const { error } = await supabase
    .from('pops')
    .update({
      titulo: input.titulo.trim(),
      estrutura: sanitizarEstrutura(input.estrutura),
      elaborado_por: input.elaborado_por,
      revisado_por: input.revisado_por,
      data_aprovacao: input.data_aprovacao || null,
      gestor_professional_id: gestor.professionalId,
      gestor_nome: gestor.nome,
      gestor_conselho: gestor.conselho,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

/** Exclusão lógica (preserva o conteúdo). */
export async function deletePop(id: string): Promise<void> {
  const { error } = await supabase.from('pops').update({ ativo: false }).eq('id', id)
  if (error) throw error
}
