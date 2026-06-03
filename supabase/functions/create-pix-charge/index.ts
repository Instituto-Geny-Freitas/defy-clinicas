// =============================================================================
// Edge Function: create-pix-charge
// Cria uma cobrança PIX no gateway configurado (integration_settings) e grava
// pix_qrcode / pix_copia_cola no pagamento. Chamada pelo app ao registrar um
// pagamento PIX. Mantém a arquitetura "plugável": o provider vem da config.
//
// Segredos (por provider; configure só o que usar):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ASAAS_API_KEY | MERCADOPAGO_TOKEN | PAGARME_API_KEY
//
// Corpo esperado: { payment_id: string }
// NÃO está em produção até ser deployada. Veja functions/README.md.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Adapte por provider. Retorna { gateway_ref, qrcode, copia_cola }.
async function criarCobranca(provider: string, valor: number) {
  switch (provider) {
    case 'asaas': {
      // TODO: implementar chamada real à API do Asaas usando ASAAS_API_KEY.
      throw new Error('Provider asaas ainda não implementado')
    }
    case 'mercadopago':
      throw new Error('Provider mercadopago ainda não implementado')
    case 'pagarme':
      throw new Error('Provider pagarme ainda não implementado')
    default:
      throw new Error(`Provider desconhecido: ${provider} (valor ${valor})`)
  }
}

Deno.serve(async (req) => {
  try {
    const { payment_id } = await req.json()
    const { data: pay } = await supabase
      .from('payments')
      .select('id, valor, clinic_id')
      .eq('id', payment_id)
      .single()
    if (!pay) return new Response('pagamento não encontrado', { status: 404 })

    const { data: integ } = await supabase
      .from('integration_settings')
      .select('provider, ativo')
      .eq('categoria', 'pagamento')
      .maybeSingle()
    if (!integ?.ativo || !integ.provider) {
      return new Response('gateway de pagamento não configurado', { status: 400 })
    }

    const cob = await criarCobranca(integ.provider, pay.valor)

    await supabase
      .from('payments')
      .update({ gateway: integ.provider, gateway_ref: cob.gateway_ref, pix_qrcode: cob.qrcode, pix_copia_cola: cob.copia_cola })
      .eq('id', payment_id)

    return new Response(JSON.stringify(cob), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})
