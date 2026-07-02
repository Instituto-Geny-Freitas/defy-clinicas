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
  // Envia o JWT da sessão explicitamente: o functions.invoke nem sempre anexa
  // o token do usuário automaticamente, o que fazia a função responder 401.
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { messages, forms },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  })
  if (error) {
    // A mensagem útil da função (JSON { error }) vem no corpo da resposta HTTP,
    // não na mensagem genérica "non-2xx status code". Tenta extraí-la.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      try {
        const txt = await ctx.text()
        const parsed = JSON.parse(txt) as { error?: string }
        if (parsed?.error) throw new Error(parsed.error)
        if (txt) throw new Error(txt.slice(0, 300))
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw error
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return (data as { reply: string }).reply
}
