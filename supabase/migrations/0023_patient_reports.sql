-- =============================================================================
-- 0023_patient_reports.sql
-- Relatórios gerados pelo paciente (procedimentos, manipulações, medidas,
-- suplementações) com período. Armazenados no perfil (visíveis ao admin).
-- Limite por paciente, controlado pelo admin e IMPOSTO no banco (trigger),
-- para evitar armazenamento sem controle.
-- =============================================================================

alter table patients
  add column if not exists limite_relatorios integer not null default 10;
comment on column patients.limite_relatorios is
  'Máximo de relatórios que o paciente pode manter armazenados (definido pelo admin).';

create table if not exists patient_reports (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  patient_id     uuid not null references patients(id) on delete cascade,
  titulo         text,
  secoes         jsonb not null default '[]'::jsonb,   -- ['procedimentos','medidas',...]
  periodo_inicio date,
  periodo_fim    date,
  arquivo_url    text,                                  -- PDF no bucket patient-files
  gerado_por     fill_source not null default 'paciente',
  created_at     timestamptz not null default now()
);
create index if not exists idx_patient_reports_patient on patient_reports(patient_id);

alter table patient_reports enable row level security;
create policy pr_staff on patient_reports for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy pr_patient_read on patient_reports for select to authenticated
  using (patient_id = app.current_patient_id());
create policy pr_patient_insert on patient_reports for insert to authenticated
  with check (patient_id = app.current_patient_id());
create policy pr_patient_delete on patient_reports for delete to authenticated
  using (patient_id = app.current_patient_id());

-- Protege o limite: paciente não pode alterar o próprio limite_relatorios.
create or replace function app.protect_patient_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not app.is_staff() then
    new.limite_relatorios := old.limite_relatorios;
  end if;
  return new;
end; $$;
drop trigger if exists trg_protect_patient_limit on patients;
create trigger trg_protect_patient_limit before update on patients
  for each row execute function app.protect_patient_limit();

-- Impõe o limite ao gerar um relatório (mesmo via API direta).
create or replace function app.enforce_report_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_lim int; v_count int;
begin
  select limite_relatorios into v_lim from patients where id = new.patient_id;
  select count(*) into v_count from patient_reports where patient_id = new.patient_id;
  if v_count >= coalesce(v_lim, 10) then
    raise exception 'Limite de relatórios atingido (%). Remova relatórios antigos ou solicite ampliação à clínica.', coalesce(v_lim, 10)
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists trg_enforce_report_limit on patient_reports;
create trigger trg_enforce_report_limit before insert on patient_reports
  for each row execute function app.enforce_report_limit();
