-- =============================================================================
-- 0061_crm_activities.sql — Histórico de interações/follow-ups por lead (CRM)
--
-- Cada linha é um registro imutável na timeline do lead: nota, ligação, WhatsApp,
-- e-mail, reunião, mudança de etapa (auto) ou outro. 100% aditivo/idempotente.
-- =============================================================================
begin;

create table if not exists crm_lead_activities (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  lead_id     uuid not null references crm_leads(id) on delete cascade,
  tipo        text not null default 'nota'
                check (tipo in ('nota', 'ligacao', 'whatsapp', 'email', 'reuniao', 'etapa', 'outro')),
  nota        text,
  created_by  uuid references professionals(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_crm_act_lead on crm_lead_activities(lead_id, created_at desc);

alter table crm_lead_activities enable row level security;
do $$ begin
  create policy crm_act_staff on crm_lead_activities for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

commit;
