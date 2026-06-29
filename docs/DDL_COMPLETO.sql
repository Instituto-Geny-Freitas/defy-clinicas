-- =============================================================================
-- DDL COMPLETO — Sistema ClinicaGeny (Instituto Geny Freitas)
-- Gerado em: 2026-06-26
-- Stack: Supabase (PostgreSQL 15+) + Auth + Storage
--
-- INSTRUÇÕES DE USO:
--   1. Crie um novo projeto no Supabase.
--   2. Em Database → Extensions, habilite: pg_cron
--      (pgcrypto e pg_trgm são habilitados pelo script).
--   3. Execute este arquivo completo no SQL Editor do Supabase
--      (cole todo o conteúdo ou use psql / supabase db push).
--   4. Ajuste o domínio do e-mail sintético de CPF se necessário:
--      busque 'geny.local' e troque pelo valor do seu
--      VITE_CPF_EMAIL_DOMAIN.
--   5. Após a execução, cadastre a linha única da clínica
--      em Configurações → Identidade Visual.
--
-- ATENÇÃO: Este script usa `on conflict ... do nothing` nos seeds
--   de ativos e procedimentos — é seguro executar mais de uma vez.
--   As colunas de ALTER TABLE usam `add column if not exists`.
-- =============================================================================

-- ============================================================
-- PARTE 1 — EXTENSÕES E TIPOS ENUMERADOS
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

create schema if not exists app;

do $$ begin
  create type user_role as enum ('admin', 'profissional', 'recepcao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum ('termo', 'orientacao', 'ficha');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum ('rascunho', 'pendente', 'lido', 'assinado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assessment_type as enum ('dermato', 'capilar', 'corporal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fill_source as enum ('paciente', 'profissional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pendente', 'pago', 'estornado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum ('entrada', 'saida_venda', 'saida_uso', 'ajuste', 'perda');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('push', 'whatsapp', 'email', 'in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('pendente', 'enviado', 'lido', 'falhou', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type integration_category as enum ('pagamento', 'whatsapp', 'email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type photo_categoria as enum ('antes', 'depois', 'evolucao', 'outro');
exception when duplicate_object then null; end $$;

-- ============================================================
-- PARTE 2 — FUNÇÃO GENÉRICA updated_at
-- ============================================================

create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PARTE 3 — CLÍNICA, PROFISSIONAIS E PACIENTES
-- ============================================================

create table clinics (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  razao_social        text,
  cnpj                text,
  responsavel_tecnico text,
  telefone            text,
  whatsapp            text,
  email               citext,
  endereco            jsonb,
  logo_url            text,
  tema_cores          jsonb not null default '{}'::jsonb,
  dados_empresa       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_clinics_updated_at before update on clinics
  for each row execute function app.set_updated_at();

create table professionals (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  auth_user_id         uuid unique references auth.users(id) on delete set null,
  nome                 text not null,
  cpf                  text,
  email                citext,
  telefone             text,
  role                 user_role not null default 'profissional',
  conselho_tipo        text,
  conselho_numero      text,
  conselho_uf          text,
  especialidade        text,
  formacao             text,
  responsavel_tecnico  boolean not null default false,
  servicos_prestados   jsonb not null default '[]'::jsonb,
  vacinas              jsonb not null default '{}'::jsonb,
  assinatura_url       text,
  senha_provisoria     boolean not null default false,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_professionals_clinic on professionals(clinic_id);
create index idx_professionals_auth   on professionals(auth_user_id);
create trigger trg_professionals_updated_at before update on professionals
  for each row execute function app.set_updated_at();

create table patients (
  id                       uuid primary key default gen_random_uuid(),
  clinic_id                uuid not null references clinics(id) on delete cascade,
  auth_user_id             uuid unique references auth.users(id) on delete set null,
  nome                     text not null,
  cpf                      text unique,
  rg                       text,
  nascimento               date,
  sexo                     text,
  email                    citext,
  whatsapp                 text,
  telefone                 text,
  endereco                 jsonb,
  profissao                text,
  estilo_trabalho          text,
  alergias                 text,
  observacoes              text,
  foto_url                 text,
  consentimento_lgpd_em    timestamptz,
  consentimento_lgpd_versao text,
  senha_provisoria         boolean not null default false,
  limite_relatorios        integer not null default 10,
  ativo                    boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index idx_patients_clinic    on patients(clinic_id);
create index idx_patients_auth      on patients(auth_user_id);
create index idx_patients_nome_trgm on patients using gin (nome gin_trgm_ops);
create trigger trg_patients_updated_at before update on patients
  for each row execute function app.set_updated_at();

-- Funções de identidade RLS (criadas após as tabelas)
create or replace function app.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from professionals p where p.auth_user_id = auth.uid() and p.ativo
  );
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from professionals p
    where p.auth_user_id = auth.uid() and p.ativo and p.role = 'admin'
  );
$$;

create or replace function app.current_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from patients where auth_user_id = auth.uid();
$$;

create or replace function app.current_professional_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from professionals where auth_user_id = auth.uid();
$$;

-- ============================================================
-- PARTE 4 — MOTOR DE DOCUMENTOS DINÂMICOS
-- ============================================================

create table document_templates (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  tipo               document_type not null,
  nome               text not null,
  descricao          text,
  procedimento_rel   text,
  schema             jsonb not null default '[]'::jsonb,
  corpo              text not null default '',
  versao             integer not null default 1,
  parent_template_id uuid references document_templates(id) on delete set null,
  reminder_schedule  jsonb not null default '[]'::jsonb,
  requer_assinatura  boolean not null default true,
  ativo              boolean not null default true,
  created_by         uuid references professionals(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_doc_templates_clinic on document_templates(clinic_id);
create index idx_doc_templates_tipo   on document_templates(tipo);
create trigger trg_doc_templates_updated_at before update on document_templates
  for each row execute function app.set_updated_at();

create table document_instances (
  id                    uuid primary key default gen_random_uuid(),
  clinic_id             uuid not null references clinics(id) on delete cascade,
  template_id           uuid not null references document_templates(id) on delete restrict,
  template_versao       integer not null,
  patient_id            uuid not null references patients(id) on delete cascade,
  professional_id       uuid references professionals(id) on delete set null,
  procedure_id          uuid,
  appointment_id        uuid,
  dados                 jsonb not null default '{}'::jsonb,
  corpo_final           text,
  status                document_status not null default 'pendente',
  enviado_em            timestamptz,
  lido_em               timestamptz,
  consentido_em         timestamptz,
  assinado_em           timestamptz,
  signed_ip             inet,
  signed_user_agent     text,
  signature_image_url   text,
  content_hash          text,
  assinatura_hash       text,
  pdf_url               text,
  uso_imagem_autorizado boolean,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_doc_instances_patient  on document_instances(patient_id);
create index idx_doc_instances_template on document_instances(template_id);
create index idx_doc_instances_status   on document_instances(status);
create trigger trg_doc_instances_updated_at before update on document_instances
  for each row execute function app.set_updated_at();

-- ============================================================
-- PARTE 5 — PRONTUÁRIO CLÍNICO
-- ============================================================

create table anamnesis (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  preenchido_por   fill_source not null default 'profissional',
  dados            jsonb not null default '{}'::jsonb,
  peso_kg          numeric(6,2),
  altura_m         numeric(4,2),
  imc              numeric(6,2),
  peso_meta_kg     numeric(6,2),
  consentimento_em timestamptz,
  data             date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_anamnesis_patient on anamnesis(patient_id);
create trigger trg_anamnesis_updated_at before update on anamnesis
  for each row execute function app.set_updated_at();

create table assessments (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references clinics(id) on delete cascade,
  patient_id          uuid not null references patients(id) on delete cascade,
  professional_id     uuid references professionals(id) on delete set null,
  tipo                assessment_type not null,
  dados               jsonb not null default '{}'::jsonb,
  fotos               jsonb not null default '[]'::jsonb,
  tratamento_proposto text,
  recursos            jsonb not null default '[]'::jsonb,
  num_sessoes         integer,
  frequencia          text,
  valor_total         numeric(12,2),
  data                date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_assessments_patient on assessments(patient_id);
create index idx_assessments_tipo    on assessments(tipo);
create trigger trg_assessments_updated_at before update on assessments
  for each row execute function app.set_updated_at();

create table perimetry (
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references assessments(id) on delete cascade,
  regiao                  text not null,
  medida_inicial_cm       numeric(6,2),
  medida_intermediaria_cm numeric(6,2),
  medida_final_cm         numeric(6,2),
  ordem                   integer not null default 0
);
create index idx_perimetry_assessment on perimetry(assessment_id);

create table body_measurements (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  sessao           integer,
  data             date not null default current_date,
  peso_kg          numeric(6,2),
  imc              numeric(6,2),
  gordura_corporal_pct numeric(5,2),
  musculo_pct      numeric(5,2),
  rm               numeric(8,2),
  kcal             numeric(8,2),
  idade_corporal   integer,
  gordura_visceral numeric(5,2),
  extras           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_body_meas_patient on body_measurements(patient_id);
create trigger trg_body_meas_updated_at before update on body_measurements
  for each row execute function app.set_updated_at();

create table procedures_log (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  appointment_id   uuid,
  quote_id         uuid,   -- FK lógica para quotes (adicionada depois)
  procedimento     text not null,
  data             timestamptz not null default now(),
  regiao           text,
  observacoes      text,
  produtos_usados  jsonb not null default '[]'::jsonb,
  fotos            jsonb not null default '[]'::jsonb,
  valor_cobrado    numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_procedures_patient on procedures_log(patient_id);
create index idx_procedures_data    on procedures_log(data);
create trigger trg_procedures_updated_at before update on procedures_log
  for each row execute function app.set_updated_at();

create table treatment_plans (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  titulo           text,
  texto            text,
  recursos         jsonb not null default '[]'::jsonb,
  num_sessoes      integer,
  frequencia       text,
  valor_total      numeric(12,2),
  origem_ia        boolean not null default false,
  data             date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_treatment_plans_patient on treatment_plans(patient_id);
create trigger trg_treatment_plans_updated_at before update on treatment_plans
  for each row execute function app.set_updated_at();

create table treatment_text_snippets (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  categoria  text,
  titulo     text not null,
  conteudo   text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table supplementations (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  medicacao        text not null,
  via_adm          text,
  validade         date,
  lote             text,
  fornecedor       text,
  valor_venda      numeric(12,2) not null default 0,
  pago             boolean not null default false,
  data             date not null default current_date,
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_supplementations_patient on supplementations(patient_id);
create trigger trg_supplementations_updated_at before update on supplementations
  for each row execute function app.set_updated_at();

create table formulations (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  nome         text not null,
  composicao   jsonb not null default '[]'::jsonb,
  posologia    text,
  forma        text,
  is_biblioteca boolean not null default true,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_formulations_updated_at before update on formulations
  for each row execute function app.set_updated_at();

create table formulation_prescriptions (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  formulation_id   uuid references formulations(id) on delete set null,
  nome             text,
  composicao       jsonb not null default '[]'::jsonb,
  posologia        text,
  pdf_url          text,
  data             date not null default current_date,
  created_at       timestamptz not null default now()
);
create index idx_form_presc_patient on formulation_prescriptions(patient_id);

create table lab_orders (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  exames           jsonb not null default '[]'::jsonb,
  observacoes      text,
  data             date not null default current_date,
  created_at       timestamptz not null default now()
);
create index idx_lab_orders_patient on lab_orders(patient_id);

create table lab_results (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references lab_orders(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  arquivo_url text,
  valores     jsonb not null default '{}'::jsonb,
  data_coleta date,
  created_at  timestamptz not null default now()
);
create index idx_lab_results_patient on lab_results(patient_id);

-- ============================================================
-- PARTE 6 — AGENDA
-- ============================================================

create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references clinics(id) on delete cascade,
  patient_id          uuid references patients(id) on delete cascade,  -- nullable (sem cadastro)
  professional_id     uuid references professionals(id) on delete set null,
  procedimento        text,
  inicio              timestamptz not null,
  fim                 timestamptz,
  status              appointment_status not null default 'agendado',
  origem              fill_source not null default 'profissional',
  observacoes         text,
  lembrete_enviado_em timestamptz,
  confirmado_em       timestamptz,
  nome_avulso         text,         -- agendamento sem cadastro
  telefone_avulso     text,
  recorrencia_grupo   uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_appointment_period check (fim is null or fim > inicio)
);
create index idx_appointments_patient      on appointments(patient_id);
create index idx_appointments_professional on appointments(professional_id);
create index idx_appointments_inicio       on appointments(inicio);
create index idx_appointments_status       on appointments(status);
create index idx_appointments_grupo        on appointments(recorrencia_grupo);
create trigger trg_appointments_updated_at before update on appointments
  for each row execute function app.set_updated_at();

-- Disponibilidade semanal do profissional
create table professional_availability (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6),
  hora_inicio     time not null,
  hora_fim        time not null,
  created_at      timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);
create index idx_avail_prof on professional_availability(professional_id);

-- Bloqueios de datas (férias / indisponibilidade)
create table professional_blocks (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date not null,
  motivo          text,
  created_at      timestamptz not null default now(),
  check (data_fim >= data_inicio)
);
create index idx_blocks_prof on professional_blocks(professional_id);

-- ============================================================
-- PARTE 7 — ESTOQUE
-- ============================================================

create table inventory (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  produto     text not null,
  marca       text,
  lote        text,
  validade    date,
  custo_unit  numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  qtd_atual   numeric(12,2) not null default 0,
  qtd_minima  numeric(12,2) not null default 0,
  unidade     text default 'un',
  categoria   text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_inventory_clinic   on inventory(clinic_id);
create index idx_inventory_validade on inventory(validade);
create index idx_inventory_produto_trgm on inventory using gin (produto gin_trgm_ops);
create trigger trg_inventory_updated_at before update on inventory
  for each row execute function app.set_updated_at();

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
  procedure_id    uuid references procedures_log(id) on delete set null,
  patient_id      uuid references patients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  motivo          text,
  data            timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_stock_mov_inventory on stock_movements(inventory_id);
create index idx_stock_mov_data      on stock_movements(data);

create or replace function app.apply_stock_movement()
returns trigger language plpgsql as $$
declare delta numeric(12,2);
begin
  if (tg_op = 'INSERT') then
    delta := case
      when new.tipo = 'entrada' then new.quantidade
      when new.tipo = 'ajuste'  then new.quantidade
      else -abs(new.quantidade)
    end;
    update inventory set qtd_atual = qtd_atual + delta where id = new.inventory_id;
  end if;
  return new;
end;
$$;
create trigger trg_apply_stock_movement after insert on stock_movements
  for each row execute function app.apply_stock_movement();

-- ============================================================
-- PARTE 8 — FINANCEIRO (ORÇAMENTOS E PAGAMENTOS)
-- ============================================================

create table quotes (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  patient_id        uuid not null references patients(id) on delete cascade,
  professional_id   uuid references professionals(id) on delete set null,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  numero            text,
  itens             jsonb not null default '[]'::jsonb,
  valor_bruto       numeric(12,2) not null default 0,
  desconto          numeric(12,2) not null default 0,
  valor_total       numeric(12,2) not null default 0,
  status            quote_status not null default 'rascunho',
  validade          date,
  observacoes       text,
  aprovado_em       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_quotes_patient on quotes(patient_id);
create index idx_quotes_status  on quotes(status);
create trigger trg_quotes_updated_at before update on quotes
  for each row execute function app.set_updated_at();

-- FK lógica de procedures_log → quotes (ambas criadas; adiciona aqui)
alter table procedures_log
  add constraint fk_proc_quote foreign key (quote_id) references quotes(id) on delete set null;
create index if not exists idx_procedures_quote on procedures_log(quote_id);

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  quote_id           uuid references quotes(id) on delete set null,
  patient_id         uuid not null references patients(id) on delete cascade,
  valor              numeric(12,2) not null,
  metodo             payment_method not null default 'pix',
  status             payment_status not null default 'pendente',
  parcela            integer not null default 1,
  total_parcelas     integer not null default 1,
  vencimento         date,
  pago_em            timestamptz,
  parcelamento_grupo uuid,
  liquidado_paciente boolean not null default false,
  gateway            text,
  gateway_ref        text,
  pix_qrcode         text,
  pix_copia_cola     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_payments_quote       on payments(quote_id);
create index idx_payments_patient     on payments(patient_id);
create index idx_payments_status      on payments(status);
create index idx_payments_gateway_ref on payments(gateway_ref);
create index idx_payments_grupo       on payments(parcelamento_grupo);
create index idx_payments_vencimento  on payments(vencimento);
create trigger trg_payments_updated_at before update on payments
  for each row execute function app.set_updated_at();

-- Saldo por orçamento (considera cartão parcelado liquidado pelo paciente)
create or replace view v_quote_balances
with (security_invoker = true) as
select
  q.id                        as quote_id,
  q.patient_id,
  q.valor_total,
  coalesce(sum(p.valor) filter (
    where p.status = 'pago'
       or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado'))
  ), 0)                       as total_pago,
  q.valor_total - coalesce(sum(p.valor) filter (
    where p.status = 'pago'
       or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado'))
  ), 0)                       as saldo_a_receber
from quotes q
left join payments p on p.quote_id = q.id
group by q.id;

-- ============================================================
-- PARTE 9 — NOTIFICAÇÕES E ORIENTAÇÕES
-- ============================================================

create table notifications (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  patient_id           uuid references patients(id) on delete cascade,
  professional_id      uuid references professionals(id) on delete set null,
  tipo                 text not null,
  canal                notification_channel not null default 'in_app',
  titulo               text,
  payload              jsonb not null default '{}'::jsonb,
  agendado_para        timestamptz not null default now(),
  status               notification_status not null default 'pendente',
  enviado_em           timestamptz,
  lido_em              timestamptz,
  erro                 text,
  appointment_id       uuid references appointments(id) on delete set null,
  document_instance_id uuid references document_instances(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_notifications_patient   on notifications(patient_id);
create index idx_notifications_status    on notifications(status);
create index idx_notifications_agendado  on notifications(agendado_para) where status = 'pendente';
create trigger trg_notifications_updated_at before update on notifications
  for each row execute function app.set_updated_at();

create table patient_guidance (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  template_id      uuid not null references document_templates(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  procedure_id     uuid references procedures_log(id) on delete set null,
  indicado_em      timestamptz not null default now(),
  lido_em          timestamptz,
  consentido_em    timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_patient_guidance_patient on patient_guidance(patient_id);

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  keys         jsonb not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  unique (auth_user_id, endpoint)
);

-- ============================================================
-- PARTE 10 — INTEGRAÇÕES E FOTOS CLÍNICAS
-- ============================================================

create table integration_settings (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  categoria      integration_category not null,
  provider       text,
  modo           text not null default 'sandbox',
  config_publica jsonb not null default '{}'::jsonb,
  ativo          boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinic_id, categoria)
);
create trigger trg_integration_settings_updated_at before update on integration_settings
  for each row execute function app.set_updated_at();

create table clinical_photos (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  procedure_id     uuid references procedures_log(id) on delete set null,
  assessment_id    uuid references assessments(id) on delete set null,
  categoria        photo_categoria not null default 'evolucao',
  regiao           text,
  grupo_id         uuid,
  sessao           integer,
  arquivo_url      text not null,
  thumb_url        text,
  observacoes      text,
  visivel_paciente boolean not null default true,
  capturada_em     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index idx_clinical_photos_patient   on clinical_photos(patient_id);
create index idx_clinical_photos_grupo     on clinical_photos(grupo_id);
create index idx_clinical_photos_procedure on clinical_photos(procedure_id);

-- ============================================================
-- PARTE 11 — DOMÍNIOS CONFIGURÁVEIS
-- ============================================================

-- Ativos de composição (fórmulas manipuladas)
create table active_ingredients (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  codigo          text,
  nome            text not null,
  categoria       text not null,
  apresentacao    text,
  via             text,
  fornecedor      text,
  lote            text,
  validade        date,
  preco_aquisicao numeric(12,2) not null default 0,
  margem_pct      numeric(6,2)  not null default 0,
  preco_venda     numeric(12,2) not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index idx_active_ingredients_cat on active_ingredients(categoria);

-- Tipos de procedimento
create table procedure_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Vias de administração
create table administration_routes (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Fornecedores
create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  contato    text,
  telefone   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Relatórios do paciente
create table patient_reports (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  patient_id     uuid not null references patients(id) on delete cascade,
  titulo         text,
  secoes         jsonb not null default '[]'::jsonb,
  periodo_inicio date,
  periodo_fim    date,
  arquivo_url    text,
  gerado_por     fill_source not null default 'paciente',
  created_at     timestamptz not null default now()
);
create index idx_patient_reports_patient on patient_reports(patient_id);

-- Log de consentimento LGPD
create table lgpd_consent_logs (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  versao     text,
  origem     fill_source not null default 'paciente',
  created_at timestamptz not null default now()
);
create index idx_consent_logs_patient on lgpd_consent_logs(patient_id);

-- Documentos compartilhados (receitas, orçamentos em PDF)
create table shared_documents (
  id                    uuid primary key default gen_random_uuid(),
  clinic_id             uuid not null references clinics(id) on delete cascade,
  patient_id            uuid not null references patients(id) on delete cascade,
  professional_id       uuid references professionals(id) on delete set null,
  quote_id              uuid references quotes(id) on delete set null,
  categoria             text not null default 'manipulacao',
  titulo                text not null,
  arquivo_url           text not null,
  enviado_paciente      boolean not null default false,
  fornecedor_nome       text,
  fornecedor_whatsapp   text,
  enviado_fornecedor_em timestamptz,
  created_at            timestamptz not null default now()
);
create index idx_shared_docs_patient on shared_documents(patient_id);
create index idx_shared_docs_quote   on shared_documents(quote_id);

-- Fluxo de caixa — tipos de despesa
create table expense_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  tipo       text not null default 'fixo',   -- produto | fixo
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Despesas
create table expenses (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  expense_type_id  uuid references expense_types(id) on delete set null,
  descricao        text,
  valor            numeric(12,2) not null default 0,
  quantidade       integer not null default 1,
  classificacao    text not null default 'fixo',   -- produto | fixo
  forma_pagamento  text,                            -- pix | cartao | outro
  parcela_num      integer,
  parcela_total    integer,
  data             date not null default current_date,
  pago             boolean not null default false,
  recorrencia_grupo uuid,
  created_at       timestamptz not null default now()
);
create index idx_expenses_data on expenses(data);

-- Movimentos de caixa / aplicação / aporte
create table financial_movements (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  tipo       text not null,
  descricao  text,
  valor      numeric(12,2) not null default 0,
  data       date not null default current_date,
  created_at timestamptz not null default now()
);
create index idx_fin_mov_data on financial_movements(data);

-- Papéis da equipe
create table roles (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  nivel      user_role not null default 'profissional',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

-- Área administrativa — domínios
create table servico_tipos (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

create table vacina_tipos (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

-- Registros administrativos (motor genérico JSONB)
create table admin_records (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  form_chave      text not null,
  patient_id      uuid references patients(id) on delete set null,
  ref_data        date,
  seq             text,
  dados           jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_by_nome text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index admin_records_form_idx    on admin_records (clinic_id, form_chave, ref_data);
create index admin_records_patient_idx on admin_records (patient_id);

-- Numerador automático (registros administrativos)
create table admin_counters (
  clinic_id uuid not null references clinics(id) on delete cascade,
  escopo    text not null,
  ano       int  not null,
  atual     int  not null default 0,
  primary key (clinic_id, escopo, ano)
);

-- Tipos de exame laboratorial (domínio configurável)
create table exam_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

-- ============================================================
-- PARTE 12 — ROW LEVEL SECURITY
-- ============================================================

alter table clinics                   enable row level security;
alter table professionals             enable row level security;
alter table patients                  enable row level security;
alter table document_templates        enable row level security;
alter table document_instances        enable row level security;
alter table anamnesis                 enable row level security;
alter table assessments               enable row level security;
alter table perimetry                 enable row level security;
alter table body_measurements         enable row level security;
alter table procedures_log            enable row level security;
alter table treatment_plans           enable row level security;
alter table treatment_text_snippets   enable row level security;
alter table supplementations          enable row level security;
alter table formulations              enable row level security;
alter table formulation_prescriptions enable row level security;
alter table lab_orders                enable row level security;
alter table lab_results               enable row level security;
alter table appointments              enable row level security;
alter table inventory                 enable row level security;
alter table stock_movements           enable row level security;
alter table quotes                    enable row level security;
alter table payments                  enable row level security;
alter table notifications             enable row level security;
alter table patient_guidance          enable row level security;
alter table push_subscriptions        enable row level security;
alter table integration_settings      enable row level security;
alter table clinical_photos           enable row level security;
alter table active_ingredients        enable row level security;
alter table procedure_types           enable row level security;
alter table administration_routes     enable row level security;
alter table suppliers                 enable row level security;
alter table patient_reports           enable row level security;
alter table lgpd_consent_logs         enable row level security;
alter table shared_documents          enable row level security;
alter table expense_types             enable row level security;
alter table expenses                  enable row level security;
alter table financial_movements       enable row level security;
alter table roles                     enable row level security;
alter table servico_tipos             enable row level security;
alter table vacina_tipos              enable row level security;
alter table admin_records             enable row level security;
alter table admin_counters            enable row level security;
alter table exam_types                enable row level security;
alter table professional_availability enable row level security;
alter table professional_blocks       enable row level security;

-- Clínica
create policy clinics_select on clinics for select to authenticated using (true);
create policy clinics_admin  on clinics for all   to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Profissionais
create policy professionals_select on professionals for select to authenticated using (true);
create policy professionals_admin  on professionals for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy professionals_self_update on professionals for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Pacientes
create policy patients_staff       on patients for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy patients_self_select on patients for select to authenticated using (auth_user_id = auth.uid());
create policy patients_self_update on patients for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Modelos de documento
create policy doc_templates_staff         on document_templates for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy doc_templates_patient_read  on document_templates for select to authenticated using (ativo);

-- Instâncias de documento
create policy doc_instances_staff        on document_instances for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy doc_instances_patient_read on document_instances for select to authenticated using (patient_id = app.current_patient_id());
create policy doc_instances_patient_sign on document_instances for update to authenticated
  using (patient_id = app.current_patient_id()) with check (patient_id = app.current_patient_id());

-- Anamnese
create policy anamnesis_staff          on anamnesis for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy anamnesis_patient_read   on anamnesis for select to authenticated using (patient_id = app.current_patient_id());
create policy anamnesis_patient_insert on anamnesis for insert to authenticated with check (patient_id = app.current_patient_id());
create policy anamnesis_patient_update on anamnesis for update to authenticated
  using (patient_id = app.current_patient_id()) with check (patient_id = app.current_patient_id());

-- Avaliações, perimetria, medidas, procedimentos, planos, snippets, suplementação, fórmulas, prescrições
create policy assessments_staff        on assessments for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy assessments_patient_read on assessments for select to authenticated using (patient_id = app.current_patient_id());

create policy perimetry_staff        on perimetry for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy perimetry_patient_read on perimetry for select to authenticated
  using (exists (select 1 from assessments a where a.id = perimetry.assessment_id and a.patient_id = app.current_patient_id()));

create policy body_meas_staff        on body_measurements for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy body_meas_patient_read on body_measurements for select to authenticated using (patient_id = app.current_patient_id());

create policy procedures_staff        on procedures_log for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy procedures_patient_read on procedures_log for select to authenticated using (patient_id = app.current_patient_id());

create policy plans_staff        on treatment_plans for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy plans_patient_read on treatment_plans for select to authenticated using (patient_id = app.current_patient_id());

create policy snippets_staff on treatment_text_snippets for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy suppl_staff        on supplementations for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy suppl_patient_read on supplementations for select to authenticated using (patient_id = app.current_patient_id());

create policy formulations_staff on formulations for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy form_presc_staff        on formulation_prescriptions for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy form_presc_patient_read on formulation_prescriptions for select to authenticated using (patient_id = app.current_patient_id());

create policy lab_orders_staff        on lab_orders for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy lab_orders_patient_read on lab_orders for select to authenticated using (patient_id = app.current_patient_id());

create policy lab_results_staff          on lab_results for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy lab_results_patient_read   on lab_results for select to authenticated using (patient_id = app.current_patient_id());
create policy lab_results_patient_insert on lab_results for insert to authenticated with check (patient_id = app.current_patient_id());

-- Agendamentos
create policy appts_staff          on appointments for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy appts_patient_read   on appointments for select to authenticated using (patient_id = app.current_patient_id());
create policy appts_patient_insert on appointments for insert to authenticated with check (patient_id = app.current_patient_id());
create policy appts_patient_update on appointments for update to authenticated
  using (patient_id = app.current_patient_id()) with check (patient_id = app.current_patient_id());

-- Disponibilidade e bloqueios (equipe escreve; autenticados leem)
create policy avail_read        on professional_availability for select to authenticated using (true);
create policy avail_staff_write on professional_availability for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy blocks_read        on professional_blocks for select to authenticated using (true);
create policy blocks_staff_write on professional_blocks for all    to authenticated using (app.is_staff()) with check (app.is_staff());

-- Estoque
create policy inventory_staff  on inventory       for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy stock_mov_staff  on stock_movements for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Financeiro
create policy quotes_staff        on quotes for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy quotes_patient_read on quotes for select to authenticated using (patient_id = app.current_patient_id());

create policy payments_staff        on payments for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy payments_patient_read on payments for select to authenticated using (patient_id = app.current_patient_id());

-- Notificações e orientações
create policy notif_staff          on notifications for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy notif_patient_read   on notifications for select to authenticated using (patient_id = app.current_patient_id());
create policy notif_patient_update on notifications for update to authenticated
  using (patient_id = app.current_patient_id()) with check (patient_id = app.current_patient_id());

create policy guidance_staff          on patient_guidance for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy guidance_patient_read   on patient_guidance for select to authenticated using (patient_id = app.current_patient_id());
create policy guidance_patient_update on patient_guidance for update to authenticated
  using (patient_id = app.current_patient_id()) with check (patient_id = app.current_patient_id());

create policy push_owner on push_subscriptions for all to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Integrações e fotos
create policy integration_settings_admin on integration_settings for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy clinical_photos_staff        on clinical_photos for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy clinical_photos_patient_read on clinical_photos for select to authenticated
  using (patient_id = app.current_patient_id() and visivel_paciente);

-- Domínios (staff escreve, admin em alguns)
create policy ai_staff  on active_ingredients    for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy pt_staff  on procedure_types       for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy ar_staff  on administration_routes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy sup_staff on suppliers             for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy et_staff  on expense_types         for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy ex_staff  on expenses              for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy fm_staff  on financial_movements   for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy roles_staff_read  on roles for select to authenticated using (app.is_staff());
create policy roles_admin_write on roles for all    to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy servico_tipos_staff_read  on servico_tipos for select to authenticated using (app.is_staff());
create policy servico_tipos_admin_write on servico_tipos for all    to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy vacina_tipos_staff_read  on vacina_tipos for select to authenticated using (app.is_staff());
create policy vacina_tipos_admin_write on vacina_tipos for all    to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy admin_records_staff_all  on admin_records  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy admin_counters_staff_all on admin_counters  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy exam_types_staff_read  on exam_types for select to authenticated using (app.is_staff());
create policy exam_types_admin_write on exam_types for all    to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Relatórios e logs
create policy pr_staff           on patient_reports   for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy pr_patient_read    on patient_reports   for select to authenticated using (patient_id = app.current_patient_id());
create policy pr_patient_insert  on patient_reports   for insert to authenticated with check (patient_id = app.current_patient_id());
create policy pr_patient_delete  on patient_reports   for delete to authenticated using (patient_id = app.current_patient_id());

create policy cl_staff          on lgpd_consent_logs for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy cl_patient_read   on lgpd_consent_logs for select to authenticated using (patient_id = app.current_patient_id());
create policy cl_patient_insert on lgpd_consent_logs for insert to authenticated with check (patient_id = app.current_patient_id());

create policy sd_staff        on shared_documents for all    to authenticated using (app.is_staff()) with check (app.is_staff());
create policy sd_patient_read on shared_documents for select to authenticated
  using (patient_id = app.current_patient_id() and enviado_paciente = true);

-- ============================================================
-- PARTE 13 — STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', false)
on conflict (id) do nothing;

-- Branding: leitura pública; escrita só admin
create policy branding_public_read  on storage.objects for select
  using (bucket_id = 'branding');
create policy branding_admin_write  on storage.objects for all to authenticated
  using  (bucket_id = 'branding' and app.is_admin())
  with check (bucket_id = 'branding' and app.is_admin());

-- Patient-files: equipe acessa tudo; paciente acessa a própria pasta
create policy patient_files_staff        on storage.objects for all to authenticated
  using  (bucket_id = 'patient-files' and app.is_staff())
  with check (bucket_id = 'patient-files' and app.is_staff());
create policy patient_files_owner_read   on storage.objects for select to authenticated
  using (bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text);
create policy patient_files_owner_write  on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text);

-- Admin-files: equipe
create policy admin_files_staff_all on storage.objects for all to authenticated
  using  (bucket_id = 'admin-files' and app.is_staff())
  with check (bucket_id = 'admin-files' and app.is_staff());

-- ============================================================
-- PARTE 14 — VIEW PÚBLICA DE BRANDING
-- ============================================================

create or replace view v_clinic_branding
with (security_invoker = false) as
  select id, nome, logo_url, tema_cores, whatsapp
  from clinics;

grant select on v_clinic_branding to anon, authenticated;

-- ============================================================
-- PARTE 15 — ONBOARDING: VÍNCULO AUTH → PROFISSIONAL/PACIENTE
-- ============================================================

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cpf_domain text := 'geny.local';  -- AJUSTE se mudar VITE_CPF_EMAIL_DOMAIN
  v_cpf text;
begin
  update professionals set auth_user_id = new.id
   where auth_user_id is null and email is not null and email = new.email;
  if found then return new; end if;

  update patients set auth_user_id = new.id
   where auth_user_id is null and email is not null and email = new.email;
  if found then return new; end if;

  if new.email like ('%@' || v_cpf_domain) then
    v_cpf := split_part(new.email, '@', 1);
    update patients set auth_user_id = new.id
     where auth_user_id is null and cpf = v_cpf;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ============================================================
-- PARTE 16 — AUTOMAÇÃO: ORIENTAÇÕES → NOTIFICAÇÕES
-- ============================================================

create or replace function app.on_document_issued()
returns trigger language plpgsql as $$
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

  if v_tipo is distinct from 'orientacao' then return new; end if;

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

drop trigger if exists on_document_issued on document_instances;
create trigger on_document_issued after insert on document_instances
  for each row execute function app.on_document_issued();

-- ============================================================
-- PARTE 17 — LEMBRETES DE CONSULTA (pg_cron)
-- ============================================================

create or replace function app.enqueue_appointment_reminders()
returns void language plpgsql security definer set search_path = public as $$
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

-- Habilite pg_cron na UI do Supabase (Database → Extensions) antes deste bloco.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('lembretes-consulta');
exception when others then null;
end $$;

select cron.schedule(
  'lembretes-consulta',
  '*/15 * * * *',
  $$ select app.enqueue_appointment_reminders(); $$
);

-- ============================================================
-- PARTE 18 — PROTEÇÃO DE LIMITES E GUARDS
-- ============================================================

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

-- ============================================================
-- PARTE 19 — RPCs PÚBLICAS
-- ============================================================

-- Verificação de disponibilidade de horário (chamável pelo paciente via portal)
create or replace function public.check_slot(
  p_prof  uuid,
  p_inicio timestamptz,
  p_fim    timestamptz default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_fim   timestamptz := coalesce(p_fim, p_inicio + interval '30 minutes');
  v_local timestamp   := (p_inicio at time zone 'America/Sao_Paulo');
  v_dow   int         := extract(dow from v_local);
  v_time  time        := v_local::time;
  v_date  date        := v_local::date;
  v_tem_janela boolean;
begin
  if p_prof is null then return 'ok'; end if;

  if exists (
    select 1 from professional_blocks b
    where b.professional_id = p_prof and v_date between b.data_inicio and b.data_fim
  ) then return 'bloqueado'; end if;

  select exists (select 1 from professional_availability a where a.professional_id = p_prof)
    into v_tem_janela;
  if v_tem_janela then
    if not exists (
      select 1 from professional_availability a
      where a.professional_id = p_prof and a.dia_semana = v_dow
        and v_time >= a.hora_inicio and v_time < a.hora_fim
    ) then return 'fora_horario'; end if;
  end if;

  if exists (
    select 1 from appointments ap
    where ap.professional_id = p_prof
      and ap.status not in ('cancelado')
      and ap.inicio < v_fim
      and coalesce(ap.fim, ap.inicio + interval '30 minutes') > p_inicio
  ) then return 'ocupado'; end if;

  return 'ok';
end;
$$;

-- Numerador automático de registros administrativos
create or replace function public.next_admin_seq(p_clinic uuid, p_escopo text, p_ano int)
returns int language plpgsql security definer set search_path = public as $$
declare v_atual int;
begin
  if not app.is_staff() then raise exception 'not authorized'; end if;
  insert into admin_counters (clinic_id, escopo, ano, atual)
  values (p_clinic, p_escopo, p_ano, 1)
  on conflict (clinic_id, escopo, ano)
  do update set atual = admin_counters.atual + 1
  returning atual into v_atual;
  return v_atual;
end;
$$;

-- ============================================================
-- PARTE 20 — SEEDS DE DADOS INICIAIS
-- ============================================================
-- ATENÇÃO: os seeds de ativos usam clinic_id fixo
-- '00000000-0000-0000-0000-0000000c1111', que NÃO existe ainda.
-- Após criar a linha da clínica, rode o bloco abaixo substituindo
-- o UUID pelo id real gerado. Ou execute-o depois via Edge Function.
-- Os blocos usam `if not exists` — seguros de rodar novamente.

-- Papéis iniciais (requer linha de clinics existente)
-- insert into roles (clinic_id, nome, nivel)
-- select c.id, v.nome, v.nivel::user_role
-- from clinics c
-- cross join (values ('Admin','admin'),('Secretaria','recepcao'),('Profissional','profissional')) v(nome,nivel)
-- on conflict (clinic_id, nome) do nothing;

-- Exames laboratoriais (56 tipos padrão)
-- insert into exam_types (clinic_id, nome, ordem)
-- select c.id, v.nome, v.ord from clinics c
-- cross join (values
--   ('Sódio',1),('Potássio',2),('Cálcio',3),('Magnésio',4),('Fósforo',5),
--   ('Ca iônico',6),('Colesterol Total',7),('HDL Colesterol',8),('LDL Colesterol',9),
--   ('VLDL Colesterol',10),('Triglicérides',11),('Cobre',12),('Zinco',13),
--   ('Hemoglobina Glicada',14),('Glicose',15),('Insulina',16),
--   ('Apolipoproteína A1',17),('Apolipoproteína B',18),
--   ('Proteínas Totais e Frações',19),('Proteína C Reativa',20),
--   ('Ácido Fólico',21),('Vitamina B12',22),('Vitamina C',23),('Vitamina A',24),
--   ('25 Vitamina D',25),('Amilase',26),('Bilirrubina total e frações',27),
--   ('Fosfatase alcalina',28),('Gama GT',29),('Lipase',30),
--   ('TGO/AST Aspartato Aminotransferase',31),('TGP/ALT Alanina Aminotransferase',32),
--   ('Creatinina',33),('Uréia',34),('Hemograma Completo',35),('Hb + Ht',36),
--   ('Plaquetas',37),('Coagulograma (TP e TTPA)',38),('TSH',39),('T4L',40),
--   ('T3',41),('T4',42),('Cortisol sérico',43),('Cortisol urinário',44),
--   ('Cortisol salivar',45),('Homocisteína',46),('Ácido Úrico',47),('Ferritina',48),
--   ('Ferro',49),('Transferrina',50),('LH+FSH',51),('Prolactina',52),
--   ('Estradiol',53),('Progesterona',54),('Testosterona',55),('Testosterona Livre',56)
-- ) v(nome,ord)
-- on conflict (clinic_id, nome) do nothing;

-- Servicos prestados, vacinas e vias de administração seguem o mesmo padrão —
-- descomentar e rodar após ter o id da clínica.

-- =============================================================================
-- FIM DO DDL
-- Próximos passos após executar:
--   1. Cadastre a clínica via Configurações → Identidade Visual.
--   2. Descomente e ajuste os seeds da Parte 20 com o id gerado.
--   3. Configure as variáveis de ambiente do frontend:
--        VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CPF_EMAIL_DOMAIN
--   4. Habilite Auth providers (Email, Google) no painel do Supabase.
--   5. Teste o login de um profissional admin antes de convidar a equipe.
-- =============================================================================
