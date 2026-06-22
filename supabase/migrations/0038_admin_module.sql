-- =============================================================================
-- 0038_admin_module.sql
-- Área Administrativa: registros operacionais (intercorrências, equipamentos,
-- limpeza/desinfecção, esterilização, EPIs, prestadores, pragas, validade de
-- produtos, calibração) usando um MOTOR de formulários data-driven (JSONB),
-- além da extensão do cadastro de profissional (Corpo Técnico) e dois domínios
-- configuráveis (Serviços Prestados e Vacinas).
--
-- As DEFINIÇÕES dos formulários (campos) vivem no código e podem ser
-- personalizadas pelo admin; as personalizações são salvas em
-- clinics.dados_empresa.admin_forms (igual à matriz de permissões). Por isso
-- adicionar/alterar/excluir campos NÃO exige migração.
-- =============================================================================

-- 1) Corpo Técnico: novos campos no cadastro do profissional ------------------
alter table professionals
  add column if not exists formacao            text,
  add column if not exists responsavel_tecnico boolean not null default false,
  add column if not exists cpf                 text,
  add column if not exists servicos_prestados  jsonb   not null default '[]'::jsonb,
  add column if not exists vacinas             jsonb   not null default '{}'::jsonb;

-- 2) Domínio: Serviços Prestados (CRUD em Configurações) ---------------------
create table if not exists servico_tipos (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);
alter table servico_tipos enable row level security;
create policy servico_tipos_staff_read on servico_tipos for select to authenticated using (app.is_staff());
create policy servico_tipos_admin_write on servico_tipos for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

insert into servico_tipos (clinic_id, nome, ordem)
select c.id, v.nome, v.ord
from clinics c
cross join (values
  ('Intradermoterapia', 1), ('Microagulhamento', 2), ('Preenchimento dérmico', 3),
  ('Terapia capilar', 4), ('Tratamento para celulite', 5), ('Estrias', 6),
  ('Flacidez', 7), ('Harmonização orofacial', 8), ('Toxina botulínica', 9),
  ('Bioestimuladores', 10), ('Limpeza de pele', 11), ('Massagem modeladora', 12),
  ('Drenagem linfática', 13)
) as v(nome, ord)
on conflict (clinic_id, nome) do nothing;

-- 3) Domínio: Vacinas obrigatórias (CRUD em Configurações) -------------------
create table if not exists vacina_tipos (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);
alter table vacina_tipos enable row level security;
create policy vacina_tipos_staff_read on vacina_tipos for select to authenticated using (app.is_staff());
create policy vacina_tipos_admin_write on vacina_tipos for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

insert into vacina_tipos (clinic_id, nome, ordem)
select c.id, v.nome, v.ord
from clinics c
cross join (values ('Hepatite B', 1), ('Difteria', 2), ('Tétano', 3)) as v(nome, ord)
on conflict (clinic_id, nome) do nothing;

-- 4) Registros administrativos (motor genérico) ------------------------------
create table if not exists admin_records (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  form_chave      text not null,                     -- identifica o formulário
  patient_id      uuid references patients(id) on delete set null,
  ref_data        date,                              -- data "principal" p/ filtro
  seq             text,                              -- numerador formatado (quando houver)
  dados           jsonb not null default '{}'::jsonb,
  created_by      uuid,                              -- auth.uid() de quem registrou
  created_by_nome text,                              -- nome de exibição (log)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists admin_records_form_idx on admin_records (clinic_id, form_chave, ref_data);
create index if not exists admin_records_patient_idx on admin_records (patient_id);

alter table admin_records enable row level security;
create policy admin_records_staff_all on admin_records for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- 5) Numerador automático (nnnnn/ano/códigocliente) --------------------------
create table if not exists admin_counters (
  clinic_id uuid not null references clinics(id) on delete cascade,
  escopo    text not null,
  ano       int  not null,
  atual     int  not null default 0,
  primary key (clinic_id, escopo, ano)
);
alter table admin_counters enable row level security;
create policy admin_counters_staff_all on admin_counters for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- Incrementa e devolve o próximo número da sequência (atômico).
-- Em schema public para ser chamável via PostgREST RPC (supabase.rpc).
create or replace function public.next_admin_seq(p_clinic uuid, p_escopo text, p_ano int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_atual int;
begin
  if not app.is_staff() then
    raise exception 'not authorized';
  end if;
  insert into admin_counters (clinic_id, escopo, ano, atual)
  values (p_clinic, p_escopo, p_ano, 1)
  on conflict (clinic_id, escopo, ano)
  do update set atual = admin_counters.atual + 1
  returning atual into v_atual;
  return v_atual;
end;
$$;

-- 6) Bucket privado para anexos administrativos ------------------------------
insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', false)
on conflict (id) do nothing;

create policy admin_files_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'admin-files' and app.is_staff())
  with check (bucket_id = 'admin-files' and app.is_staff());
