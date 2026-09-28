-- 0075_document_type_natures.sql
-- Naturezas de documento personalizáveis. Aditivo e idempotente.
-- Hoje a natureza é fixa (termo/orientacao) e define o comportamento do modelo:
--   termo = pede assinatura do paciente; orientacao = permite lembretes.
-- Passa a ser possível criar naturezas próprias (ex.: "Receita", "Ficha"), cada
-- uma escolhendo um COMPORTAMENTO-BASE (termo ou orientacao). A lista de naturezas
-- personalizadas vive em clinics.dados_empresa.doc_naturezas (sem tabela nova,
-- seguindo o padrão de admin_forms/permissoes). Aqui só guardamos, em cada tipo
-- de documento, QUAL natureza foi escolhida — a coluna `natureza` continua com o
-- comportamento-base (mantendo o comportamento dos modelos inalterado).

alter table document_types add column if not exists natureza_key text;
comment on column document_types.natureza_key is
  'Chave da natureza escolhida (built-in termo/orientacao ou personalizada em clinics.dados_empresa.doc_naturezas). A coluna natureza guarda o comportamento-base.';

-- Backfill: tipos existentes usam a própria natureza-base como chave.
update document_types set natureza_key = natureza where natureza_key is null;
