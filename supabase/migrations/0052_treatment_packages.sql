-- =============================================================================
-- 0052_treatment_packages.sql — Pacotes de sessões
-- Pacote = procedimento X × N sessões vendido ao paciente, com contador de
-- sessões realizadas (razão em package_sessions). 100% aditivo.
--   • treatment_packages: o pacote (sessões compradas, valor, vínculos opcionais).
--   • package_sessions: 1 linha por sessão realizada (baixa manual pelo profissional).
--   • Restantes = sessoes_compradas − nº de linhas em package_sessions.
-- FKs com on delete set null para não apagar histórico ao remover orçamento/plano.
-- =============================================================================

begin;

create table if not exists treatment_packages (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  patient_id        uuid not null references patients(id) on delete cascade,
  professional_id   uuid references professionals(id) on delete set null,
  procedure_type_id uuid references procedure_types(id) on delete set null,
  procedimento      text not null,                          -- rótulo estável p/ exibição
  sessoes_compradas integer not null default 1 check (sessoes_compradas > 0),
  valor_total       numeric(12,2) not null default 0,
  quote_id          uuid references quotes(id) on delete set null,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  data              date not null default current_date,
  observacoes       text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_treatment_packages_patient on treatment_packages(patient_id);

create table if not exists package_sessions (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  package_id      uuid not null references treatment_packages(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid references procedures_log(id) on delete set null,  -- vínculo opcional
  data            date not null default current_date,
  observacoes     text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_package_sessions_package on package_sessions(package_id);

alter table treatment_packages enable row level security;
alter table package_sessions   enable row level security;

do $$ begin
  create policy tp_staff on treatment_packages for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy tp_patient_read on treatment_packages for select to authenticated using (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ps_staff on package_sessions for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ps_patient_read on package_sessions for select to authenticated
    using (exists (select 1 from treatment_packages tp where tp.id = package_sessions.package_id and tp.patient_id = app.current_patient_id()));
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_treatment_packages_updated_at before update on treatment_packages
    for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

commit;
