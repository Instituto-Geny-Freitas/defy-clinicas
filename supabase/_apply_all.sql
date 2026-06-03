-- ARQUIVO COMBINADO — gerado automaticamente.
-- Ordem correta. 0016 usa pg_cron (habilite a extensão se necessário).


-- ======================================================================
-- ARQUIVO: supabase/migrations/0001_extensions_and_enums.sql
-- ======================================================================
-- =============================================================================
-- 0001_extensions_and_enums.sql
-- Extensões e tipos enumerados (domínios) do sistema.
-- Instância única (Instituto Geny Freitas) — multiprofissional.
-- =============================================================================

-- Extensões -------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- e-mail/CPF case-insensitive
create extension if not exists "pg_trgm";     -- busca por nome (LIKE/ILIKE)

-- Schema auxiliar para funções internas --------------------------------------
create schema if not exists app;

-- Tipos enumerados ------------------------------------------------------------

-- Papel do membro da equipe
do $$ begin
  create type user_role as enum ('admin', 'profissional', 'recepcao');
exception when duplicate_object then null; end $$;

-- Tipo de documento no motor de documentos dinâmicos
do $$ begin
  create type document_type as enum ('termo', 'orientacao', 'ficha');
exception when duplicate_object then null; end $$;

-- Status de uma instância de documento (termo/orientação)
do $$ begin
  create type document_status as enum ('rascunho', 'pendente', 'lido', 'assinado', 'cancelado');
exception when duplicate_object then null; end $$;

-- Tipo de ficha de avaliação
do $$ begin
  create type assessment_type as enum ('dermato', 'capilar', 'corporal');
exception when duplicate_object then null; end $$;

-- Quem preencheu o registro (paciente no portal ou profissional)
do $$ begin
  create type fill_source as enum ('paciente', 'profissional');
exception when duplicate_object then null; end $$;

-- Status de agendamento
do $$ begin
  create type appointment_status as enum ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');
exception when duplicate_object then null; end $$;

-- Status de orçamento
do $$ begin
  create type quote_status as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');
exception when duplicate_object then null; end $$;

-- Forma de pagamento (PIX priorizado)
do $$ begin
  create type payment_method as enum ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'outro');
exception when duplicate_object then null; end $$;

-- Status de pagamento
do $$ begin
  create type payment_status as enum ('pendente', 'pago', 'estornado', 'cancelado');
exception when duplicate_object then null; end $$;

-- Tipo de movimentação de estoque
do $$ begin
  create type stock_movement_type as enum ('entrada', 'saida_venda', 'saida_uso', 'ajuste', 'perda');
exception when duplicate_object then null; end $$;

-- Canal de notificação
do $$ begin
  create type notification_channel as enum ('push', 'whatsapp', 'email', 'in_app');
exception when duplicate_object then null; end $$;

-- Status de notificação
do $$ begin
  create type notification_status as enum ('pendente', 'enviado', 'lido', 'falhou', 'cancelado');
exception when duplicate_object then null; end $$;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0002_helpers_and_triggers.sql
-- ======================================================================
-- =============================================================================
-- 0002_helpers_and_triggers.sql
-- Gatilho genérico de updated_at. (As funções de identidade de RLS são criadas
-- em 0003, após as tabelas professionals/patients existirem — funções SQL têm
-- o corpo validado na criação.)
-- =============================================================================

-- Atualiza automaticamente a coluna updated_at em qualquer tabela ------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0003_clinic_and_users.sql
-- ======================================================================
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


-- ======================================================================
-- ARQUIVO: supabase/migrations/0004_documents.sql
-- ======================================================================
-- =============================================================================
-- 0004_documents.sql
-- Motor de documentos dinâmicos (CRUD de modelos): termos de consentimento e
-- orientações pós-procedimento. Cada modelo é versionado; cada instância é
-- vinculada a um paciente, lida/consentida/assinada (aceite interno com hash).
-- =============================================================================

-- Modelos de documentos (templates) ------------------------------------------
-- schema: definição dos campos dinâmicos do formulário (JSON Schema simplificado),
--         ex.: [{ "key":"procedimento", "label":"Procedimento", "type":"text", "required":true }]
-- corpo:  texto do documento com placeholders {{campo}} preenchidos na instância.
create table document_templates (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  tipo               document_type not null,        -- termo | orientacao | ficha
  nome               text not null,
  descricao          text,
  procedimento_rel   text,                           -- procedimento associado (ex.: 'toxina_botulinica')
  schema             jsonb not null default '[]'::jsonb,
  corpo              text not null default '',
  versao             integer not null default 1,
  parent_template_id uuid references document_templates(id) on delete set null, -- versão anterior
  -- Para orientações: sequência de lembretes automáticos pós-procedimento.
  -- ex.: [{ "offset_horas":0, "canal":"whatsapp" },
  --       { "repetir":"5x/dia", "por_dias":5, "mensagem":"Massagem 5 min em cada ponto" }]
  reminder_schedule  jsonb not null default '[]'::jsonb,
  requer_assinatura  boolean not null default true,
  ativo              boolean not null default true,
  created_by         uuid references professionals(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_doc_templates_clinic on document_templates(clinic_id);
create index idx_doc_templates_tipo on document_templates(tipo);

create trigger trg_doc_templates_updated_at
  before update on document_templates
  for each row execute function app.set_updated_at();

-- Instâncias de documento (por paciente) -------------------------------------
create table document_instances (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  template_id     uuid not null references document_templates(id) on delete restrict,
  template_versao integer not null,                 -- versão "congelada" no momento do uso
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid,                              -- FK lógica para procedures_log (0005)
  appointment_id  uuid,                              -- FK lógica para appointments (0006)
  dados           jsonb not null default '{}'::jsonb,  -- valores dos campos dinâmicos
  corpo_final     text,                              -- corpo renderizado (placeholders resolvidos)
  status          document_status not null default 'pendente',
  -- Aceite interno / trilha de consentimento (LGPD):
  enviado_em      timestamptz,
  lido_em         timestamptz,
  consentido_em   timestamptz,
  assinado_em     timestamptz,
  signed_ip       inet,
  signed_user_agent text,
  signature_image_url text,                          -- assinatura desenhada pelo paciente
  content_hash    text,                              -- hash SHA-256 do corpo_final + dados
  pdf_url         text,                              -- PDF gerado no Storage
  uso_imagem_autorizado boolean,                     -- consentimento de uso de imagem (Lei 13.709/2018)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_doc_instances_patient on document_instances(patient_id);
create index idx_doc_instances_template on document_instances(template_id);
create index idx_doc_instances_status on document_instances(status);

create trigger trg_doc_instances_updated_at
  before update on document_instances
  for each row execute function app.set_updated_at();

comment on table document_templates is 'Modelos versionados de termos e orientações (CRUD).';
comment on table document_instances is 'Documento emitido para um paciente, com trilha de consentimento/assinatura.';
comment on column document_instances.content_hash is 'Hash do conteúdo no momento da assinatura — integridade jurídica.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0005_clinical_records.sql
-- ======================================================================
-- =============================================================================
-- 0005_clinical_records.sql
-- Prontuário: anamnese, avaliações (dermato/capilar/corporal), perimetria,
-- medidas corporais evolutivas, procedimentos, planos de tratamento,
-- suplementação, fórmulas manipuladas e exames laboratoriais.
-- Campos clínicos detalhados ficam em JSONB (dados) para evoluir sem migração;
-- colunas "tipadas" existem onde há consulta/relatório/gráfico.
-- =============================================================================

-- Ficha de Anamnese Clínica e Estética ---------------------------------------
-- Pode ser preenchida pelo paciente (portal) ou pelo profissional.
create table anamnesis (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  preenchido_por  fill_source not null default 'profissional',
  dados           jsonb not null default '{}'::jsonb,  -- queixa, objetivos, histórico, hábitos...
  peso_kg         numeric(6,2),
  altura_m        numeric(4,2),
  imc             numeric(6,2),
  peso_meta_kg    numeric(6,2),
  consentimento_em timestamptz,
  data            date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_anamnesis_patient on anamnesis(patient_id);
create trigger trg_anamnesis_updated_at before update on anamnesis
  for each row execute function app.set_updated_at();

-- Fichas de avaliação (dermato funcional / capilar / corporal) ----------------
create table assessments (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  tipo            assessment_type not null,           -- dermato | capilar | corporal
  dados           jsonb not null default '{}'::jsonb,  -- escalas (Fitzpatrick, Glogau, graus...)
  fotos           jsonb not null default '[]'::jsonb,  -- urls de fotos clínicas (Storage)
  -- Planejamento terapêutico presente nas três fichas:
  tratamento_proposto text,
  recursos        jsonb not null default '[]'::jsonb,
  num_sessoes     integer,
  frequencia      text,
  valor_total     numeric(12,2),
  data            date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_assessments_patient on assessments(patient_id);
create index idx_assessments_tipo on assessments(tipo);
create trigger trg_assessments_updated_at before update on assessments
  for each row execute function app.set_updated_at();

-- Perimetria antropométrica (tabela evolutiva da ficha corporal) --------------
create table perimetry (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references assessments(id) on delete cascade,
  regiao          text not null,                       -- Busto, Cintura, Abdome, Quadril...
  medida_inicial_cm     numeric(6,2),
  medida_intermediaria_cm numeric(6,2),
  medida_final_cm       numeric(6,2),
  ordem           integer not null default 0
);
create index idx_perimetry_assessment on perimetry(assessment_id);

-- Medidas corporais por sessão (acompanhamento evolutivo) ---------------------
create table body_measurements (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  sessao          integer,
  data            date not null default current_date,
  peso_kg         numeric(6,2),
  imc             numeric(6,2),
  gordura_corporal_pct numeric(5,2),
  musculo_pct     numeric(5,2),
  rm              numeric(8,2),                         -- taxa metabólica de repouso
  kcal            numeric(8,2),
  idade_corporal  integer,
  gordura_visceral numeric(5,2),
  extras          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_body_meas_patient on body_measurements(patient_id);
create trigger trg_body_meas_updated_at before update on body_measurements
  for each row execute function app.set_updated_at();

-- Registro de procedimentos realizados ----------------------------------------
create table procedures_log (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  appointment_id  uuid,                                 -- FK lógica (0006)
  procedimento    text not null,
  data            timestamptz not null default now(),
  regiao          text,
  observacoes     text,
  produtos_usados jsonb not null default '[]'::jsonb,    -- [{ inventory_id, lote, qtd }]
  fotos           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_procedures_patient on procedures_log(patient_id);
create index idx_procedures_data on procedures_log(data);
create trigger trg_procedures_updated_at before update on procedures_log
  for each row execute function app.set_updated_at();

-- Plano de tratamento (texto livre + domínios de textos padrão / IA) ----------
create table treatment_plans (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  titulo          text,
  texto           text,
  recursos        jsonb not null default '[]'::jsonb,
  num_sessoes     integer,
  frequencia      text,
  valor_total     numeric(12,2),
  origem_ia       boolean not null default false,        -- conteúdo sugerido por IA?
  data            date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_treatment_plans_patient on treatment_plans(patient_id);
create trigger trg_treatment_plans_updated_at before update on treatment_plans
  for each row execute function app.set_updated_at();

-- Biblioteca de textos padrão para o plano de tratamento ----------------------
create table treatment_text_snippets (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  categoria       text,
  titulo          text not null,
  conteudo        text not null,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Suplementação prescrita -----------------------------------------------------
create table supplementations (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  medicacao       text not null,
  via_adm         text,                                  -- via de administração / local
  validade        date,
  lote            text,
  data            date not null default current_date,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_supplementations_patient on supplementations(patient_id);
create trigger trg_supplementations_updated_at before update on supplementations
  for each row execute function app.set_updated_at();

-- Fórmulas manipuladas: biblioteca reutilizável + prescrição ------------------
create table formulations (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  nome            text not null,
  composicao      jsonb not null default '[]'::jsonb,    -- [{ ativo, quantidade, unidade }]
  posologia       text,
  forma           text,                                  -- cápsula, solução, bombom, flaconete...
  is_biblioteca   boolean not null default true,         -- modelo reutilizável?
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_formulations_updated_at before update on formulations
  for each row execute function app.set_updated_at();

-- Prescrição de fórmula para um paciente
create table formulation_prescriptions (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  formulation_id  uuid references formulations(id) on delete set null,
  composicao      jsonb not null default '[]'::jsonb,    -- snapshot no momento da prescrição
  posologia       text,
  pdf_url         text,
  data            date not null default current_date,
  created_at      timestamptz not null default now()
);
create index idx_form_presc_patient on formulation_prescriptions(patient_id);

-- Exames laboratoriais: requisição + resultado --------------------------------
create table lab_orders (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  exames          jsonb not null default '[]'::jsonb,    -- ['Vitamina D','TSH',...]
  observacoes     text,
  data            date not null default current_date,
  created_at      timestamptz not null default now()
);
create index idx_lab_orders_patient on lab_orders(patient_id);

create table lab_results (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references lab_orders(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  arquivo_url     text,                                  -- upload pelo paciente (Storage)
  valores         jsonb not null default '{}'::jsonb,    -- { exame: { valor, unidade, ref } }
  data_coleta     date,
  created_at      timestamptz not null default now()
);
create index idx_lab_results_patient on lab_results(patient_id);

comment on table anamnesis is 'Ficha de anamnese; preenchível pelo paciente ou profissional.';
comment on table assessments is 'Fichas dermato/capilar/corporal com escalas padronizadas.';
comment on table body_measurements is 'Medidas por sessão para gráficos de evolução.';
comment on table formulations is 'Biblioteca de fórmulas + base para prescrição.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0006_scheduling.sql
-- ======================================================================
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


-- ======================================================================
-- ARQUIVO: supabase/migrations/0007_inventory.sql
-- ======================================================================
-- =============================================================================
-- 0007_inventory.sql
-- Controle de estoque estético com lote, validade, custo, venda, margem.
-- Movimentações registram entradas/saídas; saldo derivado das movimentações
-- e refletido em inventory.qtd_atual para consulta rápida.
-- =============================================================================

create table inventory (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  produto         text not null,
  marca           text,
  lote            text,
  validade        date,
  custo_unit      numeric(12,2) not null default 0,
  preco_venda     numeric(12,2) not null default 0,
  qtd_atual       numeric(12,2) not null default 0,
  qtd_minima      numeric(12,2) not null default 0,        -- gatilho de alerta de estoque mínimo
  unidade         text default 'un',
  categoria       text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_inventory_clinic on inventory(clinic_id);
create index idx_inventory_validade on inventory(validade);
create index idx_inventory_produto_trgm on inventory using gin (produto gin_trgm_ops);

create trigger trg_inventory_updated_at
  before update on inventory
  for each row execute function app.set_updated_at();

-- Coluna gerada: margem unitária (preço de venda - custo)
alter table inventory
  add column margem_unit numeric(12,2)
  generated always as (preco_venda - custo_unit) stored;

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  inventory_id    uuid not null references inventory(id) on delete cascade,
  tipo            stock_movement_type not null,
  quantidade      numeric(12,2) not null,
  custo_unit      numeric(12,2),
  preco_venda     numeric(12,2),
  procedure_id    uuid references procedures_log(id) on delete set null,  -- baixa por uso
  patient_id      uuid references patients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  motivo          text,
  data            timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_stock_mov_inventory on stock_movements(inventory_id);
create index idx_stock_mov_data on stock_movements(data);

-- Atualiza qtd_atual do inventário a cada movimentação ------------------------
create or replace function app.apply_stock_movement()
returns trigger
language plpgsql
as $$
declare
  delta numeric(12,2);
begin
  if (tg_op = 'INSERT') then
    delta := case
      when new.tipo = 'entrada' then new.quantidade
      when new.tipo = 'ajuste'  then new.quantidade          -- pode ser negativo
      else -abs(new.quantidade)                               -- saída_venda, saída_uso, perda
    end;
    update inventory set qtd_atual = qtd_atual + delta where id = new.inventory_id;
  end if;
  return new;
end;
$$;

create trigger trg_apply_stock_movement
  after insert on stock_movements
  for each row execute function app.apply_stock_movement();

comment on table inventory is 'Estoque com lote/validade/custo/venda; qtd_minima dispara alerta.';
comment on table stock_movements is 'Movimentações; baixa automática por procedimento/venda.';
comment on column inventory.margem_unit is 'Margem unitária calculada (preco_venda - custo_unit).';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0008_finance.sql
-- ======================================================================
-- =============================================================================
-- 0008_finance.sql
-- Orçamentos e pagamentos. PIX priorizado (integração com gateway via webhook).
-- Saldo a receber derivado de quotes.valor_total - soma de pagamentos pagos.
-- =============================================================================

create table quotes (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  numero          text,                                    -- numeração amigável (ex.: ORC-2026-001)
  itens           jsonb not null default '[]'::jsonb,      -- [{ descricao, qtd, valor_unit, total }]
  valor_bruto     numeric(12,2) not null default 0,
  desconto        numeric(12,2) not null default 0,
  valor_total     numeric(12,2) not null default 0,
  status          quote_status not null default 'rascunho',
  validade        date,
  observacoes     text,
  aprovado_em     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_quotes_patient on quotes(patient_id);
create index idx_quotes_status on quotes(status);

create trigger trg_quotes_updated_at
  before update on quotes
  for each row execute function app.set_updated_at();

create table payments (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  patient_id      uuid not null references patients(id) on delete cascade,
  valor           numeric(12,2) not null,
  metodo          payment_method not null default 'pix',
  status          payment_status not null default 'pendente',
  parcela         integer not null default 1,
  total_parcelas  integer not null default 1,
  vencimento      date,
  pago_em         timestamptz,
  -- Integração com gateway (ex.: Asaas/Mercado Pago/Pagar.me):
  gateway         text,
  gateway_ref     text,                                    -- id da cobrança no gateway
  pix_qrcode      text,
  pix_copia_cola  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_payments_quote on payments(quote_id);
create index idx_payments_patient on payments(patient_id);
create index idx_payments_status on payments(status);
create index idx_payments_gateway_ref on payments(gateway_ref);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function app.set_updated_at();

-- Visão de saldo por orçamento (valor_total - pagamentos confirmados) ---------
create or replace view v_quote_balances as
select
  q.id                                   as quote_id,
  q.patient_id,
  q.valor_total,
  coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)        as total_pago,
  q.valor_total
    - coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)    as saldo_a_receber
from quotes q
left join payments p on p.quote_id = q.id
group by q.id;

comment on table quotes is 'Orçamentos de tratamento; itens em JSONB.';
comment on table payments is 'Pagamentos/parcelas; suporte a PIX via gateway (webhook confirma).';
comment on view v_quote_balances is 'Saldo a receber por orçamento.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0009_notifications.sql
-- ======================================================================
-- =============================================================================
-- 0009_notifications.sql
-- Fila de notificações (push/WhatsApp/email/in-app) e consentimento de leitura
-- das orientações pelo paciente. Alimentada por gatilhos e por jobs pg_cron.
-- =============================================================================

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  tipo            text not null,                       -- 'lembrete_consulta','pos_procedimento','estoque',...
  canal           notification_channel not null default 'in_app',
  titulo          text,
  payload         jsonb not null default '{}'::jsonb,
  agendado_para   timestamptz not null default now(),  -- quando deve ser disparada
  status          notification_status not null default 'pendente',
  enviado_em      timestamptz,
  lido_em         timestamptz,
  erro            text,
  -- Referências de origem (opcionais):
  appointment_id  uuid references appointments(id) on delete set null,
  document_instance_id uuid references document_instances(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_notifications_patient on notifications(patient_id);
create index idx_notifications_status on notifications(status);
create index idx_notifications_agendado on notifications(agendado_para) where status = 'pendente';

create trigger trg_notifications_updated_at
  before update on notifications
  for each row execute function app.set_updated_at();

-- Consentimento/leitura de orientações pelo paciente --------------------------
-- Liga uma orientação (document_template tipo='orientacao') a um paciente,
-- registrando indicação para leitura, leitura e consentimento.
create table patient_guidance (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  template_id     uuid not null references document_templates(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid references procedures_log(id) on delete set null,
  indicado_em     timestamptz not null default now(),
  lido_em         timestamptz,
  consentido_em   timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_patient_guidance_patient on patient_guidance(patient_id);

-- Tokens de push (PWA / Web Push) por usuário ---------------------------------
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null,
  keys            jsonb not null,                      -- { p256dh, auth }
  user_agent      text,
  created_at      timestamptz not null default now(),
  unique (auth_user_id, endpoint)
);

comment on table notifications is 'Fila de notificações; agendado_para + pg_cron disparam o envio.';
comment on table patient_guidance is 'Orientações indicadas ao paciente com trilha de leitura/consentimento.';
comment on table push_subscriptions is 'Assinaturas Web Push do PWA por usuário.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0010_rls_policies.sql
-- ======================================================================
-- =============================================================================
-- 0010_rls_policies.sql
-- Row Level Security. Regra geral:
--   • Equipe (app.is_staff()) acessa tudo da clínica.
--   • Paciente acessa/edita apenas as próprias linhas.
-- Políticas são combinadas por OR; várias políticas SELECT ampliam o acesso.
-- =============================================================================

-- Habilita RLS em todas as tabelas -------------------------------------------
alter table clinics                  enable row level security;
alter table professionals            enable row level security;
alter table patients                 enable row level security;
alter table document_templates       enable row level security;
alter table document_instances       enable row level security;
alter table anamnesis                enable row level security;
alter table assessments              enable row level security;
alter table perimetry                enable row level security;
alter table body_measurements        enable row level security;
alter table procedures_log           enable row level security;
alter table treatment_plans          enable row level security;
alter table treatment_text_snippets  enable row level security;
alter table supplementations         enable row level security;
alter table formulations             enable row level security;
alter table formulation_prescriptions enable row level security;
alter table lab_orders               enable row level security;
alter table lab_results              enable row level security;
alter table appointments             enable row level security;
alter table inventory                enable row level security;
alter table stock_movements          enable row level security;
alter table quotes                   enable row level security;
alter table payments                 enable row level security;
alter table notifications            enable row level security;
alter table patient_guidance         enable row level security;
alter table push_subscriptions       enable row level security;

-- CLÍNICA ---------------------------------------------------------------------
-- Dados de marca/contato são lidos por qualquer autenticado (portal precisa do
-- logo, cores e dados da empresa). Só admin altera.
create policy clinics_select on clinics for select to authenticated using (true);
create policy clinics_admin  on clinics for all   to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- PROFISSIONAIS ---------------------------------------------------------------
-- Equipe e pacientes podem ler (nome/conselho aparecem em documentos).
create policy professionals_select on professionals for select to authenticated using (true);
-- Admin gerencia toda a equipe.
create policy professionals_admin on professionals for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- Profissional pode atualizar o próprio cadastro.
create policy professionals_self_update on professionals for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- PACIENTES -------------------------------------------------------------------
create policy patients_staff on patients for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy patients_self_select on patients for select to authenticated
  using (auth_user_id = auth.uid());
create policy patients_self_update on patients for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- MODELOS DE DOCUMENTO --------------------------------------------------------
create policy doc_templates_staff on document_templates for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
-- Paciente lê modelos ativos (orientações/termos a consentir).
create policy doc_templates_patient_read on document_templates for select to authenticated
  using (ativo);

-- INSTÂNCIAS DE DOCUMENTO -----------------------------------------------------
create policy doc_instances_staff on document_instances for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy doc_instances_patient_read on document_instances for select to authenticated
  using (patient_id = app.current_patient_id());
-- Paciente assina/consente o próprio documento (update das colunas de aceite).
create policy doc_instances_patient_sign on document_instances for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- Macro auxiliar: política padrão "staff tudo + paciente lê o próprio" --------
-- (escrita manualmente por tabela abaixo, pois SQL não tem template de policy)

-- ANAMNESE (paciente pode preencher) -----------------------------------------
create policy anamnesis_staff on anamnesis for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy anamnesis_patient_read on anamnesis for select to authenticated
  using (patient_id = app.current_patient_id());
create policy anamnesis_patient_insert on anamnesis for insert to authenticated
  with check (patient_id = app.current_patient_id());
create policy anamnesis_patient_update on anamnesis for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- AVALIAÇÕES (somente leitura para paciente) ---------------------------------
create policy assessments_staff on assessments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy assessments_patient_read on assessments for select to authenticated
  using (patient_id = app.current_patient_id());

-- PERIMETRIA (ownership via assessment) --------------------------------------
create policy perimetry_staff on perimetry for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy perimetry_patient_read on perimetry for select to authenticated
  using (exists (
    select 1 from assessments a
    where a.id = perimetry.assessment_id
      and a.patient_id = app.current_patient_id()
  ));

-- MEDIDAS CORPORAIS -----------------------------------------------------------
create policy body_meas_staff on body_measurements for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy body_meas_patient_read on body_measurements for select to authenticated
  using (patient_id = app.current_patient_id());

-- PROCEDIMENTOS ---------------------------------------------------------------
create policy procedures_staff on procedures_log for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy procedures_patient_read on procedures_log for select to authenticated
  using (patient_id = app.current_patient_id());

-- PLANO DE TRATAMENTO ---------------------------------------------------------
create policy plans_staff on treatment_plans for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy plans_patient_read on treatment_plans for select to authenticated
  using (patient_id = app.current_patient_id());

-- TEXTOS PADRÃO (somente equipe) ---------------------------------------------
create policy snippets_staff on treatment_text_snippets for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- SUPLEMENTAÇÃO ---------------------------------------------------------------
create policy suppl_staff on supplementations for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy suppl_patient_read on supplementations for select to authenticated
  using (patient_id = app.current_patient_id());

-- FÓRMULAS (biblioteca: somente equipe) --------------------------------------
create policy formulations_staff on formulations for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- PRESCRIÇÕES DE FÓRMULA ------------------------------------------------------
create policy form_presc_staff on formulation_prescriptions for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy form_presc_patient_read on formulation_prescriptions for select to authenticated
  using (patient_id = app.current_patient_id());

-- EXAMES: REQUISIÇÕES ---------------------------------------------------------
create policy lab_orders_staff on lab_orders for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy lab_orders_patient_read on lab_orders for select to authenticated
  using (patient_id = app.current_patient_id());

-- EXAMES: RESULTADOS (paciente pode enviar o próprio) ------------------------
create policy lab_results_staff on lab_results for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy lab_results_patient_read on lab_results for select to authenticated
  using (patient_id = app.current_patient_id());
create policy lab_results_patient_insert on lab_results for insert to authenticated
  with check (patient_id = app.current_patient_id());

-- AGENDAMENTOS (paciente solicita/confirma/cancela o próprio) -----------------
create policy appts_staff on appointments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy appts_patient_read on appointments for select to authenticated
  using (patient_id = app.current_patient_id());
create policy appts_patient_insert on appointments for insert to authenticated
  with check (patient_id = app.current_patient_id());
create policy appts_patient_update on appointments for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- ESTOQUE (somente equipe) ----------------------------------------------------
create policy inventory_staff on inventory for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy stock_mov_staff on stock_movements for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- FINANCEIRO ------------------------------------------------------------------
create policy quotes_staff on quotes for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy quotes_patient_read on quotes for select to authenticated
  using (patient_id = app.current_patient_id());

create policy payments_staff on payments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy payments_patient_read on payments for select to authenticated
  using (patient_id = app.current_patient_id());

-- NOTIFICAÇÕES (paciente lê e marca como lida) -------------------------------
create policy notif_staff on notifications for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy notif_patient_read on notifications for select to authenticated
  using (patient_id = app.current_patient_id());
create policy notif_patient_update on notifications for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- ORIENTAÇÕES INDICADAS (paciente lê/consente) -------------------------------
create policy guidance_staff on patient_guidance for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy guidance_patient_read on patient_guidance for select to authenticated
  using (patient_id = app.current_patient_id());
create policy guidance_patient_update on patient_guidance for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- PUSH SUBSCRIPTIONS (dono) ---------------------------------------------------
create policy push_owner on push_subscriptions for all to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());


-- ======================================================================
-- ARQUIVO: supabase/migrations/0011_storage_buckets.sql
-- ======================================================================
-- =============================================================================
-- 0011_storage_buckets.sql
-- Buckets de Storage e políticas de acesso.
--   • branding  : público (logo da clínica, exibido no portal/PDF).
--   • patient-files : privado (fotos clínicas, PDFs assinados, exames).
-- Estrutura de pasta sugerida em patient-files: <patient_id>/<categoria>/<arquivo>
-- assim a 1ª pasta do path identifica o dono.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- BRANDING: leitura pública; escrita só admin -------------------------------
create policy branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

create policy branding_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'branding' and app.is_admin())
  with check (bucket_id = 'branding' and app.is_admin());

-- PATIENT-FILES: equipe acessa tudo; paciente acessa sua própria pasta -------
-- A pasta raiz do objeto deve ser o patient_id (texto).
create policy patient_files_staff on storage.objects for all to authenticated
  using (bucket_id = 'patient-files' and app.is_staff())
  with check (bucket_id = 'patient-files' and app.is_staff());

create policy patient_files_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text
  );

create policy patient_files_owner_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text
  );


-- ======================================================================
-- ARQUIVO: supabase/migrations/0012_integrations_and_photos.sql
-- ======================================================================
-- =============================================================================
-- 0012_integrations_and_photos.sql
-- (1) Configuração "plugável" de integrações (gateway de pagamento, WhatsApp...)
--     definida na área de Configurações pelo admin. NÃO guarda segredos.
-- (2) Fotos clínicas de evolução (antes/depois) — já no MVP.
-- =============================================================================

-- (1) Integrações configuráveis ----------------------------------------------
-- Apenas dados NÃO sensíveis (qual provedor está ativo, modo, chave pública,
-- chave PIX, URL de webhook). As CHAVES SECRETAS ficam em segredos da Edge
-- Function / Supabase Vault — nunca aqui (esta tabela é lida pelo app).
do $$ begin
  create type integration_category as enum ('pagamento', 'whatsapp', 'email');
exception when duplicate_object then null; end $$;

create table integration_settings (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  categoria       integration_category not null,
  provider        text,                  -- 'asaas' | 'mercadopago' | 'pagarme' | 'wa_cloud' | ...
  modo            text not null default 'sandbox',   -- 'sandbox' | 'producao'
  config_publica  jsonb not null default '{}'::jsonb, -- { chave_publica, chave_pix, webhook_url, ... }
  ativo           boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinic_id, categoria)          -- uma config ativa por categoria
);

create trigger trg_integration_settings_updated_at
  before update on integration_settings
  for each row execute function app.set_updated_at();

comment on table integration_settings is
  'Configuração plugável de integrações (gateway PIX, WhatsApp). Sem segredos — chaves secretas vão para Vault/Edge secrets.';
comment on column integration_settings.config_publica is
  'Somente dados não sensíveis (chave pública, chave PIX, URL de webhook).';

-- (2) Fotos clínicas de evolução ---------------------------------------------
-- Arquivos no bucket privado patient-files, sob a pasta <patient_id>/...
-- grupo_id agrupa um conjunto comparativo (ex.: par antes/depois da mesma região).
do $$ begin
  create type photo_categoria as enum ('antes', 'depois', 'evolucao', 'outro');
exception when duplicate_object then null; end $$;

create table clinical_photos (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  procedure_id    uuid references procedures_log(id) on delete set null,
  assessment_id   uuid references assessments(id) on delete set null,
  categoria       photo_categoria not null default 'evolucao',
  regiao          text,
  grupo_id        uuid,                  -- agrupa antes/depois comparáveis
  sessao          integer,
  arquivo_url     text not null,         -- caminho no Storage (patient-files)
  thumb_url       text,
  observacoes     text,
  visivel_paciente boolean not null default true,  -- exibir no portal do paciente?
  capturada_em    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index idx_clinical_photos_patient on clinical_photos(patient_id);
create index idx_clinical_photos_grupo on clinical_photos(grupo_id);
create index idx_clinical_photos_procedure on clinical_photos(procedure_id);

comment on table clinical_photos is 'Fotos clínicas (antes/depois/evolução); arquivos no bucket privado patient-files.';

-- RLS -------------------------------------------------------------------------
alter table integration_settings enable row level security;
alter table clinical_photos       enable row level security;

-- Integrações: somente admin (contém configuração operacional sensível).
create policy integration_settings_admin on integration_settings for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Fotos: equipe gerencia tudo; paciente vê as próprias marcadas como visíveis.
create policy clinical_photos_staff on clinical_photos for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy clinical_photos_patient_read on clinical_photos for select to authenticated
  using (patient_id = app.current_patient_id() and visivel_paciente);


-- ======================================================================
-- ARQUIVO: supabase/migrations/0013_onboarding_link_user.sql
-- ======================================================================
-- =============================================================================
-- 0013_onboarding_link_user.sql
-- Onboarding automático: quando um usuário é criado no Supabase Auth, vincula-o
-- ao registro existente de profissional ou paciente.
--
-- Regras de vínculo (na ordem):
--   1) professional com mesmo e-mail e ainda sem auth_user_id;
--   2) patient com mesmo e-mail e ainda sem auth_user_id;
--   3) patient por CPF — no login por CPF o e-mail é sintético "<cpf>@<dominio>".
--
-- Só vincula registros AINDA NÃO vinculados (auth_user_id IS NULL), evitando
-- "sequestro" de cadastros já associados a outra conta. Sem correspondência,
-- o usuário fica "não vinculado" e o app orienta procurar a recepção.
--
-- IMPORTANTE: o domínio do e-mail sintético DEVE corresponder ao
-- VITE_CPF_EMAIL_DOMAIN do frontend (padrão: geny.local).
-- =============================================================================

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf_domain text := 'geny.local';
  v_cpf text;
begin
  -- 1) Profissional por e-mail
  update professionals
     set auth_user_id = new.id
   where auth_user_id is null
     and email is not null
     and email = new.email;
  if found then
    return new;
  end if;

  -- 2) Paciente por e-mail
  update patients
     set auth_user_id = new.id
   where auth_user_id is null
     and email is not null
     and email = new.email;
  if found then
    return new;
  end if;

  -- 3) Paciente por CPF (login por CPF -> e-mail sintético)
  if new.email like ('%@' || v_cpf_domain) then
    v_cpf := split_part(new.email, '@', 1);
    update patients
       set auth_user_id = new.id
     where auth_user_id is null
       and cpf = v_cpf;
  end if;

  return new;
end;
$$;

comment on function app.handle_new_user() is
  'Vincula um novo usuário do Auth ao profissional/paciente existente (por e-mail ou CPF).';

-- Dispara após a criação do usuário no Auth.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();


-- ======================================================================
-- ARQUIVO: supabase/migrations/0014_secure_balance_view.sql
-- ======================================================================
-- =============================================================================
-- 0014_secure_balance_view.sql
-- Correção de segurança: recria v_quote_balances com security_invoker.
--
-- Por padrão, uma view no Postgres executa com as permissões do DONO (postgres),
-- o que IGNORA o RLS das tabelas subjacentes. Como a view é exposta pela API
-- (PostgREST), qualquer autenticado poderia ler os saldos de TODOS os pacientes.
-- Com security_invoker = true, a view respeita o RLS do usuário que consulta:
-- paciente vê só os próprios saldos; equipe vê todos.
-- =============================================================================

drop view if exists v_quote_balances;

create view v_quote_balances
with (security_invoker = true) as
select
  q.id                                   as quote_id,
  q.patient_id,
  q.valor_total,
  coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)        as total_pago,
  q.valor_total
    - coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)    as saldo_a_receber
from quotes q
left join payments p on p.quote_id = q.id
group by q.id;

comment on view v_quote_balances is
  'Saldo a receber por orçamento. security_invoker: respeita o RLS do consultante.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0015_automation_triggers.sql
-- ======================================================================
-- =============================================================================
-- 0015_automation_triggers.sql
-- Automação no nível do banco: ao EMITIR uma orientação para o paciente
-- (document_instances de um template tipo 'orientacao'), o sistema:
--   1) registra a indicação de leitura (patient_guidance);
--   2) enfileira notificações conforme a reminder_schedule do modelo.
-- As notificações entram com canal 'in_app' (exibidas no portal). O envio por
-- WhatsApp/push é feito depois por uma Edge Function que lê a fila.
-- =============================================================================

create or replace function app.on_document_issued()
returns trigger
language plpgsql
as $$
declare
  v_tipo  document_type;
  v_sched jsonb;
  item    jsonb;
  v_dias  int;
  d       int;
begin
  select tipo, reminder_schedule into v_tipo, v_sched
  from document_templates
  where id = new.template_id;

  -- Só orientações disparam a sequência de cuidados.
  if v_tipo is distinct from 'orientacao' then
    return new;
  end if;

  -- Indicação de leitura/consentimento.
  insert into patient_guidance (clinic_id, patient_id, template_id, professional_id, procedure_id, indicado_em)
  values (new.clinic_id, new.patient_id, new.template_id, new.professional_id, new.procedure_id, now());

  -- Enfileira notificações conforme a programação do modelo.
  for item in select * from jsonb_array_elements(coalesce(v_sched, '[]'::jsonb))
  loop
    if item ? 'repetir' then
      -- Ex.: { "repetir":"5x/dia", "por_dias":5, "mensagem":"..." }
      -- Simplificação: 1 lembrete/dia por 'por_dias' dias (a Edge Function
      -- pode expandir para várias vezes ao dia ao enviar).
      v_dias := coalesce((item->>'por_dias')::int, 1);
      for d in 0 .. (v_dias - 1) loop
        insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
        values (new.clinic_id, new.patient_id, 'pos_procedimento', 'in_app',
                'Cuidados pós-procedimento',
                jsonb_build_object('mensagem', item->>'mensagem', 'repetir', item->>'repetir'),
                now() + make_interval(days => d),
                new.id);
      end loop;
    else
      -- Ex.: { "offset_horas":0, "mensagem":"..." }
      insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
      values (new.clinic_id, new.patient_id, 'pos_procedimento', 'in_app',
              'Cuidados pós-procedimento',
              jsonb_build_object('mensagem', item->>'mensagem'),
              now() + make_interval(hours => coalesce((item->>'offset_horas')::int, 0)),
              new.id);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_document_issued on document_instances;
create trigger on_document_issued
  after insert on document_instances
  for each row execute function app.on_document_issued();

comment on function app.on_document_issued() is
  'Ao emitir uma orientação, registra patient_guidance e enfileira notificações da reminder_schedule.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0016_appointment_reminders_cron.sql
-- ======================================================================
-- =============================================================================
-- 0016_appointment_reminders_cron.sql
-- Lembretes automáticos de consulta. Uma função enfileira notificações para
-- agendamentos nas próximas 24h ainda sem lembrete; o pg_cron a executa
-- periodicamente.
--
-- OBS: requer a extensão pg_cron. No Supabase, habilite em
-- Database → Extensions → pg_cron (ou rode o create extension abaixo). Se o
-- create extension falhar por permissão, habilite pela UI e rode só o trecho
-- do cron.schedule.
-- =============================================================================

-- Enfileira lembretes para consultas nas próximas 24h --------------------------
create or replace function app.enqueue_appointment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, appointment_id)
  select a.clinic_id, a.patient_id, 'lembrete_consulta', 'in_app',
         'Lembrete de consulta',
         jsonb_build_object('inicio', a.inicio, 'procedimento', a.procedimento),
         now(), a.id
  from appointments a
  where a.status in ('agendado', 'confirmado')
    and a.lembrete_enviado_em is null
    and a.inicio between now() and now() + interval '24 hours';

  update appointments
     set lembrete_enviado_em = now()
   where status in ('agendado', 'confirmado')
     and lembrete_enviado_em is null
     and inicio between now() and now() + interval '24 hours';
end;
$$;

comment on function app.enqueue_appointment_reminders() is
  'Enfileira lembretes (notifications) para consultas nas próximas 24h sem lembrete.';

-- Agendamento periódico (a cada 15 min) ---------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('lembretes-consulta');
exception when others then
  null; -- ainda não existia
end $$;

select cron.schedule(
  'lembretes-consulta',
  '*/15 * * * *',
  $$ select app.enqueue_appointment_reminders(); $$
);


-- ======================================================================
-- ARQUIVO: supabase/migrations/0017_patient_lgpd_consent.sql
-- ======================================================================
-- =============================================================================
-- 0017_patient_lgpd_consent.sql
-- Consentimento LGPD por paciente: registra quando e qual versão do termo de
-- tratamento de dados foi aceita. O texto/versão vigente da clínica fica em
-- clinics.dados_empresa->'lgpd' (gerenciado em Configurações → LGPD).
-- =============================================================================

alter table patients
  add column if not exists consentimento_lgpd_em      timestamptz,
  add column if not exists consentimento_lgpd_versao   text;

comment on column patients.consentimento_lgpd_em is
  'Data/hora do consentimento LGPD do paciente (tratamento de dados).';
comment on column patients.consentimento_lgpd_versao is
  'Versão do termo de tratamento de dados aceita pelo paciente.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0018_procedure_quote_link.sql
-- ======================================================================
-- =============================================================================
-- 0018_procedure_quote_link.sql
-- Vincula o procedimento ao orçamento (quote) ao qual pertence. Assim os
-- produtos utilizados no procedimento (procedures_log.produtos_usados) podem ser
-- listados dentro do orçamento — visíveis ao paciente e ao profissional —
-- mantendo a integridade entre estoque, atendimento e financeiro.
-- =============================================================================

alter table procedures_log
  add column if not exists quote_id uuid references quotes(id) on delete set null;

create index if not exists idx_procedures_quote on procedures_log(quote_id);

comment on column procedures_log.quote_id is
  'Orçamento ao qual este procedimento (e seus produtos utilizados) está vinculado.';


-- ======================================================================
-- ARQUIVO: supabase/seed.sql
-- ======================================================================
-- =============================================================================
-- seed.sql — dados iniciais do Instituto Geny Freitas.
-- Idempotente (on conflict do nothing). UUIDs fixos para reprodutibilidade.
-- =============================================================================

-- Clínica (instância única) ---------------------------------------------------
insert into clinics (id, nome, razao_social, responsavel_tecnico, telefone, whatsapp, tema_cores, dados_empresa)
values (
  '00000000-0000-0000-0000-0000000c1111',
  'Instituto Geny Freitas',
  'Instituto Geny Freitas',
  'Maria Geny de Freitas',
  '11995744524',
  '11995744524',
  '{"primaria":"#0f766e","secundaria":"#e11d48","fundo":"#f8fafc","texto":"#0f172a"}'::jsonb,
  '{"cidade":"São Paulo","uf":"SP","rodape_pdf":"Instituto Geny Freitas — São Paulo/SP"}'::jsonb
)
on conflict (id) do nothing;

-- Profissional responsável (vincular auth_user_id no 1º login) -----------------
insert into professionals (id, clinic_id, nome, telefone, role, ativo)
values (
  '00000000-0000-0000-0000-0000000a0001',
  '00000000-0000-0000-0000-0000000c1111',
  'Maria Geny de Freitas',
  '11995744524',
  'admin',
  true
)
on conflict (id) do nothing;

-- TERMO geral de autorização (procedimentos faciais) --------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, schema, corpo)
values (
  '00000000-0000-0000-0000-0000000d0001',
  '00000000-0000-0000-0000-0000000c1111',
  'termo',
  'Termo de Autorização e Orientações para Procedimento',
  'geral_facial',
  true,
  '[
    {"key":"procedimento_sessao","label":"Procedimento desta sessão","type":"text","required":true},
    {"key":"valor","label":"Valor dos serviços (R$)","type":"number","required":false},
    {"key":"uso_imagem","label":"Autoriza uso de imagem (redes sociais, sem identidade)","type":"boolean","required":true}
  ]'::jsonb,
  'O(s) procedimento(s) realizados na Clínica Instituto Geny Freitas como: aplicação de Toxina Botulínica do tipo A, Preenchedores faciais com Ácido Hialurônico, Skinbooster, fios de PDO, microagulhamento, peeling químico, Bioestimulador de Colágeno, intradermoterapia, Laser e procedimentos de estética básica em geral, foram a mim esclarecidos pelo profissional abaixo referido. O procedimento a ser realizado nesta sessão será {{procedimento_sessao}}. Declaro estar ciente dos efeitos adversos possíveis (vermelhidão, marcas, edema, hematomas, inflamação, cefaléia, sensibilidade, prurido, descamação, alergias, entre outros descritos em bula). Pelos serviços contratados, o(a) paciente pagará o valor total de R$ {{valor}}.'
)
on conflict (id) do nothing;

-- TERMO específico de Criolipólise --------------------------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, schema, corpo)
values (
  '00000000-0000-0000-0000-0000000d0002',
  '00000000-0000-0000-0000-0000000c1111',
  'termo',
  'Termo de Autorização e Orientações — Criolipólise',
  'criolipolise',
  true,
  '[
    {"key":"valor","label":"Valor dos serviços (R$)","type":"number","required":false},
    {"key":"uso_imagem","label":"Autoriza uso de imagem (redes sociais, sem identidade)","type":"boolean","required":true}
  ]'::jsonb,
  'A criolipólise é um tratamento não invasivo que utiliza resfriamento de áreas do corpo para reduzir células de gordura. CONTRA-INDICAÇÕES: gestantes, infecções ou feridas na área, sensibilidade/alergia ao resfriamento, herniações ou cirurgia recente no local e doenças autoimunes. Estou ciente dos riscos (vermelhidão, pontos roxos, áreas endurecidas, e raramente hiperplasia paradoxal e risco de queimadura). Pelos serviços contratados pagarei R$ {{valor}}.'
)
on conflict (id) do nothing;

-- ORIENTAÇÃO pós Toxina Botulínica --------------------------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, reminder_schedule, corpo)
values (
  '00000000-0000-0000-0000-0000000d0003',
  '00000000-0000-0000-0000-0000000c1111',
  'orientacao',
  'Cuidados pós Toxina Botulínica',
  'toxina_botulinica',
  false,
  '[
    {"offset_horas":0,"canal":"whatsapp","mensagem":"Cuidados pós toxina: nas primeiras 4-6h não baixe a cabeça, não faça força/peso, evite calor e massagens locais."},
    {"offset_horas":240,"canal":"whatsapp","mensagem":"Lembrete: revisão da toxina em consulta em até 10 dias."}
  ]'::jsonb,
  'Cuidados nas primeiras 4 a 6 horas: não baixar a cabeça; não fazer força nem pegar peso; academia só após 24h; evitar banho quente, calor, avião e massagens locais nas primeiras 24h; não coçar o local. Liberado protetor solar e cosmético. O efeito aparece entre 2-5 dias. Revisão em até 10 dias em consulta.'
)
on conflict (id) do nothing;

-- ORIENTAÇÃO pós Bioestimulador (com lembretes de massagem 5x/dia por 5 dias) --
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, reminder_schedule, corpo)
values (
  '00000000-0000-0000-0000-0000000d0004',
  '00000000-0000-0000-0000-0000000c1111',
  'orientacao',
  'Cuidados pós Bioestimulador de Colágeno',
  'bioestimulador',
  false,
  '[
    {"repetir":"5x/dia","por_dias":5,"canal":"push","mensagem":"Massagem: 5 minutos em cada local de aplicação, 5x ao dia, por 5 dias."}
  ]'::jsonb,
  'Não se maquiar nas 24h seguintes; evitar atividades extenuantes nas 24h; evitar sol, sauna e banhos muito quentes até recuperação; compressas frias podem ser feitas. Intervalo de 45-60 dias entre sessões de PLLA (máx. 4 sessões/ano). IMPORTANTE (home care): 5 MINUTOS DE MASSAGEM EM CADA LOCAL DE APLICAÇÃO, 5 VEZES AO DIA, POR 5 DIAS.'
)
on conflict (id) do nothing;

-- Opções padrão de exames laboratoriais (texto padrão reutilizável) -----------
insert into treatment_text_snippets (clinic_id, categoria, titulo, conteudo)
values (
  '00000000-0000-0000-0000-0000000c1111',
  'exames_lab',
  'Painel laboratorial padrão',
  'Vitamina D, Vit. B12, Testosterona, Testost. Livre, Hemoglobina Glicada, Glicemia, Insulina, PCR, Vit. C, Ferro, Ferritina, Cortisol sérico, Ácido Fólico, TSH, T4 Livre, T3, T4, Hemograma Completo, HB+HT, Plaquetas, Na+, K+, Ca+, Mg, Cálcio Iônico, Colesterol total, HDL, LDL, VLDL, Triglicerídeos, Cobre, Zinco, Amilase, Lipase, TGO, TGP, Ureia, Creatinina, Homocisteína, Eosinófilos.'
)
on conflict do nothing;

