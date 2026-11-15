-- 0080_document_govbr.sql
-- Assinatura de termos pelo Gov.br. Aditivo e idempotente (sem blocos $$).
-- Após a ciência no aplicativo (fluxo existente, inalterado), o paciente baixa o
-- PDF do termo, assina no Gov.br (assinador.iti.br) e envia o PDF assinado.
-- O arquivo fica no bucket PRIVADO patient-files, na pasta do próprio paciente
-- (<patient_id>/termos_govbr/...) — as políticas de storage existentes (0011)
-- já restringem a leitura à equipe e ao paciente dono.
-- O paciente grava estas colunas pela política existente doc_instances_patient_sign.

alter table document_instances add column if not exists govbr_arquivo_url text;
alter table document_instances add column if not exists govbr_enviado_em timestamptz;

comment on column document_instances.govbr_arquivo_url is
  'Caminho (bucket patient-files) do PDF assinado pelo paciente no Gov.br.';
comment on column document_instances.govbr_enviado_em is
  'Quando o paciente enviou o PDF assinado pelo Gov.br.';

-- Integridade: o arquivo precisa estar na pasta do PRÓPRIO paciente do documento
-- (impede apontar para arquivo de outro paciente).
alter table document_instances drop constraint if exists document_instances_govbr_path_chk;
alter table document_instances add constraint document_instances_govbr_path_chk
  check (govbr_arquivo_url is null or govbr_arquivo_url like (patient_id::text || '/%'));
