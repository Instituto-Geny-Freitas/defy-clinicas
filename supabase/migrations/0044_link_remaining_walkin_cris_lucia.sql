-- =============================================================================
-- 0044_link_remaining_walkin_cris_lucia.sql
-- Remove da lista "Regularizar agendamento prévio" os agendamentos de:
--   • "Cris"               → Maria Cristina J. Silva (já cadastrada)
--   • "LUCIA DE FATIMA VIEIRA" → paciente já cadastrada com nome semelhante
-- =============================================================================

DO $$
DECLARE
  pid_cris  uuid;
  pid_lucia uuid;
BEGIN

  -- ── Cris → Maria Cristina J. Silva ─────────────────────────────────────────
  SELECT id INTO pid_cris
  FROM patients
  WHERE nome ILIKE '%Maria Cristina%' AND ativo = true
  ORDER BY created_at
  LIMIT 1;

  IF pid_cris IS NOT NULL THEN
    UPDATE appointments
      SET patient_id       = pid_cris,
          nome_avulso      = NULL,
          telefone_avulso  = NULL
    WHERE patient_id IS NULL
      AND (
        nome_avulso ILIKE '%Cris%'
        OR nome_avulso ILIKE '%cristina%'
      );
    RAISE NOTICE 'Cris → % — agendamentos vinculados', pid_cris;
  ELSE
    RAISE WARNING 'Paciente Maria Cristina não encontrada — verifique o nome no cadastro.';
  END IF;

  -- ── Lucia de Fatima Vieira ──────────────────────────────────────────────────
  SELECT id INTO pid_lucia
  FROM patients
  WHERE (
    nome ILIKE '%Lucia de Fatima Vieira%'
    OR nome ILIKE '%Lúcia de Fátima Vieira%'
    OR nome ILIKE '%Lucia de Fátima Vieira%'
  )
  AND ativo = true
  ORDER BY created_at
  LIMIT 1;

  -- fallback: busca só pelo sobrenome + nome parcial
  IF pid_lucia IS NULL THEN
    SELECT id INTO pid_lucia
    FROM patients
    WHERE nome ILIKE '%Lucia%Vieira%' AND ativo = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF pid_lucia IS NOT NULL THEN
    UPDATE appointments
      SET patient_id       = pid_lucia,
          nome_avulso      = NULL,
          telefone_avulso  = NULL
    WHERE patient_id IS NULL
      AND (
        nome_avulso ILIKE '%Lucia de Fatima%'
        OR nome_avulso ILIKE '%Lúcia de Fátima%'
        OR nome_avulso ILIKE '%Lucia de Fátima%'
        OR nome_avulso ILIKE '%LUCIA DE FATIMA%'
      );
    RAISE NOTICE 'Lucia → % — agendamentos vinculados', pid_lucia;
  ELSE
    RAISE WARNING 'Paciente Lucia de Fatima Vieira não encontrada — verifique o nome no cadastro.';
  END IF;

END $$;
