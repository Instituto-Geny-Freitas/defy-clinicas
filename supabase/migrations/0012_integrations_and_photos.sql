-- =============================================================================
-- 0012_integrations_and_photos.sql
-- (1) Configuração "plugável" de integrações (gateway de pagamento, WhatsApp...)
--     definida na área de Configurações pelo admin. NÃO guarda segredos.
-- (2) Fotos clínicas de evolução (antes/depois) — já no MVP.
-- =============================================================================

-- (1) Integrações configuráveis ----------------------------------------------
-- Apenas dados NÃO sensíveis (qual provedor está ativo, modo, chave pública,
-- chave PIX, URL de webhook). As CHAVES SECRETAS ficam em segredos da Edge
-- Function / Supabase Vault — nunca aqui (esta tabela é lida pelo app).
do $$ begin
  create type integration_category as enum ('pagamento', 'whatsapp', 'email');
exception when duplicate_object then null; end $$;

create table integration_settings (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  categoria       integration_category not null,
  provider        text,                  -- 'asaas' | 'mercadopago' | 'pagarme' | 'wa_cloud' | ...
  modo            text not null default 'sandbox',   -- 'sandbox' | 'producao'
  config_publica  jsonb not null default '{}'::jsonb, -- { chave_publica, chave_pix, webhook_url, ... }
  ativo           boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinic_id, categoria)          -- uma config ativa por categoria
);

create trigger trg_integration_settings_updated_at
  before update on integration_settings
  for each row execute function app.set_updated_at();

comment on table integration_settings is
  'Configuração plugável de integrações (gateway PIX, WhatsApp). Sem segredos — chaves secretas vão para Vault/Edge secrets.';
comment on column integration_settings.config_publica is
  'Somente dados não sensíveis (chave pública, chave PIX, URL de webhook).';

-- (2) Fotos clínicas de evolução ---------------------------------------------
-- Arquivos no bucket privado patient-files, sob a pasta <patient_id>/...
-- grupo_id agrupa um conjunto comparativo (ex.: par antes/depois da mesma região).
do $$ begin
  create type photo_categoria as enum ('antes', 'depois', 'evolucao', 'outro');
exception when duplicate_object then null; end $$;

create table clinical_photos (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid references procedures_log(id) on delete set null,
  assessment_id   uuid references assessments(id) on delete set null,
  categoria       photo_categoria not null default 'evolucao',
  regiao          text,
  grupo_id        uuid,                  -- agrupa antes/depois comparáveis
  sessao          integer,
  arquivo_url     text not null,         -- caminho no Storage (patient-files)
  thumb_url       text,
  observacoes     text,
  visivel_paciente boolean not null default true,  -- exibir no portal do paciente?
  capturada_em    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index idx_clinical_photos_patient on clinical_photos(patient_id);
create index idx_clinical_photos_grupo on clinical_photos(grupo_id);
create index idx_clinical_photos_procedure on clinical_photos(procedure_id);

comment on table clinical_photos is 'Fotos clínicas (antes/depois/evolução); arquivos no bucket privado patient-files.';

-- RLS -------------------------------------------------------------------------
alter table integration_settings enable row level security;
alter table clinical_photos       enable row level security;

-- Integrações: somente admin (contém configuração operacional sensível).
create policy integration_settings_admin on integration_settings for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Fotos: equipe gerencia tudo; paciente vê as próprias marcadas como visíveis.
create policy clinical_photos_staff on clinical_photos for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy clinical_photos_patient_read on clinical_photos for select to authenticated
  using (patient_id = app.current_patient_id() and visivel_paciente);
