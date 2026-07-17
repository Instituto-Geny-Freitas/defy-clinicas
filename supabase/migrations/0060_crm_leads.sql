-- =============================================================================
-- 0060_crm_leads.sql — CRM / funil comercial (leads antes de virarem pacientes)
--
-- Capta prospects e acompanha o funil: novo → contato → avaliação → orçamento →
-- ganho (ou perdido). Ao fechar, o lead pode ser convertido em paciente
-- (patient_id). 100% aditivo/idempotente.
-- =============================================================================
begin;

create table if not exists crm_leads (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  nome            text not null,
  whatsapp        text,
  email           text,
  origem          text,              -- Instagram, Indicação, WhatsApp, Google...
  interesse       text,              -- procedimento/serviço de interesse
  etapa           text not null default 'novo'
                    check (etapa in ('novo', 'contato', 'avaliacao', 'orcamento', 'ganho', 'perdido')),
  responsavel_id  uuid references professionals(id) on delete set null,
  valor_estimado  numeric(12,2) not null default 0,
  proxima_acao    date,              -- data do próximo follow-up
  observacoes     text,
  motivo_perda    text,              -- preenchido quando etapa = 'perdido'
  patient_id      uuid references patients(id) on delete set null, -- quando convertido
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_crm_leads_clinic_etapa on crm_leads(clinic_id, etapa);
create index if not exists idx_crm_leads_proxima on crm_leads(proxima_acao);

alter table crm_leads enable row level security;
do $$ begin
  create policy crm_leads_staff on crm_leads for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_crm_leads_updated_at before update on crm_leads
    for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

commit;
