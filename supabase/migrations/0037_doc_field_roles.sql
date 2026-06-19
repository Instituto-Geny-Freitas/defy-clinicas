-- =============================================================================
-- 0037_doc_field_roles.sql
-- Hash de autenticidade da ciência do paciente (auditoria), guardado na própria
-- instância do documento emitido. Os flags por campo (preenchido por profissional/
-- paciente/sistema e fonte automática) ficam no JSON do schema do modelo, sem
-- necessidade de coluna.
-- =============================================================================

alter table document_instances
  add column if not exists assinatura_hash text;
