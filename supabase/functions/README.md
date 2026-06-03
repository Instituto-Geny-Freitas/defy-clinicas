# Edge Functions — automações externas

Funções para a **entrega externa** das automações. O enfileiramento e os
lembretes já acontecem no banco (migrations `0015`/`0016`); estas funções fazem
o envio real (WhatsApp/push) e a cobrança PIX no gateway.

> **Status:** scaffolding pronto para deploy. **Não estão ativas** até serem
> deployadas e terem os segredos configurados. Algumas chamadas a providers
> estão marcadas com `TODO` (dependem da conta/credenciais do provedor).

## Funções

| Função | Papel | Gatilho |
|--------|-------|---------|
| `send-notifications` | Lê a fila `notifications` (canais externos, vencidas) e envia | Periódico (cron/scheduled) |
| `create-pix-charge` | Cria cobrança PIX no gateway e grava QR/copia-e-cola no pagamento | Chamada pelo app |
| `pix-webhook` | Recebe confirmação do gateway e marca o pagamento como pago | Webhook do gateway |

## Deploy

```bash
# requer: supabase login  (token de acesso)
supabase link --project-ref atffelyvxxlaevuivqxs
supabase functions deploy send-notifications
supabase functions deploy create-pix-charge
supabase functions deploy pix-webhook
```

## Segredos (nunca no frontend)

```bash
supabase secrets set \
  WHATSAPP_TOKEN=...        \
  WHATSAPP_PHONE_ID=...     \
  ASAAS_API_KEY=...         \
  GATEWAY_WEBHOOK_SECRET=...
# SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente nas functions.
```

## Agendar o envio (send-notifications)

Opção A — **Scheduled Functions** do Supabase (cron no dashboard), a cada 5 min.

Opção B — **pg_cron + pg_net** chamando a function por HTTP:
```sql
create extension if not exists pg_net;
select cron.schedule(
  'enviar-notificacoes', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://atffelyvxxlaevuivqxs.functions.supabase.co/send-notifications',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_key', true))
     ); $$
);
```

## Fluxo PIX (quando o gateway estiver configurado)

1. App registra pagamento PIX → chama `create-pix-charge` → gateway devolve QR/copia-e-cola → app exibe ao paciente.
2. Paciente paga → gateway chama `pix-webhook` → pagamento vira `pago` → saldo do orçamento baixa automaticamente.

## Observação sobre os canais

Hoje os triggers enfileiram com canal `in_app` (exibido no portal). Para enviar
por WhatsApp, defina o canal `whatsapp` na `reminder_schedule` dos modelos — a
`send-notifications` então fará o envio para os itens com canal externo.
