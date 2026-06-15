-- =============================================================================
-- 0032_expense_classification.sql
-- Classificação de despesas (Produto x Gasto fixo), forma de pagamento
-- (Pix/Cartão) e controle de parcelas para compras parceladas.
-- =============================================================================

-- Tipo de despesa ganha a natureza padrão (produto | fixo).
alter table expense_types
  add column if not exists tipo text not null default 'fixo';

-- Despesas: classificação, forma de pagamento e parcelamento.
alter table expenses
  add column if not exists classificacao   text not null default 'fixo',   -- produto | fixo
  add column if not exists forma_pagamento text,                            -- pix | cartao | outro
  add column if not exists parcela_num     integer,
  add column if not exists parcela_total   integer;
