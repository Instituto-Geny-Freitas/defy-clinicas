-- =============================================================================
-- 0017_patient_lgpd_consent.sql
-- Consentimento LGPD por paciente: registra quando e qual versão do termo de
-- tratamento de dados foi aceita. O texto/versão vigente da clínica fica em
-- clinics.dados_empresa->'lgpd' (gerenciado em Configurações → LGPD).
-- =============================================================================

alter table patients
  add column if not exists consentimento_lgpd_em      timestamptz,
  add column if not exists consentimento_lgpd_versao   text;

comment on column patients.consentimento_lgpd_em is
  'Data/hora do consentimento LGPD do paciente (tratamento de dados).';
comment on column patients.consentimento_lgpd_versao is
  'Versão do termo de tratamento de dados aceita pelo paciente.';
