-- =============================================================================
-- 0031_shared_docs_quote.sql
-- Vincula um documento compartilhado (PDF) a um orçamento, para que o sistema
-- saiba quais orçamentos já foram gerados/enviados ao paciente.
-- =============================================================================

alter table shared_documents
  add column if not exists quote_id uuid references quotes(id) on delete set null;

create index if not exists idx_shared_docs_quote on shared_documents(quote_id);
