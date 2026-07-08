-- =============================================================================
-- 0047_stock_lots_foundation.sql  — FASE 1: fundação de estoque por LOTE
-- =============================================================================
-- Normaliza Estoque e Ativos para a relação 1 (produto/ativo) -> N lotes
-- (fornecedor, lote, validade, quantidade, custo, preço). Cria domínio de
-- Unidades e estoque mínimo no nível do produto/ativo. Introduz movimentações
-- de estoque para Ativos (que não existiam).
--
-- 100% ADITIVO E IDEMPOTENTE — não remove nem altera colunas existentes.
-- PRESERVAÇÃO DE DADOS:
--   • cada `inventory` existente vira 1 `inventory_lots` (mesmos marca/lote/
--     validade/qtd/custo/preço);
--   • cada `active_ingredient` vira 1 `ativo_lotes` (qtd 0 — não havia controle
--     de quantidade; o admin lança os saldos depois, na Fase 2);
--   • cada `stock_movements` recebe `lot_id` apontando para o lote migrado.
-- NESTA FASE o comportamento das telas NÃO muda: `inventory.qtd_atual` segue
-- autoritativo (trigger atual intacto). Os lotes passam a ser fonte de verdade
-- na Fase 2, quando as entradas/saídas ficarem cientes de lote (haverá uma
-- reconciliação de saldo no início da Fase 2).
-- =============================================================================

begin;

-- 1) Domínio: Unidades de medida ---------------------------------------------
create table if not exists unidades (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  abreviacao text,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);
alter table unidades enable row level security;
do $$ begin
  create policy unidades_staff_read on unidades for select to authenticated using (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy unidades_admin_write on unidades for all to authenticated using (app.is_admin()) with check (app.is_admin());
exception when duplicate_object then null; end $$;

insert into unidades (clinic_id, nome, abreviacao, ordem)
select c.id, v.nome, v.abrev, v.ord
from clinics c
cross join (values
  ('Unidade','un',1),('Ampola','amp',2),('Caixa','cx',3),('Frasco','fr',4),
  ('Seringa','ser',5),('Mililitro','ml',6),('Grama','g',7),('Miligrama','mg',8),
  ('Comprimido','cp',9),('Sachê','sac',10)
) as v(nome, abrev, ord)
on conflict (clinic_id, nome) do nothing;

-- 2) Estoque: produto (inventory) -> N lotes ---------------------------------
create table if not exists inventory_lots (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  inventory_id uuid not null references inventory(id) on delete cascade,
  marca        text,
  lote         text,
  validade     date,
  qtd_atual    numeric(12,2) not null default 0,
  custo_unit   numeric(12,2) not null default 0,
  preco_venda  numeric(12,2) not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_inv_lots_inventory on inventory_lots(inventory_id);
create index if not exists idx_inv_lots_validade on inventory_lots(validade);
alter table inventory_lots enable row level security;
do $$ begin
  create policy inv_lots_staff_all on inventory_lots for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_inv_lots_updated_at before update on inventory_lots
    for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

-- Backfill: um lote por produto existente (só se ainda não houver lote)
insert into inventory_lots (clinic_id, inventory_id, marca, lote, validade, qtd_atual, custo_unit, preco_venda, ativo, created_at)
select i.clinic_id, i.id, i.marca, i.lote, i.validade, i.qtd_atual, i.custo_unit, i.preco_venda, i.ativo, i.created_at
from inventory i
where not exists (select 1 from inventory_lots l where l.inventory_id = i.id);

-- 3) stock_movements ganha lot_id e retroaponta ao lote migrado --------------
alter table stock_movements add column if not exists lot_id uuid references inventory_lots(id) on delete set null;
create index if not exists idx_stock_mov_lot on stock_movements(lot_id);
update stock_movements sm
set lot_id = l.id
from inventory_lots l
where l.inventory_id = sm.inventory_id and sm.lot_id is null;

-- 4) Ativos: unidade + estoque mínimo + N lotes ------------------------------
alter table active_ingredients
  add column if not exists unidade        text,
  add column if not exists estoque_minimo numeric(12,2) not null default 0;

create table if not exists ativo_lotes (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  ativo_id        uuid not null references active_ingredients(id) on delete cascade,
  fornecedor      text,
  lote            text,
  validade        date,
  qtd_atual       numeric(12,2) not null default 0,
  custo_aquisicao numeric(12,2) not null default 0,
  margem_pct      numeric(6,2)  not null default 0,
  preco_venda     numeric(12,2) not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_ativo_lotes_ativo on ativo_lotes(ativo_id);
create index if not exists idx_ativo_lotes_validade on ativo_lotes(validade);
alter table ativo_lotes enable row level security;
do $$ begin
  create policy ativo_lotes_staff_all on ativo_lotes for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_ativo_lotes_updated_at before update on ativo_lotes
    for each row execute function app.set_updated_at();
exception when duplicate_object then null; end $$;

-- Backfill: um lote por ativo (qtd 0). Preserva fornecedor/lote/validade/preços.
insert into ativo_lotes (clinic_id, ativo_id, fornecedor, lote, validade, qtd_atual, custo_aquisicao, margem_pct, preco_venda, ativo, created_at)
select a.clinic_id, a.id, a.fornecedor, a.lote, a.validade, 0, a.preco_aquisicao, a.margem_pct, a.preco_venda, a.ativo, a.created_at
from active_ingredients a
where not exists (select 1 from ativo_lotes l where l.ativo_id = a.id);

-- 5) Movimentações de estoque de ATIVO (não existiam antes) ------------------
create table if not exists ativo_movements (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  ativo_lote_id      uuid not null references ativo_lotes(id) on delete cascade,
  tipo               stock_movement_type not null,
  quantidade         numeric(12,2) not null,
  custo_aquisicao    numeric(12,2),
  preco_venda        numeric(12,2),
  patient_id         uuid references patients(id) on delete set null,
  professional_id    uuid references professionals(id) on delete set null,
  supplementation_id uuid references supplementations(id) on delete set null,
  motivo             text,
  data               timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index if not exists idx_ativo_mov_lote on ativo_movements(ativo_lote_id);
alter table ativo_movements enable row level security;
do $$ begin
  create policy ativo_mov_staff_all on ativo_movements for all to authenticated using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

-- Saldo do lote de ativo (mesma lógica do estoque; só no INSERT).
create or replace function app.apply_ativo_movement()
returns trigger language plpgsql as $$
declare delta numeric(12,2);
begin
  if (tg_op = 'INSERT') then
    delta := case
      when new.tipo = 'entrada' then new.quantidade
      when new.tipo = 'ajuste'  then new.quantidade
      else -abs(new.quantidade)
    end;
    update ativo_lotes set qtd_atual = qtd_atual + delta, updated_at = now() where id = new.ativo_lote_id;
  end if;
  return new;
end;
$$;
do $$ begin
  create trigger trg_apply_ativo_movement after insert on ativo_movements
    for each row execute function app.apply_ativo_movement();
exception when duplicate_object then null; end $$;

commit;

-- =============================================================================
-- VERIFICAÇÃO (rode após aplicar; todos devem casar):
--   select (select count(*) from inventory)      as produtos,
--          (select count(*) from inventory_lots) as lotes_estoque;   -- devem ser iguais
--   select (select count(*) from active_ingredients) as ativos,
--          (select count(*) from ativo_lotes)        as lotes_ativos; -- devem ser iguais
--   select count(*) as movimentos_sem_lote from stock_movements where lot_id is null; -- deve ser 0
-- =============================================================================
