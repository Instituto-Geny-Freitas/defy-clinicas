-- =============================================================================
-- 0048_stock_movement_lot_aware.sql — FASE 2 (parte 1)
-- Torna o gatilho de estoque ciente de LOTE, sem quebrar o total do produto.
--
-- • O total do produto (inventory.qtd_atual) continua sendo atualizado por TODAS
--   as movimentações (como hoje) — permanece autoritativo e sempre correto.
-- • QUANDO a movimentação tiver lot_id, o saldo do LOTE também é atualizado.
-- Assim as entradas por lote (Fase 2) mantêm produto e lote sincronizados; as
-- saídas por uso (ainda sem lote até a Fase 3) continuam debitando o produto.
--
-- Também reconcilia lotes únicos com o total do produto, caso tenha havido
-- alguma "+Entrada" na janela entre a Fase 1 e agora (o produto recebeu, o lote
-- ainda não). Só afeta produtos com exatamente 1 lote — não há ambiguidade.
-- =============================================================================

begin;

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
    -- total do produto (sempre)
    update inventory set qtd_atual = qtd_atual + delta where id = new.inventory_id;
    -- saldo do lote (quando informado)
    if new.lot_id is not null then
      update inventory_lots set qtd_atual = qtd_atual + delta, updated_at = now() where id = new.lot_id;
    end if;
  end if;
  return new;
end;
$$;

-- Reconciliação: lotes únicos recebem o total atual do produto.
update inventory_lots l
set qtd_atual = i.qtd_atual, updated_at = now()
from inventory i
where l.inventory_id = i.id
  and (select count(*) from inventory_lots l2 where l2.inventory_id = i.id) = 1
  and l.qtd_atual <> i.qtd_atual;

commit;
