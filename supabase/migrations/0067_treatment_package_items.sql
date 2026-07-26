-- =============================================================================
-- 0067_treatment_package_items.sql — Pacotes 2.0 (itens, tipo e desconto)
--
-- O pacote ganha: tipo (procedimento OU suplementacao — exclusivo), desconto e
-- ITENS (treatment_package_items). "sessoes_compradas" continua no pacote (nível
-- do pacote) e vale para CADA item. valor_total = Σ(preço dos itens) ×
-- sessoes_compradas − desconto (calculado no app e gravado no pacote).
--
-- Consumo (Fase 5b): a realização (procedimento/suplementação) aponta para o
-- item do pacote via treatment_package_item_id; saldo do item = sessoes_compradas
-- − nº de realizações; excluir reverte. 100% aditivo. Pacotes antigos (sem itens)
-- seguem funcionando pelo modelo atual (package_sessions).
-- =============================================================================

alter table treatment_packages add column if not exists tipo text not null default 'procedimento' check (tipo in ('procedimento', 'suplementacao'));
alter table treatment_packages add column if not exists desconto numeric(12,2) not null default 0 check (desconto >= 0);

create table if not exists treatment_package_items (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  package_id           uuid not null references treatment_packages(id) on delete cascade,
  procedure_type_id    uuid references procedure_types(id) on delete set null,
  active_ingredient_id uuid references active_ingredients(id) on delete set null,
  nome                 text not null,
  preco_unit           numeric(12,2) not null default 0 check (preco_unit >= 0),
  ordem                int not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists idx_package_items_pkg on treatment_package_items(package_id);

alter table treatment_package_items enable row level security;
do $$ begin
  create policy pkg_items_staff on treatment_package_items for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pkg_items_patient_read on treatment_package_items for select to authenticated
    using (exists (select 1 from treatment_packages tp where tp.id = package_id and tp.patient_id = app.current_patient_id()));
exception when duplicate_object then null; end $$;

alter table procedures_log  add column if not exists treatment_package_item_id uuid references treatment_package_items(id) on delete set null;
alter table supplementations add column if not exists treatment_package_item_id uuid references treatment_package_items(id) on delete set null;
create index if not exists idx_proc_pkg_item on procedures_log(treatment_package_item_id);
create index if not exists idx_supl_pkg_item on supplementations(treatment_package_item_id);
