-- =============================================================================
-- 0019_patient_provisional_password.sql
-- Marca quando o paciente está com SENHA PROVISÓRIA (definida pela clínica no
-- cadastro). No primeiro acesso por senha, o app obriga a redefinir. Logins por
-- Google (OAuth) ignoram essa regra (não há senha a trocar).
-- =============================================================================

alter table patients
  add column if not exists senha_provisoria boolean not null default false;

comment on column patients.senha_provisoria is
  'TRUE quando a senha foi definida pela clínica e o paciente ainda não a redefiniu (força troca no 1º acesso por senha).';
