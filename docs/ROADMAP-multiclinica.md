# Roadmap — operar o sistema para mais de uma clínica

> Documento de decisão/execução. **Ainda não implementado** — planejamento para quando formos
> instalar o sistema para uma nova clínica.

## Contexto atual
O app é, na prática, **single-tenant**:
- `getClinic()` lê **uma** clínica (`.limit(1)`).
- O RLS usa `app.is_staff()` = "é da equipe" — **não** filtra por `clinic_id`. Logo, duas clínicas
  na **mesma** base se enxergariam. Multitenant exigiria reescrever o RLS de todas as ~61 migrations.
- Cada projeto já tem seus próprios serviços (Supabase, Vercel, OpenAI, VAPID, WhatsApp).

## Decisão recomendada: **single-tenant (uma instância por clínica), mesmo repositório GitHub**
Motivos (alinhados ao objetivo de segregar dados com segurança e mínimo impacto):

| Critério | Single-tenant (recomendado) | Multitenant |
|---|---|---|
| Segregação de dados | Física/absoluta (bases separadas) | Lógica (RLS por clinic_id) — 1 bug = vazamento |
| Impacto no código | **Zero** (já funciona assim) | Refatoração grande e arriscada |
| Updates de código | Automáticos (multi-projeto Vercel no mesmo repo) | Automáticos |
| Migrations | Aplicar por projeto | 1 vez |
| Superadmin no app | Não se aplica | Necessário |
| Custo | N projetos Supabase/Vercel | 1 de cada |

**Propagação de updates:** um mesmo repo GitHub alimenta **vários projetos Vercel** (1 por clínica),
cada um com suas variáveis de ambiente. `git push` na `main` → todas as clínicas fazem deploy
automático da mesma versão. A **única** etapa não-automática é aplicar as **migrations** em cada
projeto Supabase.

**Superadmin:** não existe superadmin dentro do app (cada instância só enxerga a própria clínica —
justamente a segurança desejada). "Gerenciar as clínicas" é um **runbook operacional** (abaixo).

## Inventário por clínica (o que precisa ser provisionado)
**Front-end (Vercel — variáveis):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPID_PUBLIC_KEY`, `VITE_CPF_EMAIL_DOMAIN`.

**Edge Functions (segredos Supabase):** `OPENAI_API_KEY`, `OPENAI_MODEL`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `CPF_EMAIL_DOMAIN`,
`GATEWAY_WEBHOOK_SECRET`. (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são injetados pelo Supabase.)

**Funções a publicar (8):** `assistant`, `send-push`, `send-notifications`,
`provision-patient-access`, `provision-staff-access`, `create-pix-charge`, `pix-webhook`,
`treatment-plan-suggest`.

## Runbook de instalação de uma nova clínica
1. **Supabase**: criar projeto → anotar URL, anon key, service_role.
2. **Schema**: `supabase link --project-ref <novo>` + `supabase db push` (aplica 0001→últimas;
   cria tabelas, RLS, buckets de storage e funções SQL).
3. **Seed**: inserir a linha em `clinics` + criar o 1º **admin** (via `provision-staff-access` ou seed SQL).
4. **Segredos** (Supabase): setar os segredos das edge functions (lista acima), gerando um **novo par VAPID**.
5. **Functions**: `supabase functions deploy` das 8.
6. **Vercel**: novo projeto do mesmo repo → variáveis `VITE_*` da nova clínica → deploy.
7. **Conferir**: login do admin, tema/logo, push, assistente, agenda.

## Gestão de migrations entre clínicas (fazer com cuidado)
- Adotar `supabase db push` por projeto (aplica pendentes em ordem e registra o histórico).
- **Atenção (projeto atual):** as migrations foram aplicadas via **SQL Editor**, então o histórico
  (`supabase_migrations.schema_migrations`) pode não refletir. Antes do 1º `db push` no projeto
  atual, **regularizar** com `supabase migration repair --status applied <versão>` para marcar as
  existentes como aplicadas (senão o push tentaria rodar tudo de novo).
- Projetos **novos** recebem `db push` limpo (base vazia → roda tudo em ordem).
- Opcional: um `scripts/onboard-clinica.sh` para rodar push + deploy das functions + seed,
  parametrizado por projeto; e/ou GitHub Action (exige guardar credenciais de cada base no CI).

## Riscos e mitigação
- **Conflito de dados** → eliminado por bases fisicamente separadas.
- **Divergência de schema** → `db push` por projeto + script que roda em todos evita esquecer alguém.
- **Segredos trocados** → cada Vercel/Supabase tem os seus; seguir o checklist do runbook.

## Itens deixados no roadmap (decisão do cliente)
- **Multi-clínica (esta página)** — parado; executar quando entrar a 2ª clínica.
- **Captação automática de leads (link/QR público)** — CRM; exige rota pública sem login + função
  `security definer`/edge para inserir com segurança. Fazer análise de segurança antes.
- **Cobrança PIX automática** e **envio por WhatsApp** (API oficial) — dependem de contas/contratos externos.
