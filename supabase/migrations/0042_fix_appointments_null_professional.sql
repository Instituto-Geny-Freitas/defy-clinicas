-- =============================================================================
-- 0042_fix_appointments_null_professional.sql
-- Vincula todos os agendamentos sem profissional (professional_id IS NULL)
-- à única profissional ativa da clínica.
-- Executar no SQL Editor do Supabase.
-- =============================================================================

update appointments
set professional_id = (
  select id from professionals where ativo = true order by created_at limit 1
)
where professional_id is null;
