// =============================================================================
// Edge Function: send-push
// Entrega notificações pendentes de canal 'push' via Web Push (VAPID).
// Lê a fila `notifications`, encontra as inscrições do paciente
// (push_subscriptions) e envia; marca 'enviado' ou 'falhou'.
//
// Agendar periodicamente (Scheduled Functions ou pg_cron + pg_net).
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetados)
// Deploy: supabase functions deploy send-push
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async () => {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) return new Response(JSON.stringify({ error: 'VAPID não configurado' }), { status: 400 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@example.com', pub, priv)

  const agora = new Date().toISOString()
  const { data: pend } = await admin
    .from('notifications')
    .select('id, patient_id, titulo, payload')
    .eq('status', 'pendente')
    .eq('canal', 'push')
    .lte('agendado_para', agora)
    .limit(100)

  let enviadas = 0
  for (const n of pend ?? []) {
    try {
      const { data: pat } = await admin.from('patients').select('auth_user_id').eq('id', n.patient_id).single()
      if (!pat?.auth_user_id) { await marcar(n.id, 'falhou', 'paciente sem login'); continue }
      const { data: subs } = await admin.from('push_subscriptions').select('endpoint, keys').eq('auth_user_id', pat.auth_user_id)
      if (!subs || subs.length === 0) { await marcar(n.id, 'falhou', 'sem inscrição push'); continue }

      const payload = JSON.stringify({ titulo: n.titulo, mensagem: (n.payload as { mensagem?: string })?.mensagem ?? '' })
      for (const s of subs) {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, payload)
      }
      await marcar(n.id, 'enviado')
      enviadas++
    } catch (e) {
      await marcar(n.id, 'falhou', String(e))
    }
  }
  return new Response(JSON.stringify({ processadas: pend?.length ?? 0, enviadas }), { headers: { 'Content-Type': 'application/json' } })
})

async function marcar(id: string, status: string, erro?: string) {
  await admin.from('notifications').update({ status, enviado_em: new Date().toISOString(), erro: erro ?? null }).eq('id', id)
}
