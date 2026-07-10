-- =============================================================================
-- 0054_nps.sql — NPS pós-atendimento (pesquisa de satisfação)
-- Uma resposta = nota 0–10 ("quanto recomendaria a clínica?") + comentário.
-- NPS = %promotores(9-10) − %detratores(0-6). 100% aditivo.
-- =============================================================================

create table if not exists nps_responses (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  patient_id     uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  score          int  not null check (score between 0 and 10),
  comentario     text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_nps_patient on nps_responses(patient_id);
create index if not exists idx_nps_created on nps_responses(created_at);

alter table nps_responses enable row level security;
do $$ begin
  create policy nps_staff_read on nps_responses for select to authenticated using (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy nps_patient_read on nps_responses for select to authenticated using (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy nps_patient_insert on nps_responses for insert to authenticated with check (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
