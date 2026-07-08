-- =============================================================================
-- 0046_unique_patient_email.sql
-- Impede dois pacientes ATIVOS com o mesmo e-mail (case-insensitive — a coluna
-- já é citext). Isso é crítico para o login: o usuário de autenticação do
-- Supabase é único por e-mail; dois pacientes no mesmo e-mail fazem um cair no
-- cadastro do outro ao acessar o portal.
--
-- NÃO afeta agendamentos de pacientes sem cadastro (walk-ins): estes usam
-- nome_avulso/telefone_avulso e patient_id nulo — não têm e-mail nem entram
-- neste índice.
--
-- IMPORTANTE: se houver duplicados ativos, o CREATE INDEX falha. Rode antes a
-- query de detecção abaixo e resolva os casos (corrigir/limpar e-mail) primeiro.
-- =============================================================================

-- Detecção (informativo — rode manualmente se o índice falhar):
--   select lower(email::text) as email, count(*) , array_agg(id) as pacientes
--   from patients
--   where ativo and email is not null and email::text <> ''
--   group by lower(email::text)
--   having count(*) > 1;

create unique index if not exists uq_patients_email_ativo
  on patients (clinic_id, email)
  where email is not null and email::text <> '' and ativo;
