-- 0068_internal_activities.sql
-- Atividades Internas (gestão da clínica). Aditivo e idempotente.
-- RLS SÓ para equipe (nunca exposto ao portal do paciente):
--   - Admin: CRUD de todas.
--   - Membro: vê as atribuídas a si ou criadas por si; CRUD só das criadas por si.
-- Cada atividade tem origem (admin/membro/reuniao), data/hora, status
-- (pendente/executado/redirecionado) e data_efetivada. Ajustes ficam no log.

create table if not exists internal_activities (
  id                          uuid primary key default gen_random_uuid(),
  clinic_id                   uuid not null references clinics(id) on delete cascade,
  titulo                      text not null,
  descricao                   text,
  responsavel_professional_id uuid references professionals(id) on delete set null,
  origem                      text not null default 'membro',   -- 'admin' | 'membro' | 'reuniao'
  meeting_id                  uuid,                              -- vínculo com reunião (Fase 2)
  data                        date,
  hora                        time,
  status                      text not null default 'pendente', -- 'pendente' | 'executado' | 'redirecionado'
  data_efetivada              date,
  created_by                  uuid references professionals(id) on delete set null,
  created_by_nome             text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists internal_activities_clinic_data_idx on internal_activities (clinic_id, data);
create index if not exists internal_activities_resp_idx on internal_activities (responsavel_professional_id);
create index if not exists internal_activities_creator_idx on internal_activities (created_by);
create index if not exists internal_activities_meeting_idx on internal_activities (meeting_id);

alter table internal_activities enable row level security;

do $$ begin
  create policy internal_activities_select on internal_activities for select to authenticated
    using (
      app.is_admin()
      or responsavel_professional_id = app.current_professional_id()
      or created_by = app.current_professional_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy internal_activities_insert on internal_activities for insert to authenticated
    with check (
      app.is_staff()
      and (app.is_admin() or created_by = app.current_professional_id())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy internal_activities_update on internal_activities for update to authenticated
    using (app.is_admin() or created_by = app.current_professional_id())
    with check (app.is_admin() or created_by = app.current_professional_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy internal_activities_delete on internal_activities for delete to authenticated
    using (app.is_admin() or created_by = app.current_professional_id());
exception when duplicate_object then null; end $$;

-- Log de ajustes (principalmente das atividades criadas pelo Admin).
create table if not exists internal_activity_log (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  activity_id     uuid not null references internal_activities(id) on delete cascade,
  changed_by      uuid references professionals(id) on delete set null,
  changed_by_nome text,
  campo           text not null,
  de              text,
  para            text,
  created_at      timestamptz not null default now()
);
create index if not exists internal_activity_log_activity_idx on internal_activity_log (activity_id, created_at);

alter table internal_activity_log enable row level security;

do $$ begin
  create policy internal_activity_log_staff_read on internal_activity_log for select to authenticated
    using (app.is_staff());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy internal_activity_log_staff_insert on internal_activity_log for insert to authenticated
    with check (app.is_staff());
exception when duplicate_object then null; end $$;
