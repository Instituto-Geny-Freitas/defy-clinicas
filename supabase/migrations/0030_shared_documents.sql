-- =============================================================================
-- 0030_shared_documents.sql
-- Documentos (PDFs) gerados pelo profissional e compartilhados:
--   • com o paciente  -> aparece na aba Documentos do portal.
--   • com um fornecedor -> via WhatsApp (preparado; envio real depende de
--     integração configurada em Configurações → Integrações).
-- Os arquivos ficam no bucket privado patient-files, sob a pasta do paciente,
-- portanto reutilizam as políticas de storage existentes (0011).
-- =============================================================================

create table if not exists shared_documents (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  categoria       text not null default 'manipulacao',  -- manipulacao | outro
  titulo          text not null,
  arquivo_url     text not null,                          -- path no bucket patient-files
  enviado_paciente        boolean not null default false,
  fornecedor_nome         text,
  fornecedor_whatsapp     text,
  enviado_fornecedor_em   timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_shared_docs_patient on shared_documents(patient_id);

alter table shared_documents enable row level security;
create policy sd_staff on shared_documents for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy sd_patient_read on shared_documents for select to authenticated
  using (patient_id = app.current_patient_id() and enviado_paciente = true);
