-- =============================================================================
-- 0055_referral.sql — Programa de indicação (member-get-member)
--
-- Cada paciente ganha um código de indicação (gerado automaticamente). Ao
-- cadastrar um novo paciente, a equipe pode registrar "indicado por" (quem
-- indicou). Quando o indicado converte (faz um pagamento), a equipe concede
-- uma recompensa em CRÉDITO ao indicador — reutilizando o crédito do paciente
-- ([[v_patient_credits]]), que é abatido em pagamentos futuros como 'credito'.
--
-- A recompensa é um lançamento em patient_credit_grants (ledger de créditos
-- concedidos), somado ao credito_gerado da view. 100% aditivo e idempotente.
-- =============================================================================

-- 1) Código de indicação + quem indicou -------------------------------------
alter table patients add column if not exists codigo_indicacao text;
alter table patients add column if not exists indicado_por_patient_id uuid references patients(id) on delete set null;

create unique index if not exists uq_patients_codigo_indicacao on patients(codigo_indicacao) where codigo_indicacao is not null;
create index if not exists idx_patients_indicado_por on patients(indicado_por_patient_id);

-- Gera um código único (8 hex maiúsculos) no insert quando ausente.
create or replace function app.set_referral_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.codigo_indicacao is null or new.codigo_indicacao = '' then
    loop
      new.codigo_indicacao := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit when not exists (select 1 from patients where codigo_indicacao = new.codigo_indicacao);
    end loop;
  end if;
  return new;
end $$;

do $$ begin
  create trigger trg_patients_referral_code before insert on patients
    for each row execute function app.set_referral_code();
exception when duplicate_object then null; end $$;

-- Backfill: garante código para os pacientes já existentes.
do $$
declare r record; c text;
begin
  for r in select id from patients where codigo_indicacao is null or codigo_indicacao = '' loop
    loop
      c := upper(substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 8));
      exit when not exists (select 1 from patients where codigo_indicacao = c);
    end loop;
    update patients set codigo_indicacao = c where id = r.id;
  end loop;
end $$;

-- 2) Ledger de créditos concedidos (recompensa de indicação etc.) -----------
create table if not exists patient_credit_grants (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references clinics(id) on delete cascade,
  patient_id          uuid not null references patients(id) on delete cascade,   -- quem RECEBE o crédito
  valor               numeric(12,2) not null check (valor > 0),
  motivo              text,
  referral_patient_id uuid references patients(id) on delete set null,           -- indicado que gerou a recompensa
  created_by          uuid references professionals(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_credit_grants_patient on patient_credit_grants(patient_id);
create index if not exists idx_credit_grants_referral on patient_credit_grants(referral_patient_id);

alter table patient_credit_grants enable row level security;
do $$ begin
  create policy grants_staff_all on patient_credit_grants for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy grants_patient_read on patient_credit_grants for select to authenticated
    using (patient_id = app.current_patient_id());
exception when duplicate_object then null; end $$;

-- 3) v_patient_credits: somar os créditos concedidos ao credito_gerado -------
--    Mantém EXATAMENTE as mesmas colunas/ordem (patient_id, credito_gerado,
--    credito_consumido, credito_disponivel). Inclui também pacientes que só
--    possuem crédito concedido (union dos ids).
create or replace view v_patient_credits
with (security_invoker = true) as
with real_paid as (
  select
    q.patient_id,
    q.id as quote_id,
    q.valor_total,
    coalesce(sum(p.valor) filter (
      where p.metodo::text <> 'credito'
        and (p.status = 'pago' or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado')))
    ), 0) as pago_real
  from quotes q
  left join payments p on p.quote_id = q.id
  group by q.id
),
gerado_over as (
  select patient_id, coalesce(sum(greatest(0, pago_real - valor_total)), 0) as v
  from real_paid
  group by patient_id
),
gerado_grant as (
  select patient_id, coalesce(sum(valor), 0) as v
  from patient_credit_grants
  group by patient_id
),
consumido as (
  select patient_id, coalesce(sum(valor), 0) as v
  from payments
  where metodo::text = 'credito' and status not in ('estornado', 'cancelado')
  group by patient_id
),
ids as (
  select patient_id from gerado_over
  union select patient_id from gerado_grant
  union select patient_id from consumido
)
select
  i.patient_id,
  coalesce(go.v, 0) + coalesce(gg.v, 0)                          as credito_gerado,
  coalesce(c.v, 0)                                               as credito_consumido,
  coalesce(go.v, 0) + coalesce(gg.v, 0) - coalesce(c.v, 0)       as credito_disponivel
from ids i
left join gerado_over go on go.patient_id = i.patient_id
left join gerado_grant gg on gg.patient_id = i.patient_id
left join consumido c on c.patient_id = i.patient_id;

comment on view v_patient_credits is
  'Crédito disponível por paciente: excedente de pagamentos reais sobre orçamentos + créditos concedidos (patient_credit_grants), menos crédito já usado. security_invoker.';

grant select on v_patient_credits to authenticated;
