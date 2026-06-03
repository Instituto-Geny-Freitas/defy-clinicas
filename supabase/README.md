# Banco de dados — Clínica Geny (Supabase)

Esquema da **Fase 1 (MVP)** do sistema de gestão da clínica de estética.
Instância única (Instituto Geny Freitas), multiprofissional, com portal do paciente.

## Estrutura

```
supabase/
├── migrations/
│   ├── 0001_extensions_and_enums.sql   Extensões + tipos enumerados
│   ├── 0002_helpers_and_triggers.sql   Funções de RLS + trigger updated_at
│   ├── 0003_clinic_and_users.sql       clinics, professionals, patients
│   ├── 0004_documents.sql              Motor de documentos dinâmicos (termos/orientações)
│   ├── 0005_clinical_records.sql       Anamnese, avaliações, medidas, procedimentos, prescrições, exames
│   ├── 0006_scheduling.sql             Agenda (appointments)
│   ├── 0007_inventory.sql              Estoque + movimentações (baixa automática)
│   ├── 0008_finance.sql                Orçamentos + pagamentos (PIX) + saldo
│   ├── 0009_notifications.sql          Fila de notificações + orientações + push
│   ├── 0010_rls_policies.sql           Row Level Security (equipe x paciente)
│   ├── 0011_storage_buckets.sql        Buckets de Storage + políticas
│   └── 0012_integrations_and_photos.sql Gateway plugável + fotos clínicas (antes/depois)
└── seed.sql                            Clínica, profissional e modelos reais (extraídos dos PDFs)
```

## Como aplicar

### Opção A — Supabase CLI (recomendado)
```powershell
# instalar: https://supabase.com/docs/guides/cli
supabase init                # se ainda não houver projeto local
supabase start               # sobe stack local (Docker)
supabase db reset            # aplica migrations + seed.sql
```
Para um projeto na nuvem:
```powershell
supabase link --project-ref <ref-do-projeto>
supabase db push             # aplica as migrations
# rode o seed manualmente uma vez:
#   psql "$DATABASE_URL" -f supabase/seed.sql
```

### Opção B — SQL Editor do dashboard
Cole o conteúdo de cada arquivo de `migrations/` **na ordem numérica** e execute;
depois execute `seed.sql`.

## Modelo de acesso (RLS)

- **Equipe** (`professionals` com `ativo=true`): acessa todos os dados da clínica.
  `admin` gerencia configuração/equipe.
- **Paciente**: vê/edita apenas as próprias linhas. Pode preencher a **anamnese**,
  enviar **resultados de exame**, **agendar/confirmar** consultas e **assinar/consentir**
  documentos e orientações.

As decisões de identidade ficam em funções `SECURITY DEFINER` no schema `app`
(`is_staff`, `is_admin`, `current_patient_id`, `current_professional_id`).

## Pós-MVP (próximas migrations)

- `pg_cron`/Edge Functions: disparo de lembretes de consulta e sequências de
  cuidados pós-procedimento (lê `document_templates.reminder_schedule`).
- Webhook do gateway PIX → atualiza `payments.status` e o saldo do orçamento.
- Geração de PDF (Edge Function) preenchendo `document_instances.pdf_url` + `content_hash`.

## Autenticação (configurar no painel Supabase Auth)

- **Google** OAuth (paciente).
- **CPF + senha**: criar usuário com e-mail sintético (ex.: `<cpf>@geny.local`) e
  guardar o CPF em `patients.cpf`; o formulário de login traduz CPF → e-mail interno.
- **Equipe**: e-mail + senha (recomendado habilitar 2FA).

> Após o primeiro login de cada usuário, vincule `auth.users.id` ao registro
> correspondente em `patients.auth_user_id` / `professionals.auth_user_id`
> (idealmente via trigger `on auth.user created` ou na tela de onboarding).
