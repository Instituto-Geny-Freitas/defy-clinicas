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
-- ARQUIVO: supabase/migrations/0019_patient_provisional_password.sql
-- ======================================================================
-- =============================================================================
-- 0019_patient_provisional_password.sql
-- Marca quando o paciente está com SENHA PROVISÓRIA (definida pela clínica no
-- cadastro). No primeiro acesso por senha, o app obriga a redefinir. Logins por
-- Google (OAuth) ignoram essa regra (não há senha a trocar).
-- =============================================================================

alter table patients
  add column if not exists senha_provisoria boolean not null default false;

comment on column patients.senha_provisoria is
  'TRUE quando a senha foi definida pela clínica e o paciente ainda não a redefiniu (força troca no 1º acesso por senha).';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0020_professional_provisional_password.sql
-- ======================================================================
-- =============================================================================
-- 0020_professional_provisional_password.sql
-- Mesma lógica de senha provisória, agora para a EQUIPE: quando o admin
-- provisiona o acesso de um profissional, marca senha_provisoria = true e o
-- profissional é obrigado a redefinir no 1º acesso por senha.
-- =============================================================================

alter table professionals
  add column if not exists senha_provisoria boolean not null default false;

comment on column professionals.senha_provisoria is
  'TRUE quando a senha foi definida pelo admin e o profissional ainda não a redefiniu.';


-- ======================================================================
-- ARQUIVO: supabase/migrations/0021_notification_channel.sql
-- ======================================================================
-- =============================================================================
-- 0021_notification_channel.sql
-- Atualiza o trigger de orientações para respeitar o CANAL definido em cada item
-- da reminder_schedule (push | whatsapp | email | in_app). Default: in_app.
-- Assim, itens com "canal":"push" geram notificações que a Edge Function
-- send-push entrega como Web Push.
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
  v_canal notification_channel;
  d       int;
begin
  select tipo, reminder_schedule into v_tipo, v_sched
  from document_templates where id = new.template_id;

  if v_tipo is distinct from 'orientacao' then
    return new;
  end if;

  insert into patient_guidance (clinic_id, patient_id, template_id, professional_id, procedure_id, indicado_em)
  values (new.clinic_id, new.patient_id, new.template_id, new.professional_id, new.procedure_id, now());

  for item in select * from jsonb_array_elements(coalesce(v_sched, '[]'::jsonb))
  loop
    v_canal := coalesce((item->>'canal')::notification_channel, 'in_app');
    if item ? 'repetir' then
      v_dias := coalesce((item->>'por_dias')::int, 1);
      for d in 0 .. (v_dias - 1) loop
        insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
        values (new.clinic_id, new.patient_id, 'pos_procedimento', v_canal,
                'Cuidados pós-procedimento',
                jsonb_build_object('mensagem', item->>'mensagem', 'repetir', item->>'repetir'),
                now() + make_interval(days => d), new.id);
      end loop;
    else
      insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
      values (new.clinic_id, new.patient_id, 'pos_procedimento', v_canal,
              'Cuidados pós-procedimento',
              jsonb_build_object('mensagem', item->>'mensagem'),
              now() + make_interval(hours => coalesce((item->>'offset_horas')::int, 0)), new.id);
    end if;
  end loop;

  return new;
end;
$$;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0022_domains_ingredients_procedures.sql
-- ======================================================================
-- =============================================================================
-- 0022_domains_ingredients_procedures.sql
-- Domínios: ativos de composição (por categoria) e tipos de procedimento.
-- Seed gerado a partir de catalogo_ativos_organizado.pdf e Tabela.pdf.
-- =============================================================================

create table if not exists active_ingredients (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  codigo      text,
  nome        text not null,
  categoria   text not null,   -- gerais | vitaminas | esclerosantes | anestesicos
  apresentacao text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_active_ingredients_cat on active_ingredients(categoria);

create table if not exists procedure_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table active_ingredients enable row level security;
alter table procedure_types    enable row level security;
create policy ai_staff on active_ingredients for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy pt_staff on procedure_types    for all to authenticated using (app.is_staff()) with check (app.is_staff());

do $$ begin
  if not exists (select 1 from active_ingredients) then
    insert into active_ingredients (clinic_id, codigo, nome, categoria, apresentacao) values
  ('00000000-0000-0000-0000-0000000c1111','501','5-OH-Triptofano 10mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','598','Acetil-L-Carnitina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','502','Ácido Alfa Lipóico 10mg/2ml - AMP 2ml','gerais','EV/IM/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','503','Ácido Alfa Lipóico 600mg/20ml - FR 20ml','gerais','EV/IM/ID Cx 10 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','599','Ácido Fólico 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','505','Ácido Glicólico 20mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','506','Ácido Hialurônico não reticulado 30mg/2ml','gerais','SC/ID Cx 5 fras. FR 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','507','Ácido Hialurônico não reticulado 30mg/2ml','gerais','SC/ID Cx 10 fras. FR 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','508','Ácido Hialurônico não reticulado 40mg/3ml','gerais','SC/ID Cx 5 fras. FR 3ml'),
  ('00000000-0000-0000-0000-0000000c1111','509','Ácido Hialurônico não reticulado 40mg/3ml','gerais','SC/ID Cx 10 fras. FR 3ml'),
  ('00000000-0000-0000-0000-0000000c1111','510','Ácido Hialurônico não reticulado 4mg/2ml','gerais','SC/ID Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','511','Ácido Mandélico 20mg + Ác. Kojico 20mg +','gerais','ID Cx 10 amp. Ác.Fítico 20mg/ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','512','Ácido Tranexâmico 8mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','513','ADN (Ácido Hialurônico não reticulado 10mg +','gerais','ID Cx 10 fras. Condroitin 25mg/ml - FR 2,5ml)'),
  ('00000000-0000-0000-0000-0000000c1111','514','Alfa Arbutin 20mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','515','Asiaticosídeo 0,6mg/ml - AMP 2ml','gerais','IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','516','BCAA (L-Leucina 10mg + L-Isoleucina 10mg +','gerais','EV/IM/SC Cx 10 amp. L-Valina 10mg/ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','517','BCAA (L-Leucina 10mg + L-Isoleucina 10mg +','gerais','EV/IM/SC Cx 10 amp. L-Valina 10mg/ml ) + HMB 50mg/5ml - AMP 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','518','Benzopirona 1mg/2ml - AMP 2ml','gerais','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','520','Cafeína 120mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','521','Cafeína 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','640','Citrulina 100mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','609','Cloreto de Magnésio 400mg/ml - AMP 1ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','523','Coenzima Q10 100mg/1ml - AMP 1ml','gerais','IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','610','Coenzima Q10 100mg/1ml - AMP 1ml','gerais','IM Cx 5 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','524','Colágeno 10mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','525','Colina 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','526','Condroitin Sulfato 200mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','527','Crisina 100mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','529','Desoxicolato de Sódio 50mg/ml - AMP 2ml','gerais','SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','530','DMSO 20mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','531','DMAE 140mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','532','DMAE 60mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','533','D-Pantenol (Vitamina B5) 50mg/ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','642','D-Ribose 500mg/AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','534','Dutasterida 0,1% (1mg) - AMP 1ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','535','Elastina 10mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','536','Finasterida 1 mg/2ml - AMP 2ml','gerais','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','538','GABA 25mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','539','GAG (Glicosaminoglicano) 20mg/2ml - AMP','gerais','EV/IM/ID Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','643','Glutationa 250mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','540','HMB (hidroximetilbutirato) 50mg/2ml - AMP','gerais','EV/IM/SC Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','541','Inositol 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','542','Inositol 200mg + Taurina 200mg/2ml - AMP','gerais','EV/IM/SC/ID Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','543','Ioimbina 5mg/ml - AMP 2ml','gerais','SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','544','L-Fenilalanina 50 mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','545','L-Arginina 1000mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','547','L-Carnitina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','614','L-Glicina 100mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','615','L-Glutamina 150mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','618','L-Lisina 300mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','619','L-Prolina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','548','L-Carnitina 500mg + Cafeina 65mg/5ml - AMP','gerais','EV/IM/SC/ID Cx 10 amp. 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','549','Vit B12 1mg + Metionina 50mg + Inositol 75mg','gerais','EV/IM/SC Cx 10 amp. + Colina75mg - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','550','L-Metionina 100mg/2ml - AMP 2ml','gerais','EV/IM/ID/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','551','L-Ornitina 150mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','552','L-Taurina 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','553','L-Theanina 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','554','L-Triptofano 50mg/5ml - AMP 5ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','621','Melatonina 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','622','Melatonina 3mg /2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','624','Metilfolato (5-MTHF ou 5-Metiltetrahidrofolato)','gerais','EV/IM/SC Cx 10 amp. 3500mcg/1ml AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','555','Minoxidil 10mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','645','MSM 15% AMP 10ml','gerais','EV/IM/SC Cx 5 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','625','N-Acetil Cisteína 300mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','626','NADH 50mg pó liofilizado','gerais','EV/IM/SC Cx 4 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','557','Pentoxifilina 40mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','226','PDRN 80mg/4ml - FR 4ml','gerais','ID Cx 4 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','558','Picolinato de Cromo 100mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','559','Pill Food (L-Metionina 25mg + L-Taurina 50mg','gerais','EV/IM/ID Cx 10 amp. + L-Prolina 10mg + Biotina 10mg + D-Pantenol 10mg + Vit B2 5mg + Vit B310mg + Vit B610mg/ 2ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','628','Pill Food (L - Metionina 62,5mg + L Taurina','gerais','EV/IM/ID Cx 10 amp. 125mg + L Prolina 25mg + Biotina 25mg + D- Pantenol 25mg + Vit.B2 12,5mg + Vit. B3 25mg + Vit.B6 25mg + Lisina 20mg/5ml) - AMP 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','629','Piracetam 500mg - AMP 1ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','560','Pool de Oligominerais (Silício + Cobre + Zinco','gerais','IM/SC/ID Cx 10 amp. + Magnésio + Cromo) 50mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','561','Piruvato de Sódio 20mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','562','PQQ (Pirroloquinolina Quinona) 5mg/2ml','gerais','EV/IM/SC Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','563','Resveratrol 5mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','630','SAMe (S-Adenosilmetionina) 200mg/2ml','gerais','EV/IM Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','631','Selênio 80mcg/ml - AMP 1ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','657','Sulfato de Magnésio 10% - AMP 10ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','564','Silício 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','565','Sulfato de Cobre 500mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','566','Sulfato de Magnésio 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','568','Sulfato de Zinco 20mg/2ml - AMP 2ml','gerais','EV/IM/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','569','Sulfato de Zinco 20mg + Sulfato de Magnésio','gerais','EV/IM/SC/ID Cx 10 amp. 200mg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','570','Teacrina 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','600','ADEK2 100','vitaminas','IM Cx 5 amp. 20.000UI+100.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','601','ADEK2 100','vitaminas','IM Cx 10 amp. 20.000UI+100.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','602','ADEK2 600','vitaminas','IM Cx 5 amp. 20.000UI+600.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','603','ADEK2 600','vitaminas','IM Cx 10 amp. 20.000UI+600.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','572','Biotina (vitamina H ou B7) 10mg/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','573','Complexo B (c/ B1)*B1+B2+B3+B5+B6','vitaminas','EV/IM/SC/ID Cx 10 amp. 5mg+1,25mg+15mg+3mg+1,25mg/1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','574','Complexo B (s/ B1)*B2+B3+B5+B6','vitaminas','EV/IM/SC Cx 10 amp. 10mg+10mg+50mg+10mg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','649','Trio Metilador (Vit B6 10mg + Metilfolato','vitaminas','EV/IM Cx 10 amp. 2500mcg + Metilcobalamina 2600mcg/2ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','575','Vitamina B12 (Cianocobalamina ) 2500mcg/','vitaminas','EV/IM/SC/ID Cx 10 amp. 1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','576','Vitamina B12 (Metilcobalamina) 2500mcg/ml','vitaminas','EV/IM/SC/ID Cx 10 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','623','Vitamina B12 (Metilcobalamina) 5000mcg/ml','vitaminas','EV/IM/SC/ID Cx 10 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','577','Vitamina B5 (D Pantenol) 50mg/ml - AMP 2ml','vitaminas','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','578','Vitamina B6 (Piridoxina) 50mg/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','580','Vitamina C 20%/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','635','Vitamina C (Ácido Ascórbico) 1,2g /5ml - AMP','vitaminas','EV/IM/SC/ID Cx 10 amp. 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','658','Vitamina D3 (colecalciferol) 10.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','636','Vitamina D3 (colecalciferol) 100.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','637','Vitamina D3 (colecalciferol) 600.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','638','Vitamina K2 MK7 1300mcg/1ml - AMP 1ml','vitaminas','IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','586','Vitamina K2 MK7 + Vitamina D3 1300mcg+','vitaminas','IM Cx 10 amp. 600.000 UI/1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','587','Glicose 75%/3ml - AMP 3ml','esclerosantes','EV Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','589','Lidocaína 2%/10ml - FR 10ml','anestesicos','IM/SC/ID Cx 10 Frasco 10ml'),
  ('00000000-0000-0000-0000-0000000c1111','590','Lidocaína 40mg/2ml - AMP 2ml','anestesicos','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','591','Procaína 40mg/2ml - AMP 2ml','anestesicos','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','593','Procaína 200mg/10ml - FR 10ml','anestesicos','EV/IM/SC/ID Cx 10 fras.');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from procedure_types) then
    insert into procedure_types (clinic_id, nome) values
  ('00000000-0000-0000-0000-0000000c1111','Peeling de Algas Marinhas'),
  ('00000000-0000-0000-0000-0000000c1111','Limpeza de pele'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster com colágeno / elastina / DMAE ou zinco'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster com Peptídeos'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster PDRN'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster exossomos'),
  ('00000000-0000-0000-0000-0000000c1111','Aplicação de Fios de PDO'),
  ('00000000-0000-0000-0000-0000000c1111','Seringa de Ácido hialurônico'),
  ('00000000-0000-0000-0000-0000000c1111','Toxina botulínica'),
  ('00000000-0000-0000-0000-0000000c1111','Crio Modelação Corporal'),
  ('00000000-0000-0000-0000-0000000c1111','Crio Modelação Facial'),
  ('00000000-0000-0000-0000-0000000c1111','Ozonioterapia'),
  ('00000000-0000-0000-0000-0000000c1111','Bioestimulador colágeno PLLA'),
  ('00000000-0000-0000-0000-0000000c1111','Bioestimulador colágeno Hidroxiapatita'),
  ('00000000-0000-0000-0000-0000000c1111','Drenagem linfática'),
  ('00000000-0000-0000-0000-0000000c1111','Massagem relaxante'),
  ('00000000-0000-0000-0000-0000000c1111','Eletrocauterização Avançada (Jato de Plasma)');
  end if;
end $$;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0023_patient_reports.sql
-- ======================================================================
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


-- ======================================================================
-- ARQUIVO: supabase/migrations/0024_ingredients_pricing_domains.sql
-- ======================================================================
-- =============================================================================
-- 0024_ingredients_pricing_domains.sql
-- Ativos: Via de aplicação (domínio), fornecedor (domínio), preços de aquisição
-- e de venda com margem (%). CRUDs de Vias de administração e Fornecedores.
-- =============================================================================

create table if not exists administration_routes (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  contato    text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table active_ingredients
  add column if not exists via             text,
  add column if not exists fornecedor      text,
  add column if not exists preco_aquisicao numeric(12,2) not null default 0,
  add column if not exists margem_pct      numeric(6,2)  not null default 0,
  add column if not exists preco_venda     numeric(12,2) not null default 0;

alter table administration_routes enable row level security;
alter table suppliers              enable row level security;
create policy ar_staff  on administration_routes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy sup_staff on suppliers              for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Seed das vias de administração
do $$ begin
  if not exists (select 1 from administration_routes) then
    insert into administration_routes (clinic_id, nome) values
      ('00000000-0000-0000-0000-0000000c1111', 'Oral'),
      ('00000000-0000-0000-0000-0000000c1111', 'Endovenosa');
  end if;
end $$;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0025_supplier_phone_and_consent_log.sql
-- ======================================================================
-- =============================================================================
-- 0025_supplier_phone_and_consent_log.sql
-- Telefone/WhatsApp no fornecedor + log de auditoria do consentimento LGPD
-- (cada confirmação registra data/hora, versão e origem).
-- =============================================================================

alter table suppliers
  add column if not exists telefone text;

create table if not exists lgpd_consent_logs (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  versao     text,
  origem     fill_source not null default 'paciente',
  created_at timestamptz not null default now()
);
create index if not exists idx_consent_logs_patient on lgpd_consent_logs(patient_id);

alter table lgpd_consent_logs enable row level security;
create policy cl_staff on lgpd_consent_logs for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy cl_patient_read on lgpd_consent_logs for select to authenticated
  using (patient_id = app.current_patient_id());
create policy cl_patient_insert on lgpd_consent_logs for insert to authenticated
  with check (patient_id = app.current_patient_id());


-- ======================================================================
-- ARQUIVO: supabase/migrations/0026_ingredient_lote_validade.sql
-- ======================================================================
-- =============================================================================
-- 0026_ingredient_lote_validade.sql
-- Lote e validade no cadastro de ativos.
-- =============================================================================

alter table active_ingredients
  add column if not exists lote     text,
  add column if not exists validade date;


-- ======================================================================
-- ARQUIVO: supabase/migrations/0027_prescription_nome.sql
-- ======================================================================
-- =============================================================================
-- 0027_prescription_nome.sql
-- Guarda o NOME da fórmula no momento da designação (snapshot), para que a lista
-- de manipulações do paciente sempre exiba o nome — mesmo que a fórmula da
-- biblioteca seja editada ou excluída depois.
-- =============================================================================

alter table formulation_prescriptions
  add column if not exists nome text;


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

