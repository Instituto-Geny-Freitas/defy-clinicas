-- =============================================================================
-- 0036_proc_value_and_walkin.sql
-- 1) Procedimento avulso (sem plano/orçamento) ganha um valor a cobrar, para ser
--    importado em um orçamento posteriormente.
-- 2) Agendamento prévio sem cadastro: permite agendar com nome/telefone soltos
--    (patient_id passa a aceitar null), sinalizando cadastro pendente.
-- =============================================================================

alter table procedures_log
  add column if not exists valor_cobrado numeric(12,2) not null default 0;

alter table appointments
  alter column patient_id drop not null,
  add column if not exists nome_avulso     text,
  add column if not exists telefone_avulso text;
