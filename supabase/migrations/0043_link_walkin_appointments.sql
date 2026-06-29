-- Vincula agendamentos avulsos (patient_id IS NULL) aos pacientes já cadastrados.
-- Caso: nome_avulso = 'Mariceide Valença dos Santos' → paciente 'Mariceide Valença dos Santos'
-- Caso: nome_avulso = 'Junior Vieira'                → paciente 'Omar Bezerra Lima Junior'
-- Caso: nome_avulso = 'Cris'                         → paciente 'Maria Cristina J. Silva'
-- Também linka quaisquer ocorrências do mesmo recorrencia_grupo que ainda estejam sem paciente.

DO $$
DECLARE
  pid_mariceide uuid;
  pid_omar      uuid;
  pid_cris      uuid;
BEGIN

  -- Busca os IDs dos pacientes cadastrados
  SELECT id INTO pid_mariceide FROM patients WHERE nome ILIKE 'Mariceide Valença dos Santos' AND ativo = true LIMIT 1;
  SELECT id INTO pid_omar      FROM patients WHERE nome ILIKE 'Omar Bezerra Lima Junior'      AND ativo = true LIMIT 1;
  SELECT id INTO pid_cris      FROM patients WHERE nome ILIKE 'Maria Cristina J. Silva'       AND ativo = true LIMIT 1;

  -- Mariceide: atualiza pelo nome_avulso E pela série recorrente
  IF pid_mariceide IS NOT NULL THEN
    UPDATE appointments
      SET patient_id = pid_mariceide, nome_avulso = NULL, telefone_avulso = NULL
      WHERE patient_id IS NULL
        AND (
          nome_avulso ILIKE '%Mariceide%'
          OR recorrencia_grupo IN (
            SELECT DISTINCT recorrencia_grupo FROM appointments
            WHERE nome_avulso ILIKE '%Mariceide%' AND recorrencia_grupo IS NOT NULL
          )
        );
  END IF;

  -- Junior Vieira → Omar Bezerra Lima Junior
  IF pid_omar IS NOT NULL THEN
    UPDATE appointments
      SET patient_id = pid_omar, nome_avulso = NULL, telefone_avulso = NULL
      WHERE patient_id IS NULL
        AND (
          nome_avulso ILIKE '%Junior Vieira%'
          OR recorrencia_grupo IN (
            SELECT DISTINCT recorrencia_grupo FROM appointments
            WHERE nome_avulso ILIKE '%Junior Vieira%' AND recorrencia_grupo IS NOT NULL
          )
        );
  END IF;

  -- Cris → Maria Cristina J. Silva (termo curto, filtro estrito para não pegar outros)
  IF pid_cris IS NOT NULL THEN
    UPDATE appointments
      SET patient_id = pid_cris, nome_avulso = NULL, telefone_avulso = NULL
      WHERE patient_id IS NULL
        AND (
          nome_avulso ILIKE 'Cris'
          OR nome_avulso ILIKE 'Cris %'
          OR recorrencia_grupo IN (
            SELECT DISTINCT recorrencia_grupo FROM appointments
            WHERE (nome_avulso ILIKE 'Cris' OR nome_avulso ILIKE 'Cris %')
              AND recorrencia_grupo IS NOT NULL
          )
        );
  END IF;

END $$;
