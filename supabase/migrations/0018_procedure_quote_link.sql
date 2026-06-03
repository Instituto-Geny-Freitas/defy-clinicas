-- =============================================================================
-- 0018_procedure_quote_link.sql
-- Vincula o procedimento ao orçamento (quote) ao qual pertence. Assim os
-- produtos utilizados no procedimento (procedures_log.produtos_usados) podem ser
-- listados dentro do orçamento — visíveis ao paciente e ao profissional —
-- mantendo a integridade entre estoque, atendimento e financeiro.
-- =============================================================================

alter table procedures_log
  add column if not exists quote_id uuid references quotes(id) on delete set null;

create index if not exists idx_procedures_quote on procedures_log(quote_id);

comment on column procedures_log.quote_id is
  'Orçamento ao qual este procedimento (e seus produtos utilizados) está vinculado.';
