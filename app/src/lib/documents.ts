import { supabase } from '@/lib/supabase'
import type { FormField, FormSchema, FormValues } from '@/forms/types'

export type DocType = 'termo' | 'orientacao' | 'ficha'
export type DocStatus = 'rascunho' | 'pendente' | 'lido' | 'assinado' | 'cancelado'

export interface DocTemplate {
  id: string
  clinic_id: string
  tipo: DocType
  nome: string
  descricao: string | null
  procedimento_rel: string | null
  schema: FormField[]
  corpo: string
  versao: number
  requer_assinatura: boolean
}

export interface DocInstance {
  id: string
  template_id: string
  template_versao: number
  patient_id: string
  professional_id: string | null
  dados: FormValues
  corpo_final: string | null
  status: DocStatus
  enviado_em: string | null
  lido_em: string | null
  consentido_em: string | null
  assinado_em: string | null
  content_hash: string | null
  uso_imagem_autorizado: boolean | null
  created_at: string
  document_templates?: { nome: string; tipo: DocType; requer_assinatura: boolean }
}

/** Converte o schema (lista de campos) de um modelo num FormSchema do motor. */
export function templateToFormSchema(fields: FormField[] | null | undefined): FormSchema {
  return { sections: [{ title: 'Dados do documento', fields: fields ?? [] }] }
}

/** Substitui {{chave}} no corpo pelos valores informados. */
export function renderCorpo(corpo: string, dados: FormValues): string {
  return corpo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = dados[key]
    if (v === true) return 'Sim'
    if (v === false) return 'Não'
    if (v === undefined || v === null || v === '') return '__________'
    return String(v)
  })
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function listActiveTemplates(): Promise<DocTemplate[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('id, clinic_id, tipo, nome, descricao, procedimento_rel, schema, corpo, versao, requer_assinatura')
    .eq('ativo', true)
    .order('tipo')
  if (error) throw error
  return data ?? []
}

export async function getTemplate(id: string): Promise<DocTemplate | null> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('id, clinic_id, tipo, nome, descricao, procedimento_rel, schema, corpo, versao, requer_assinatura')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Atualiza os dados de um documento emitido, re-renderizando corpo e hash. */
export async function updateDocumentInstance(
  id: string,
  template: DocTemplate,
  dados: FormValues,
): Promise<void> {
  const corpoFinal = renderCorpo(template.corpo, dados)
  const contentHash = await sha256Hex(corpoFinal + JSON.stringify(dados))
  const { error } = await supabase
    .from('document_instances')
    .update({ dados, corpo_final: corpoFinal, content_hash: contentHash })
    .eq('id', id)
  if (error) throw error
}

export async function listPatientDocuments(patientId: string): Promise<DocInstance[]> {
  const { data, error } = await supabase
    .from('document_instances')
    .select('*, document_templates(nome, tipo, requer_assinatura)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

interface IssueArgs {
  template: DocTemplate
  clinicId: string
  patientId: string
  professionalId?: string | null
  dados: FormValues
}

/** Emite um documento para o paciente (status 'pendente'), com corpo e hash. */
export async function issueDocument(args: IssueArgs): Promise<DocInstance> {
  const corpoFinal = renderCorpo(args.template.corpo, args.dados)
  const contentHash = await sha256Hex(corpoFinal + JSON.stringify(args.dados))
  const payload = {
    clinic_id: args.clinicId,
    template_id: args.template.id,
    template_versao: args.template.versao,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    dados: args.dados,
    corpo_final: corpoFinal,
    status: 'pendente' as DocStatus,
    enviado_em: new Date().toISOString(),
    content_hash: contentHash,
  }
  const { data, error } = await supabase.from('document_instances').insert(payload).select().single()
  if (error) throw error
  return data
}

/**
 * Registra o aceite do paciente.
 * - termo (requer assinatura): status 'assinado' + assinado/consentido/lido.
 * - orientação: status 'lido' + lido/consentido.
 */
export async function acceptDocument(
  inst: DocInstance,
  requerAssinatura: boolean,
  opts?: { usoImagem?: boolean | null },
): Promise<DocInstance> {
  const agora = new Date().toISOString()
  const base = requerAssinatura
    ? {
        status: 'assinado' as DocStatus,
        assinado_em: agora,
        consentido_em: agora,
        lido_em: agora,
        uso_imagem_autorizado: opts?.usoImagem ?? null,
      }
    : { status: 'lido' as DocStatus, lido_em: agora, consentido_em: agora }

  const { data, error } = await supabase
    .from('document_instances')
    .update(base)
    .eq('id', inst.id)
    .select('*, document_templates(nome, tipo, requer_assinatura)')
    .single()
  if (error) throw error
  return data
}
