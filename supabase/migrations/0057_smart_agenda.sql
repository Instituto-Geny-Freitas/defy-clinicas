-- =============================================================================
-- 0057_smart_agenda.sql — Agenda inteligente
--   1) resources: salas/equipamentos da clínica
--   2) appointments.resource_id (opcional) + trava de duplo-agendamento do
--      mesmo recurso (exclusion constraint por sobreposição de período)
--   3) waitlist: lista de espera (equipe)
--
-- 100% aditivo/idempotente. A coluna resource_id nasce NULL em todas as linhas
-- existentes, então a exclusion constraint (parcial: só resource_id not null e
-- não cancelado) não conflita com nenhum agendamento atual.
-- =============================================================================
begin;

create extension if not exists btree_gist;

-- 1) Recursos (salas / equipamentos) ----------------------------------------
create table if not exists resources (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  tipo       text not null default 'sala' check (tipo in ('sala', 'equipamento')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_resources_clinic on resources(clinic_id);

alter table resources enable row level security;
do $$ begin
  create policy resources_read on resources for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy resources_write on resources for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

-- 2) Recurso do agendamento (opcional) + trava de conflito -------------------
alter table appointments add column if not exists resource_id uuid references resources(id) on delete set null;
create index if not exists idx_appointments_resource on appointments(resource_id);

-- Período do agendamento como tstzrange (fim ausente => +30 min). Envolvido numa
-- função IMMUTABLE porque `timestamptz + interval` é STABLE (DST) e índices exigem
-- IMMUTABLE; para um offset fixo de 30 min o resultado é determinístico.
create or replace function app.appt_period(p_inicio timestamptz, p_fim timestamptz)
returns tstzrange language sql immutable as $$
  select tstzrange(p_inicio, coalesce(p_fim, p_inicio + interval '30 minutes'));
$$;

-- Impede dois agendamentos do MESMO recurso com períodos sobrepostos.
-- Cancelados são ignorados. Períodos meio-abertos [inicio, fim): agendamentos
-- encostados (fim == inicio seguinte) não colidem.
do $$ begin
  alter table appointments add constraint excl_appointments_resource
    exclude using gist (
      resource_id with =,
      app.appt_period(inicio, fim) with &&
    ) where (resource_id is not null and status <> 'cancelado');
exception when duplicate_object then null; end $$;

-- 3) Lista de espera (equipe) ------------------------------------------------
create table if not exists waitlist (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid references patients(id) on delete set null,
  nome_avulso     text,
  telefone_avulso text,
  professional_id uuid references professionals(id) on delete set null,
  procedimento    text,
  observacoes     text,
  status          text not null default 'aguardando' check (status in ('aguardando', 'agendado', 'cancelado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_waitlist_clinic_status on waitlist(clinic_id, status);

alter table waitlist enable row level security;
do $$ begin
  create policy waitlist_staff on waitlist for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_waitlist_updated_at before update on waitlist for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

commit;
