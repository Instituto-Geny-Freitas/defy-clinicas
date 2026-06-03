// =============================================================================
// Edge Function: pix-webhook
// Recebe o webhook do gateway quando uma cobrança PIX é paga e atualiza o
// pagamento (status 'pago', pago_em). Configure esta URL no painel do gateway.
//
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GATEWAY_WEBHOOK_SECRET
//
// IMPORTANTE: valide a assinatura/segredo do webhook antes de confiar no corpo.
// NÃO está em produção até ser deployada. Veja functions/README.md.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  // 1) Validar autenticidade (exemplo simples por header secreto).
  const secret = Deno.env.get('GATEWAY_WEBHOOK_SECRET')
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('não autorizado', { status: 401 })
  }

  // 2) Extrair a referência da cobrança paga (adapte ao formato do provider).
  const body = await req.json().catch(() => ({}))
  const gatewayRef: string | undefined =
    body?.payment?.id ?? body?.data?.id ?? body?.id

  if (!gatewayRef) return new Response('payload sem referência', { status: 400 })

  // 3) Marcar o pagamento como pago.
  const { error } = await supabase
    .from('payments')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('gateway_ref', gatewayRef)

  if (error) return new Response(String(error), { status: 500 })
  return new Response('ok')
})
