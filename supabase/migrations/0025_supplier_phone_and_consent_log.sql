-- =============================================================================
-- 0025_supplier_phone_and_consent_log.sql
-- Telefone/WhatsApp no fornecedor + log de auditoria do consentimento LGPD
-- (cada confirmação registra data/hora, versão e origem).
-- =============================================================================

alter table suppliers
  add column if not exists telefone text;

create table if not exists lgpd_consent_logs (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  versao     text,
  origem     fill_source not null default 'paciente',
  created_at timestamptz not null default now()
);
create index if not exists idx_consent_logs_patient on lgpd_consent_logs(patient_id);

alter table lgpd_consent_logs enable row level security;
create policy cl_staff on lgpd_consent_logs for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy cl_patient_read on lgpd_consent_logs for select to authenticated
  using (patient_id = app.current_patient_id());
create policy cl_patient_insert on lgpd_consent_logs for insert to authenticated
  with check (patient_id = app.current_patient_id());
