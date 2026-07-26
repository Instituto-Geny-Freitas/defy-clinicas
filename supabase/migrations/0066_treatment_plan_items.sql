-- =============================================================================
-- 0066_treatment_plan_items.sql — Itens do plano de tratamento
--
-- O plano ganha ITENS (procedimentos/suplementações) com sessões, frequência e
-- preço em SNAPSHOT (por item). Os campos de sessão/frequência no nível do plano
-- (num_sessoes/frequencia) são mantidos como estão (legado/complemento).
--
-- Consumo/efetivação (Fase 4b): a realização (procedimento/suplementação) aponta
-- para o item do plano via treatment_plan_item_id; o saldo do item = sessões −
-- nº de realizações; excluir a realização reverte automaticamente. 100% aditivo.
-- =============================================================================

create table if not exists treatment_plan_items (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  treatment_plan_id    uuid not null references treatment_plans(id) on delete cascade,
  tipo                 text not null check (tipo in ('procedimento', 'suplementacao')),
  procedure_type_id    uuid references procedure_types(id) on delete set null,
  active_ingredient_id uuid references active_ingredients(id) on delete set null,
  nome                 text not null,                          -- snapshot do rótulo
  preco_unit           numeric(12,2) not null default 0 check (preco_unit >= 0),  -- snapshot do preço
  sessoes              integer not null default 1 check (sessoes > 0),
  frequencia           text,
  ordem                int not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists idx_plan_items_plan on treatment_plan_items(treatment_plan_id);

alter table treatment_plan_items enable row level security;
do $$ begin
  create policy plan_items_staff on treatment_plan_items for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy plan_items_patient_read on treatment_plan_items for select to authenticated
    using (exists (select 1 from treatment_plans tp where tp.id = treatment_plan_id and tp.patient_id = app.current_patient_id()));
exception when duplicate_object then null; end $$;

-- Consumo: a realização aponta para o item do plano (nulo = avulso/sem plano).
alter table procedures_log  add column if not exists treatment_plan_item_id uuid references treatment_plan_items(id) on delete set null;
alter table supplementations add column if not exists treatment_plan_item_id uuid references treatment_plan_items(id) on delete set null;
create index if not exists idx_proc_plan_item on procedures_log(treatment_plan_item_id);
create index if not exists idx_supl_plan_item on supplementations(treatment_plan_item_id);
