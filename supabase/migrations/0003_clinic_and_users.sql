-- =============================================================================
-- 0003_clinic_and_users.sql
-- Configuração da clínica (registro único / white-label), profissionais e
-- pacientes. Vinculados ao auth.users do Supabase.
-- =============================================================================

-- Configuração da clínica (instância única) ----------------------------------
-- Mantém-se uma única linha. clinic_id é referenciado pelas demais tabelas
-- como boa prática e para suportar o tema white-label / dados da empresa.
create table clinics (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  razao_social    text,
  cnpj            text,
  responsavel_tecnico text,
  telefone        text,
  whatsapp        text,
  email           citext,
  endereco        jsonb,                       -- { logradouro, numero, bairro, cidade, uf, cep }
  logo_url        text,                        -- arquivo no Storage
  tema_cores      jsonb not null default '{}'::jsonb,  -- { primaria, secundaria, ... }
  dados_empresa   jsonb not null default '{}'::jsonb,  -- textos institucionais, rodapé de PDF, etc.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_clinics_updated_at
  before update on clinics
  for each row execute function app.set_updated_at();

-- Profissionais / equipe ------------------------------------------------------
create table professionals (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  nome            text not null,
  cpf             text,
  email           citext,
  telefone        text,
  role            user_role not null default 'profissional',
  -- Dados que qualificam o profissional e aparecem nos documentos formais:
  conselho_tipo   text,          -- ex.: CRM, COREN, CRBM, CRF, CRO...
  conselho_numero text,          -- nº de registro no conselho
  conselho_uf     text,
  especialidade   text,
  formacao        text,
  assinatura_url  text,          -- imagem da assinatura para os PDFs
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_professionals_clinic on professionals(clinic_id);
create index idx_professionals_auth on professionals(auth_user_id);

create trigger trg_professionals_updated_at
  before update on professionals
  for each row execute function app.set_updated_at();

-- Pacientes -------------------------------------------------------------------
-- Login por Google (OAuth) ou CPF+senha. Em ambos os casos há um auth.users
-- correspondente; o CPF fica armazenado aqui (único) para login e identificação.
create table patients (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  nome            text not null,
  cpf             text unique,
  rg              text,
  nascimento      date,
  sexo            text,                 -- 'F' | 'M' | 'outro' | null
  email           citext,
  whatsapp        text,
  telefone        text,
  endereco        jsonb,
  profissao       text,
  estilo_trabalho text,                 -- 'sentado' | 'em_pe_ativo'
  -- Campos rápidos para pré-preenchimento de fichas e alertas clínicos:
  alergias        text,
  observacoes     text,
  foto_url        text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_patients_clinic on patients(clinic_id);
create index idx_patients_auth on patients(auth_user_id);
create index idx_patients_nome_trgm on patients using gin (nome gin_trgm_ops);

create trigger trg_patients_updated_at
  before update on patients
  for each row execute function app.set_updated_at();

comment on table clinics is 'Configuração única da clínica (white-label, dados da empresa).';
comment on table professionals is 'Equipe da clínica; dados de conselho usados nos documentos formais.';
comment on table patients is 'Pacientes; vinculados a auth.users (Google ou CPF+senha).';

-- ---------------------------------------------------------------------------
-- Funções de identidade para as políticas de RLS.
-- Criadas aqui (após as tabelas) porque funções SQL têm o corpo validado na
-- criação. SECURITY DEFINER para lerem professionals/patients sem recursão de
-- política; search_path fixo por segurança.
-- ---------------------------------------------------------------------------

-- É membro da equipe (qualquer papel) e está ativo?
create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from professionals p
    where p.auth_user_id = auth.uid() and p.ativo
  );
$$;

-- É administrador da clínica?
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from professionals p
    where p.auth_user_id = auth.uid() and p.ativo and p.role = 'admin'
  );
$$;

-- id do paciente correspondente ao usuário autenticado (ou null)
create or replace function app.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from patients where auth_user_id = auth.uid();
$$;

-- id do profissional correspondente ao usuário autenticado (ou null)
create or replace function app.current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from professionals where auth_user_id = auth.uid();
$$;

comment on function app.is_staff() is 'TRUE se o usuário autenticado é membro ativo da equipe.';
comment on function app.is_admin() is 'TRUE se o usuário autenticado é administrador.';
comment on function app.current_patient_id() is 'id do paciente vinculado ao auth.uid() atual.';
comment on function app.current_professional_id() is 'id do profissional vinculado ao auth.uid() atual.';
