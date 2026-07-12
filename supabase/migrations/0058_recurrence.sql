-- =============================================================================
-- 0058_recurrence.sql — Recorrência recomendada de procedimentos/suplementações
--
-- Ao criar um procedimento ou suplementação, o profissional pode registrar a
-- recorrência recomendada (mensal/bimestral/trimestral/semestral/anual) e com
-- quantos dias de antecedência alertar. O sistema gera lembretes de retorno
-- para a equipe (Dashboard/Assistente) e para o paciente (portal).
--
-- 100% aditivo/idempotente. Tabela nova; nada nas tabelas existentes muda.
-- =============================================================================
begin;

create table if not exists recurrence_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  patient_id         uuid not null references patients(id) on delete cascade,
  professional_id    uuid references professionals(id) on delete set null,
  tipo               text not null check (tipo in ('procedimento', 'suplementacao')),
  procedure_id       uuid references procedures_log(id) on delete cascade,
  supplementation_id uuid references supplementations(id) on delete cascade,
  descricao          text not null,                 -- nome do procedimento / medicação (exibição)
  periodicidade      text not null check (periodicidade in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dias_antecedencia  int  not null default 7 check (dias_antecedencia >= 0 and dias_antecedencia <= 365),
  data_base          date not null,                 -- data do atendimento/suplementação inicial
  proxima_data       date not null,                 -- próximo retorno recomendado (data_base + período)
  status             text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_recur_clinic_status on recurrence_recommendations(clinic_id, status);
create index if not exists idx_recur_patient on recurrence_recommendations(patient_id);

alter table recurrence_recommendations enable row level security;
do $$ begin
  create policy recur_staff on recurrence_recommendations for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy recur_patient_read on recurrence_recommendations for select to authenticated
    using (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_recur_updated_at before update on recurrence_recommendations
    for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

commit;
