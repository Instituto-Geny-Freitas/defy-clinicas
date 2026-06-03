import { supabase } from '@/lib/supabase'
import type { FieldType } from '@/forms/types'

export interface TemplateField {
  key: string
  label: string
  type: FieldType
  required?: boolean
}

export interface ReminderItem {
  mensagem: string
  offset_horas?: number
  repetir?: string
  por_dias?: number
  canal?: string
}

export interface DocumentTemplate {
  id: string
  clinic_id: string
  tipo: 'termo' | 'orientacao' | 'ficha'
  nome: string
  descricao: string | null
  procedimento_rel: string | null
  schema: TemplateField[]
  corpo: string
  versao: number
  reminder_schedule: ReminderItem[]
  requer_assinatura: boolean
  ativo: boolean
}

export async function listTemplates(): Promise<DocumentTemplate[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .order('tipo')
    .order('nome')
  if (error) throw error
  return data ?? []
}

export interface TemplateInput {
  tipo: 'termo' | 'orientacao' | 'ficha'
  nome: string
  descricao?: string | null
  procedimento_rel?: string | null
  schema: TemplateField[]
  corpo: string
  reminder_schedule: ReminderItem[]
  requer_assinatura: boolean
}

export async function createTemplate(
  clinicId: string,
  input: TemplateInput,
  createdBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from('document_templates').insert({
    clinic_id: clinicId,
    ...input,
    versao: 1,
    ativo: true,
    created_by: createdBy ?? null,
  })
  if (error) throw error
}

/** Atualiza em lugar e incrementa a versão. */
export async function updateTemplate(id: string, versaoAtual: number, input: TemplateInput): Promise<void> {
  const { error } = await supabase
    .from('document_templates')
    .update({ ...input, versao: versaoAtual + 1 })
    .eq('id', id)
  if (error) throw error
}

export async function setTemplateActive(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('document_templates').update({ ativo }).eq('id', id)
  if (error) throw error
}

/** Gera uma chave (slug) a partir de um rótulo. */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
