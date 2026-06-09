-- =============================================================================
-- 0027_prescription_nome.sql
-- Guarda o NOME da fórmula no momento da designação (snapshot), para que a lista
-- de manipulações do paciente sempre exiba o nome — mesmo que a fórmula da
-- biblioteca seja editada ou excluída depois.
-- =============================================================================

alter table formulation_prescriptions
  add column if not exists nome text;
