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
