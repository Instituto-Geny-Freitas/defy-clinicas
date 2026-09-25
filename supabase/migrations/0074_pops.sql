-- 0074_pops.sql
-- Procedimentos Operacionais Padrão (POPs). Aditivo e idempotente.
-- Documentos internos da clínica (SOP): título do procedimento + uma estrutura
-- de blocos (subtítulo + linhas de 2 colunas em texto rico HTML), quadro de
-- aprovação (elaborado/revisado/data) e snapshot do gestor que editou.
-- RLS: leitura para a EQUIPE (nunca exposto ao portal do paciente); escrita só
-- para ADMIN (a edição vive nas Configurações, restritas ao admin). O envio ao
-- paciente ocorre por PDF via shared_documents — a linha do POP em si fica interna.

create table if not exists pops (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null references clinics(id) on delete cascade,
  titulo                 text not null,
  estrutura              jsonb not null default '[]'::jsonb,   -- [{ id, subtitulo, linhas: [{ col1, col2 }] }]
  elaborado_por          uuid references professionals(id) on delete set null,
  revisado_por           uuid references professionals(id) on delete set null,
  data_aprovacao         date,
  gestor_professional_id uuid references professionals(id) on delete set null,
  gestor_nome            text,
  gestor_conselho        text,
  ativo                  boolean not null default true,
  created_by             uuid references professionals(id) on delete set null,
  created_by_nome        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists pops_clinic_idx on pops (clinic_id, ativo);

alter table pops enable row level security;

do $$ begin
  create policy pops_select on pops for select to authenticated
    using (app.is_staff());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy pops_insert on pops for insert to authenticated
    with check (app.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy pops_update on pops for update to authenticated
    using (app.is_admin())
    with check (app.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy pops_delete on pops for delete to authenticated
    using (app.is_admin());
exception when duplicate_object then null; end $$;
