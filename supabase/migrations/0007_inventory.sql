-- =============================================================================
-- 0007_inventory.sql
-- Controle de estoque estético com lote, validade, custo, venda, margem.
-- Movimentações registram entradas/saídas; saldo derivado das movimentações
-- e refletido em inventory.qtd_atual para consulta rápida.
-- =============================================================================

create table inventory (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  produto         text not null,
  marca           text,
  lote            text,
  validade        date,
  custo_unit      numeric(12,2) not null default 0,
  preco_venda     numeric(12,2) not null default 0,
  qtd_atual       numeric(12,2) not null default 0,
  qtd_minima      numeric(12,2) not null default 0,        -- gatilho de alerta de estoque mínimo
  unidade         text default 'un',
  categoria       text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_inventory_clinic on inventory(clinic_id);
create index idx_inventory_validade on inventory(validade);
create index idx_inventory_produto_trgm on inventory using gin (produto gin_trgm_ops);

create trigger trg_inventory_updated_at
  before update on inventory
  for each row execute function app.set_updated_at();

-- Coluna gerada: margem unitária (preço de venda - custo)
alter table inventory
  add column margem_unit numeric(12,2)
  generated always as (preco_venda - custo_unit) stored;

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  inventory_id    uuid not null references inventory(id) on delete cascade,
  tipo            stock_movement_type not null,
  quantidade      numeric(12,2) not null,
  custo_unit      numeric(12,2),
  preco_venda     numeric(12,2),
  procedure_id    uuid references procedures_log(id) on delete set null,  -- baixa por uso
  patient_id      uuid references patients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  motivo          text,
  data            timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_stock_mov_inventory on stock_movements(inventory_id);
create index idx_stock_mov_data on stock_movements(data);

-- Atualiza qtd_atual do inventário a cada movimentação ------------------------
create or replace function app.apply_stock_movement()
returns trigger
language plpgsql
as $$
declare
  delta numeric(12,2);
begin
  if (tg_op = 'INSERT') then
    delta := case
      when new.tipo = 'entrada' then new.quantidade
      when new.tipo = 'ajuste'  then new.quantidade          -- pode ser negativo
      else -abs(new.quantidade)                               -- saída_venda, saída_uso, perda
    end;
    update inventory set qtd_atual = qtd_atual + delta where id = new.inventory_id;
  end if;
  return new;
end;
$$;

create trigger trg_apply_stock_movement
  after insert on stock_movements
  for each row execute function app.apply_stock_movement();

comment on table inventory is 'Estoque com lote/validade/custo/venda; qtd_minima dispara alerta.';
comment on table stock_movements is 'Movimentações; baixa automática por procedimento/venda.';
comment on column inventory.margem_unit is 'Margem unitária calculada (preco_venda - custo_unit).';
