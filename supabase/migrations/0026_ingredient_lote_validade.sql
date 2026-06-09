-- =============================================================================
-- 0026_ingredient_lote_validade.sql
-- Lote e validade no cadastro de ativos.
-- =============================================================================

alter table active_ingredients
  add column if not exists lote     text,
  add column if not exists validade date;
