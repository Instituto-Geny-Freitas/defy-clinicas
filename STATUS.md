# STATUS do Projeto — Clínica de Estética (Instituto Geny Freitas)

Sistema de gestão para clínica de estética: **Área da Clínica** (multiprofissional) +
**Portal do Paciente**. Stack: **Supabase** (Postgres + Auth + Storage + Edge Functions)
e **PWA** React + Vite + TypeScript + Tailwind. Repositório: `IADefySolutions/defy-clinicas`.

## Como rodar / publicar
- App: `cd app && npm install && npm run dev` (precisa de `app/.env.local` — ver `.env.example`).
- Banco: aplicar `supabase/migrations/*` em ordem (ou `supabase/_apply_all.sql`) no SQL Editor.
- Deploy frontend: ver [app/DEPLOY.md](app/DEPLOY.md) (Vercel: Root=`app`, vars `VITE_*`).

## Funcionalidades (construídas e validadas)

### Área da Clínica
- **Dashboard** com números reais + alertas (consultas do dia, estoque baixo/validade).
- **Pacientes**: cadastro/edição (CRUD), idade automática, consentimento LGPD, acesso (senha provisória).
  - Ficha com abas: **Resumo, Anamnese, Avaliações** (dermato/capilar/corporal), **Plano** (com IA),
    **Procedimentos** (baixa de estoque), **Medidas** (gráfico), **Suplementação**, **Manipulação**,
    **Exames**, **Fotos** (antes/depois), **Documentos** (emitir/assinar/PDF/editar), **Financeiro**.
- **Agenda** multiprofissional: calendário visual, atribuição/filtro por profissional, remarcação.
- **Estoque**: produtos, lote, validade, margem, baixa automática, alertas.
- **Financeiro**: orçamentos, pagamentos, saldos, produtos utilizados por orçamento.
- **Relatórios**: faturamento do mês (por método), a receber, estoque, atendimentos.
- **Modelos de Documentos** (CRUD): termos e orientações com campos dinâmicos + lembretes.
- **Configurações**: identidade visual (white-label), equipe (+ provisionar acesso), integrações,
  textos-padrão (snippets), LGPD.

### Portal do Paciente
- Login Google / CPF / e-mail; **troca obrigatória** de senha no 1º acesso (exceto Google);
  **recuperação de senha** por e-mail.
- **Início** com avisos (in-app) + ativar **push**; **Agendamentos** (ver + **solicitar horário**);
  **Anamnese** (preencher); **Documentos** (ler/assinar/ PDF); **Evolução** (gráfico de medidas,
  exames com upload de resultado, fotos); **Financeiro** (orçamentos/saldos + produtos utilizados).

### Automação
- Trigger: ao emitir orientação, enfileira **notificações** (in-app/push) da `reminder_schedule`.
- `pg_cron`: **lembretes de consulta** (migration 0016, requer extensão habilitada).
- Onboarding automático: vincula usuário↔paciente/profissional no 1º login (trigger).

## Banco de dados (migrations 0001–0021)
27+ tabelas, **RLS** em todas (equipe vê tudo; paciente só o próprio), view de saldos com
`security_invoker`, triggers (estoque, automação, onboarding). Seed com a clínica, termos e
orientações reais.

## Edge Functions (deployadas)
- `provision-patient-access` — cria/redefine login do paciente (senha provisória).
- `provision-staff-access` — idem para a equipe (apenas admin).
- `treatment-plan-suggest` — sugestão de plano por IA (requer `OPENAI_API_KEY`).
- `send-push` — Web Push via VAPID (segredos configurados).
- *(scaffolding, não ativas):* `send-notifications` (WhatsApp), `create-pix-charge`, `pix-webhook`.

## Pendências

### Exceções combinadas (entregues como scaffolding/arquitetura, faltam contas externas)
- **PIX**: gateway plugável (Configurações → Integrações) + funções `create-pix-charge`/`pix-webhook`.
  Falta: escolher gateway, chaves e deploy das funções.
- **WhatsApp**: hoje via link `wa.me`. Envio automatizado (`send-notifications`) requer WhatsApp Cloud API.

### Operacional (ações no painel — não são código)
- [ ] Rotacionar segredos expostos (service_role, senha do banco, Google Client Secret).
- [ ] Ativar **Google OAuth** no Auth.
- [ ] Aplicar migrations pendentes (conferir 0016 pg_cron, 0021) e habilitar `pg_cron`.
- [ ] Definir `OPENAI_API_KEY` (IA) e agendar `send-push`.
- [ ] Deploy do frontend na Vercel + `VITE_*` (incl. `VITE_VAPID_PUBLIC_KEY`).
- [ ] (Opcional) SMTP próprio para e-mails de recuperação.

### Refinamentos (não bloqueiam)
- Editar/excluir em alguns registros clínicos (hoje: criar + listar).
- Feedback de erros via toasts; testes automatizados; geração de tipos do banco.

## Credenciais de teste (projeto de dev)
- Equipe (admin): `yokemura@gmail.com`
- Paciente: `paciente.teste1@example.com`
