import { supabase } from '@/lib/supabase'
import { getIntegration } from '@/lib/settings'

const BUCKET = 'patient-files'

export interface SharedDocument {
  id: string
  patient_id: string
  categoria: string
  titulo: string
  arquivo_url: string
  quote_id: string | null
  enviado_paciente: boolean
  fornecedor_nome: string | null
  fornecedor_whatsapp: string | null
  enviado_fornecedor_em: string | null
  created_at: string
  signedUrl?: string
}

/** Faz upload do PDF e cria o registro do documento compartilhado. */
export async function createSharedDocument(args: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  titulo: string
  categoria?: string
  quoteId?: string | null
  blob: Blob
  enviarPaciente: boolean
}): Promise<SharedDocument> {
  const pasta = args.categoria === 'orcamento' ? 'orcamentos' : args.categoria === 'documento' ? 'documentos' : 'manipulacoes'
  const path = `${args.patientId}/${pasta}/${crypto.randomUUID()}.pdf`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, args.blob, { contentType: 'application/pdf' })
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('shared_documents')
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      professional_id: args.professionalId ?? null,
      categoria: args.categoria ?? 'manipulacao',
      titulo: args.titulo,
      arquivo_url: path,
      quote_id: args.quoteId ?? null,
      enviado_paciente: args.enviarPaciente,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}

async function withSignedUrls(rows: SharedDocument[]): Promise<SharedDocument[]> {
  const paths = rows.map((r) => r.arquivo_url).filter(Boolean)
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const r of rows) r.signedUrl = map.get(r.arquivo_url) ?? undefined
  }
  return rows
}

/** Documentos compartilhados do paciente (uso na ficha clínica). */
export async function listSharedDocuments(patientId: string): Promise<SharedDocument[]> {
  const { data, error } = await supabase
    .from('shared_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return withSignedUrls(data ?? [])
}

/** Documentos liberados ao paciente (portal). */
export async function listSharedForPatient(patientId: string): Promise<SharedDocument[]> {
  const { data, error } = await supabase
    .from('shared_documents')
    .select('*')
    .eq('patient_id', patientId)
    .eq('enviado_paciente', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return withSignedUrls(data ?? [])
}

export async function marcarEnviadoPaciente(id: string): Promise<void> {
  const { error } = await supabase.from('shared_documents').update({ enviado_paciente: true }).eq('id', id)
  if (error) throw error
}

export type CanalEnvio = 'email' | 'whatsapp'

/**
 * Notifica o paciente de um documento compartilhado por e-mail ou WhatsApp.
 * O PDF já fica disponível no portal; este passo é a notificação no canal escolhido.
 * O envio real depende de uma integração ATIVA (Configurações → Integrações) e da
 * respectiva Edge Function. Sem isso, devolve uma mensagem explicativa (preparado).
 */
export async function enviarDocumentoPaciente(args: {
  canal: CanalEnvio
  destino: string | null | undefined   // e-mail ou telefone do paciente
  sharedDocId: string
}): Promise<{ enviado: boolean; mensagem: string }> {
  const canalNome = args.canal === 'email' ? 'e-mail' : 'WhatsApp'
  if (!args.destino) {
    return { enviado: false, mensagem: `Paciente sem ${canalNome} cadastrado. O PDF já está disponível no portal do paciente.` }
  }
  const cfg = await getIntegration(args.canal).catch(() => null)
  if (cfg?.ativo) {
    const fn = args.canal === 'email' ? 'send-document-email' : 'send-whatsapp'
    const { error } = await supabase.functions.invoke(fn, { body: { doc_id: args.sharedDocId, to: args.destino } })
    if (error) throw error
    return { enviado: true, mensagem: `Documento enviado por ${canalNome}.` }
  }
  return {
    enviado: false,
    mensagem: `Integração de ${canalNome} ainda não configurada (Configurações → Integrações). O PDF já está disponível no portal do paciente.`,
  }
}

export interface WhatsappResult { enviado: boolean; mensagem: string }

/**
 * Envia o documento a um fornecedor por WhatsApp.
 * O envio real depende de uma integração ativa (Configurações → Integrações →
 * WhatsApp) + Edge Function 'send-whatsapp' com as credenciais do provedor.
 * Enquanto não houver integração ativa, apenas registra a intenção e devolve
 * uma mensagem explicativa (preparado para ativação futura).
 */
export async function enviarDocumentoFornecedor(args: {
  docId: string
  fornecedorNome: string
  fornecedorWhatsapp: string
}): Promise<WhatsappResult> {
  const cfg = await getIntegration('whatsapp').catch(() => null)

  const patch: Record<string, unknown> = {
    fornecedor_nome: args.fornecedorNome,
    fornecedor_whatsapp: args.fornecedorWhatsapp,
  }

  if (cfg?.ativo) {
    // Integração ativa: dispara a Edge Function (a ser provisionada com as chaves).
    const { error } = await supabase.functions.invoke('send-whatsapp', {
      body: { doc_id: args.docId, to: args.fornecedorWhatsapp },
    })
    if (error) throw error
    patch.enviado_fornecedor_em = new Date().toISOString()
    await supabase.from('shared_documents').update(patch).eq('id', args.docId)
    return { enviado: true, mensagem: 'Documento enviado ao fornecedor pelo WhatsApp.' }
  }

  // Sem integração: registra o destinatário pretendido para histórico.
  await supabase.from('shared_documents').update(patch).eq('id', args.docId)
  return {
    enviado: false,
    mensagem:
      'Integração de WhatsApp ainda não configurada. O destinatário foi registrado; ' +
      'o administrador pode ativar o provedor em Configurações → Integrações.',
  }
}
