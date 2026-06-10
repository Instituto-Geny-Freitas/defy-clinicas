-- =============================================================================
-- 0029_cashflow.sql
-- Fluxo de caixa: tipos de despesa, despesas (com recorrência via grupo),
-- movimentos financeiros (caixa/aplicação/aporte). Suplementação ganha
-- fornecedor e valor de venda (puxados do ativo).
-- =============================================================================

create table if not exists expense_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  expense_type_id uuid references expense_types(id) on delete set null,
  descricao       text,
  valor           numeric(12,2) not null default 0,
  data            date not null default current_date,
  pago            boolean not null default false,
  recorrencia_grupo uuid,
  created_at      timestamptz not null default now()
);
create index if not exists idx_expenses_data on expenses(data);

create table if not exists financial_movements (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  tipo       text not null,           -- caixa | aplicacao | aporte
  descricao  text,
  valor      numeric(12,2) not null default 0,
  data       date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_fin_mov_data on financial_movements(data);

alter table supplementations
  add column if not exists fornecedor  text,
  add column if not exists valor_venda numeric(12,2) not null default 0;

alter table expense_types       enable row level security;
alter table expenses            enable row level security;
alter table financial_movements enable row level security;
create policy et_staff on expense_types       for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy ex_staff on expenses            for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy fm_staff on financial_movements for all to authenticated using (app.is_staff()) with check (app.is_staff());
