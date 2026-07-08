-- =============================================================================
-- 0049_ativo_anexo.sql — FASE 2 (parte 3)
-- Anexo de documento/arquivo no cadastro do Ativo (ex.: nota, ficha técnica).
-- Guarda o caminho no bucket privado 'admin-files' (mesmo dos anexos do módulo
-- Administrativo). Aditivo e idempotente.
-- =============================================================================

alter table active_ingredients
  add column if not exists anexo_url text;
