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
