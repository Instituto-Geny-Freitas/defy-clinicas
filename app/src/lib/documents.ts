import { supabase } from '@/lib/supabase'
import type { AutoFonte, FormField, FormSchema, FormValues } from '@/forms/types'

export type DocType = 'termo' | 'orientacao' | 'ficha'
export type DocStatus = 'rascunho' | 'pendente' | 'lido' | 'assinado' | 'cancelado'

/** Dados disponíveis ao sistema para auto-preencher campos. */
export interface DocContext {
  paciente?: { nome?: string | null; cpf?: string | null } | null
  profissional?: { nome?: string | null; conselho_tipo?: string | null; conselho_numero?: string | null; conselho_uf?: string | null } | null
}

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Resolve o valor de um campo automático (sistema). */
export function resolveAuto(auto: AutoFonte, ctx: DocContext): unknown {
  switch (auto) {
    case 'data_emissao':
    case 'data_ciencia': return hojeISO()
    case 'paciente_nome': return ctx.paciente?.nome ?? ''
    case 'paciente_cpf': return ctx.paciente?.cpf ?? ''
    case 'profissional_nome': return ctx.profissional?.nome ?? ''
    case 'profissional_conselho': return ctx.profissional?.conselho_tipo ?? ''
    case 'profissional_conselho_numero': return ctx.profissional?.conselho_numero ?? ''
    case 'profissional_conselho_uf': return ctx.profissional?.conselho_uf ?? ''
    default: return ''
  }
}

/** Preenche os campos automáticos resolvíveis num dado momento. */
function aplicarAutomaticos(fields: FormField[], ctx: DocContext, momento: 'emissao' | 'ciencia'): FormValues {
  const out: FormValues = {}
  for (const f of fields) {
    if (f.preenchidoPor !== 'sistema' || !f.auto) continue
    // data_ciencia só resolve no ato da ciência; o restante já na emissão.
    if (momento === 'emissao' && f.auto === 'data_ciencia') continue
    out[f.key] = resolveAuto(f.auto, ctx)
  }
  return out
}

/** Campos que cabem a um perfil preencher manualmente (exclui automáticos). */
export function camposDe(fields: FormField[] | null | undefined, quem: 'profissional' | 'paciente'): FormField[] {
  return (fields ?? []).filter((f) => (f.preenchidoPor ?? 'profissional') === quem && !f.auto)
}

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
  assinatura_hash: string | null
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
  dados: FormValues          // valores preenchidos pelo profissional
  contexto?: DocContext      // dados do paciente/profissional para auto-preencher
}

/** Emite um documento para o paciente (status 'pendente'), com corpo e hash.
 *  Os campos do profissional vêm de `dados`; os campos de sistema são resolvidos
 *  agora (exceto data_ciencia); os campos do paciente ficam vazios até a ciência. */
export async function issueDocument(args: IssueArgs): Promise<DocInstance> {
  const auto = aplicarAutomaticos(args.template.schema ?? [], args.contexto ?? {}, 'emissao')
  const dados = { ...args.dados, ...auto }
  const corpoFinal = renderCorpo(args.template.corpo, dados)
  const contentHash = await sha256Hex(corpoFinal + JSON.stringify(dados))
  const payload = {
    clinic_id: args.clinicId,
    template_id: args.template.id,
    template_versao: args.template.versao,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    dados,
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
 * Ciência do paciente: mescla os valores preenchidos por ele, resolve os campos
 * automáticos do ato (data da ciência), recalcula o corpo e gera um HASH DE
 * AUTENTICIDADE (conteúdo + dados do paciente + data/hora) guardado na instância
 * para auditoria.
 */
export async function confirmPatientDocument(args: {
  inst: DocInstance
  template: DocTemplate
  valoresPaciente: FormValues
  paciente: { nome?: string | null; cpf?: string | null; nascimento?: string | null }
  requerAssinatura: boolean
}): Promise<DocInstance> {
  const agora = new Date().toISOString()
  const auto = aplicarAutomaticos(args.template.schema ?? [], { paciente: args.paciente }, 'ciencia')
  const dados: FormValues = { ...(args.inst.dados ?? {}), ...args.valoresPaciente, ...auto }
  const corpoFinal = renderCorpo(args.template.corpo, dados)
  const contentHash = await sha256Hex(corpoFinal + JSON.stringify(dados))
  // Hash de autenticidade: amarra o conteúdo aos dados do paciente e ao instante do aceite.
  const assinaturaHash = await sha256Hex(
    [contentHash, args.paciente.nome ?? '', args.paciente.cpf ?? '', args.paciente.nascimento ?? '', agora, args.inst.id].join('|'),
  )
  dados.__ciencia = { em: agora, paciente_nome: args.paciente.nome ?? null, paciente_cpf: args.paciente.cpf ?? null, hash: assinaturaHash }

  // uso de imagem: se houver um campo dinâmico 'uso_imagem' (Sim/Não), reflete na coluna.
  const usoImg = typeof dados.uso_imagem === 'boolean' ? (dados.uso_imagem as boolean) : null

  const base = args.requerAssinatura
    ? { status: 'assinado' as DocStatus, assinado_em: agora, consentido_em: agora, lido_em: agora, uso_imagem_autorizado: usoImg }
    : { status: 'lido' as DocStatus, lido_em: agora, consentido_em: agora, uso_imagem_autorizado: usoImg }

  const { data, error } = await supabase
    .from('document_instances')
    .update({ ...base, dados, corpo_final: corpoFinal, content_hash: contentHash, assinatura_hash: assinaturaHash })
    .eq('id', args.inst.id)
    .select('*, document_templates(nome, tipo, requer_assinatura)')
    .single()
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
