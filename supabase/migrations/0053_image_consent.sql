-- =============================================================================
-- 0053_image_consent.sql — Termo de uso de imagem (espelha o modelo LGPD)
-- Consentimento específico para uso de imagem (fotos antes/depois), separado do
-- consentimento LGPD. Texto/versão ficam em clinics.dados_empresa->'imagem'
-- (sem coluna, igual ao LGPD). Aqui: estado no paciente + log de auditoria.
-- 100% aditivo.
-- =============================================================================

alter table patients
  add column if not exists consentimento_imagem_em     timestamptz,
  add column if not exists consentimento_imagem_versao text;

comment on column patients.consentimento_imagem_em is
  'Data/hora do consentimento de uso de imagem do paciente.';

create table if not exists image_consent_logs (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  versao     text,
  origem     fill_source not null default 'paciente',
  created_at timestamptz not null default now()
);
create index if not exists idx_image_consent_logs_patient on image_consent_logs(patient_id);

alter table image_consent_logs enable row level security;
do $$ begin
  create policy icl_staff on image_consent_logs for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy icl_patient_read on image_consent_logs for select to authenticated using (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy icl_patient_insert on image_consent_logs for insert to authenticated with check (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
