// =============================================================================
// Edge Function: send-notifications
// Lê a fila `notifications` (vencidas, status 'pendente', canais externos) e
// envia por WhatsApp/push/e-mail. Atualiza o status para 'enviado' ou 'falhou'.
//
// Agendamento: invoque periodicamente via pg_cron + pg_net, ou pelo
// Scheduled Functions do Supabase (ex.: a cada 5 min).
//
// Segredos necessários (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID        (WhatsApp Cloud API — opcional)
//
// NÃO está em produção até ser deployada. Veja functions/README.md.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function sendWhatsApp(to: string, message: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) throw new Error('WhatsApp não configurado')
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  })
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`)
}

Deno.serve(async () => {
  const agora = new Date().toISOString()
  const { data: pend } = await supabase
    .from('notifications')
    .select('id, patient_id, canal, titulo, payload')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .in('canal', ['whatsapp', 'push', 'email'])
    .limit(50)

  let enviadas = 0
  for (const n of pend ?? []) {
    try {
      const msg = `${n.titulo ?? ''}\n${(n.payload as { mensagem?: string })?.mensagem ?? ''}`.trim()

      if (n.canal === 'whatsapp') {
        const { data: pac } = await supabase
          .from('patients')
          .select('whatsapp')
          .eq('id', n.patient_id)
          .single()
        await sendWhatsApp((pac?.whatsapp ?? '').replace(/\D/g, ''), msg)
      }
      // TODO: push (Web Push via push_subscriptions) e e-mail conforme necessário.

      await supabase
        .from('notifications')
        .update({ status: 'enviado', enviado_em: agora })
        .eq('id', n.id)
      enviadas++
    } catch (e) {
      await supabase
        .from('notifications')
        .update({ status: 'falhou', erro: String(e) })
        .eq('id', n.id)
    }
  }

  return new Response(JSON.stringify({ processadas: pend?.length ?? 0, enviadas }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
