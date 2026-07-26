-- =============================================================================
-- 0064_procedure_prices.sql — Preço do procedimento com histórico por vigência
--
-- O tipo de procedimento (procedure_types) ganha um HISTÓRICO de preços
-- (procedure_type_prices). O preço vigente numa data é o registro com o maior
-- vigencia_inicio <= aquela data. Registra reajuste_pct, valor_anterior e
-- created_by (quem ajustou) para auditoria. 100% aditivo e idempotente.
-- Nada é gravado nos tipos existentes; tipos sem preço aparecem "sem valor".
-- =============================================================================

create table if not exists procedure_type_prices (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  procedure_type_id uuid not null references procedure_types(id) on delete cascade,
  valor             numeric(12,2) not null default 0 check (valor >= 0),
  vigencia_inicio   date not null default current_date,
  reajuste_pct      numeric(6,2),      -- % informado no reajuste (nulo se manual/inicial)
  valor_anterior    numeric(12,2),     -- valor vigente antes deste (auditoria)
  created_by        uuid references professionals(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_proc_prices_type on procedure_type_prices(procedure_type_id, vigencia_inicio desc);

alter table procedure_type_prices enable row level security;
do $$ begin
  create policy proc_prices_staff on procedure_type_prices for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

-- Preço vigente HOJE por tipo (maior vigencia_inicio <= current_date).
create or replace view v_procedure_type_current_price
with (security_invoker = true) as
select distinct on (procedure_type_id)
  procedure_type_id, valor, vigencia_inicio
from procedure_type_prices
where vigencia_inicio <= current_date
order by procedure_type_id, vigencia_inicio desc, created_at desc;

grant select on v_procedure_type_current_price to authenticated;
