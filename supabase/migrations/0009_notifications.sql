-- =============================================================================
-- 0009_notifications.sql
-- Fila de notificações (push/WhatsApp/email/in-app) e consentimento de leitura
-- das orientações pelo paciente. Alimentada por gatilhos e por jobs pg_cron.
-- =============================================================================

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  tipo            text not null,                       -- 'lembrete_consulta','pos_procedimento','estoque',...
  canal           notification_channel not null default 'in_app',
  titulo          text,
  payload         jsonb not null default '{}'::jsonb,
  agendado_para   timestamptz not null default now(),  -- quando deve ser disparada
  status          notification_status not null default 'pendente',
  enviado_em      timestamptz,
  lido_em         timestamptz,
  erro            text,
  -- Referências de origem (opcionais):
  appointment_id  uuid references appointments(id) on delete set null,
  document_instance_id uuid references document_instances(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_notifications_patient on notifications(patient_id);
create index idx_notifications_status on notifications(status);
create index idx_notifications_agendado on notifications(agendado_para) where status = 'pendente';

create trigger trg_notifications_updated_at
  before update on notifications
  for each row execute function app.set_updated_at();

-- Consentimento/leitura de orientações pelo paciente --------------------------
-- Liga uma orientação (document_template tipo='orientacao') a um paciente,
-- registrando indicação para leitura, leitura e consentimento.
create table patient_guidance (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  template_id     uuid not null references document_templates(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid references procedures_log(id) on delete set null,
  indicado_em     timestamptz not null default now(),
  lido_em         timestamptz,
  consentido_em   timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_patient_guidance_patient on patient_guidance(patient_id);

-- Tokens de push (PWA / Web Push) por usuário ---------------------------------
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null,
  keys            jsonb not null,                      -- { p256dh, auth }
  user_agent      text,
  created_at      timestamptz not null default now(),
  unique (auth_user_id, endpoint)
);

comment on table notifications is 'Fila de notificações; agendado_para + pg_cron disparam o envio.';
comment on table patient_guidance is 'Orientações indicadas ao paciente com trilha de leitura/consentimento.';
comment on table push_subscriptions is 'Assinaturas Web Push do PWA por usuário.';
