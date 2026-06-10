-- =============================================================================
-- 0028_supplementation_paid.sql
-- Indicador de pago/não pago na suplementação. O orçamento importa os itens
-- "não pagos" como serviços a cobrar.
-- =============================================================================

alter table supplementations
  add column if not exists pago boolean not null default false;
