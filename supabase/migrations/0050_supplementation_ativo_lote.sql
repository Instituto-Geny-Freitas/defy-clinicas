-- =============================================================================
-- 0050_supplementation_ativo_lote.sql — FASE 3.2
-- Vincula a suplementação ao LOTE do ativo usado e registra a quantidade, para
-- dar baixa no estoque do ativo (controle sanitário: qual lote foi no paciente).
-- Aditivo e idempotente. Registros antigos ficam com ativo_lote_id nulo e
-- quantidade 1 (não geram baixa retroativa — não havia controle de estoque).
-- =============================================================================

alter table supplementations
  add column if not exists ativo_lote_id uuid references ativo_lotes(id) on delete set null,
  add column if not exists quantidade    numeric(12,2) not null default 1;
