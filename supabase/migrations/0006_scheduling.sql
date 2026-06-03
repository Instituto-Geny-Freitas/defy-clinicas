-- =============================================================================
-- 0006_scheduling.sql
-- Agenda de consultas/sessões. Base para lembretes automáticos (pg_cron).
-- =============================================================================

create table appointments (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedimento    text,
  inicio          timestamptz not null,
  fim             timestamptz,
  status          appointment_status not null default 'agendado',
  origem          fill_source not null default 'profissional',  -- agendado pelo paciente ou equipe
  observacoes     text,
  -- Controle de lembrete automático:
  lembrete_enviado_em timestamptz,
  confirmado_em   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_appointment_period check (fim is null or fim > inicio)
);

create index idx_appointments_patient on appointments(patient_id);
create index idx_appointments_professional on appointments(professional_id);
create index idx_appointments_inicio on appointments(inicio);
create index idx_appointments_status on appointments(status);

create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function app.set_updated_at();

comment on table appointments is 'Agendamentos; base dos lembretes automáticos de aproximação de consulta.';
