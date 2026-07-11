-- =============================================================================
-- 0056_loyalty.sql — Programa de fidelidade (cashback em crédito)
--
-- Cashback = % configurável sobre os pagamentos REAIS do paciente, concedido
-- pela equipe como CRÉDITO (reutiliza [[v_patient_credits]] via
-- patient_credit_grants). Para separar a origem dos créditos concedidos,
-- adiciona-se a coluna `tipo` em patient_credit_grants.
--
-- 100% aditivo e idempotente. NÃO altera crédito/indicação existentes: o
-- backfill apenas rotula os grants antigos (indicação = tem referral_patient_id).
-- =============================================================================

-- Origem do crédito concedido: 'manual' | 'indicacao' | 'cashback'
alter table patient_credit_grants add column if not exists tipo text not null default 'manual';

-- Rotula os grants existentes de indicação (os que apontam para o indicado).
update patient_credit_grants set tipo = 'indicacao'
where referral_patient_id is not null and tipo = 'manual';

do $$ begin
  alter table patient_credit_grants
    add constraint ck_credit_grants_tipo check (tipo in ('manual', 'indicacao', 'cashback'));
exception when duplicate_object then null; end $$;

create index if not exists idx_credit_grants_tipo on patient_credit_grants(tipo);
