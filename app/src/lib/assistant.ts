import { supabase } from '@/lib/supabase'
import { getForms } from '@/lib/adminForms'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Envia o histórico da conversa ao assistente (Edge Function 'assistant') e
 * devolve a resposta em texto. As definições dos formulários administrativos
 * seguem junto para que o assistente saiba quais campos preencher.
 */
export async function askAssistant(messages: ChatMessage[]): Promise<string> {
  const forms = await getForms().catch(() => [])
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { messages, forms },
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return (data as { reply: string }).reply
}
