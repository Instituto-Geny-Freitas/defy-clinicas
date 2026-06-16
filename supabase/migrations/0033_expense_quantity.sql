-- =============================================================================
-- 0033_expense_quantity.sql
-- Quantidade de itens de uma despesa (informada no registro), usada nas
-- estatísticas do relatório financeiro.
-- =============================================================================

alter table expenses
  add column if not exists quantidade integer not null default 1;
