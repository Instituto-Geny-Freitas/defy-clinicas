-- =============================================================================
-- 0020_professional_provisional_password.sql
-- Mesma lógica de senha provisória, agora para a EQUIPE: quando o admin
-- provisiona o acesso de um profissional, marca senha_provisoria = true e o
-- profissional é obrigado a redefinir no 1º acesso por senha.
-- =============================================================================

alter table professionals
  add column if not exists senha_provisoria boolean not null default false;

comment on column professionals.senha_provisoria is
  'TRUE quando a senha foi definida pelo admin e o profissional ainda não a redefiniu.';
