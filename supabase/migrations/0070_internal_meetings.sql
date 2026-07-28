-- 0070_internal_meetings.sql
-- Reuniões Internas (gestão da clínica). Aditivo e idempotente. RLS só para equipe
-- (nunca no portal do paciente). As atas geram atividades (internal_activities)
-- na Fase 2b via a coluna meeting_id (FK adicionada aqui).

create table if not exists internal_meetings (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  titulo          text not null,
  data            date,
  hora            time,
  topicos         text,
  ata             text,
  status          text not null default 'agendada',  -- 'agendada' | 'realizada' | 'cancelada'
  created_by      uuid references professionals(id) on delete set null,
  created_by_nome text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists internal_meetings_clinic_data_idx on internal_meetings (clinic_id, data);

alter table internal_meetings enable row level security;
do $$ begin
  create policy internal_meetings_staff_all on internal_meetings for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

create table if not exists internal_meeting_participants (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  meeting_id      uuid not null references internal_meetings(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  convocado       boolean not null default true,
  confirmado_em   timestamptz,
  ciente_em       timestamptz,
  manifestacao    text,
  created_at      timestamptz not null default now(),
  unique (meeting_id, professional_id)
);
create index if not exists internal_meeting_participants_meeting_idx on internal_meeting_participants (meeting_id);
create index if not exists internal_meeting_participants_prof_idx on internal_meeting_participants (professional_id);

alter table internal_meeting_participants enable row level security;
do $$ begin
  create policy internal_meeting_participants_staff_all on internal_meeting_participants for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

-- FK das atividades geradas em reunião (coluna meeting_id já existe em 0068).
do $$ begin
  alter table internal_activities
    add constraint internal_activities_meeting_fk
    foreign key (meeting_id) references internal_meetings(id) on delete set null;
exception when duplicate_object then null; end $$;
