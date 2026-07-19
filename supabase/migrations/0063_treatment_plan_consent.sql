-- Envio + consentimento (ciência) de planos de tratamento pelo paciente no portal,
-- espelhando o fluxo dos documentos. Aditivo e idempotente.
--
-- Fluxo: rascunho (criado) -> pendente (enviado ao paciente) -> consentido
-- (paciente deu ciência no portal, OU a equipe registrou manualmente).

alter table treatment_plans add column if not exists status          text not null default 'rascunho';
alter table treatment_plans add column if not exists enviado_em       timestamptz;
alter table treatment_plans add column if not exists consentido_em    timestamptz;
alter table treatment_plans add column if not exists consentido_via   text;   -- 'portal' | 'staff'
alter table treatment_plans add column if not exists assinatura_hash  text;

do $$ begin
  alter table treatment_plans add constraint treatment_plans_status_chk
    check (status in ('rascunho', 'pendente', 'consentido', 'cancelado'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table treatment_plans add constraint treatment_plans_consentido_via_chk
    check (consentido_via is null or consentido_via in ('portal', 'staff'));
exception when duplicate_object then null; end $$;

-- O paciente só enxerga planos que foram ENVIADOS (nunca rascunhos da equipe).
-- (A política de staff — plans_staff — não é afetada.)
drop policy if exists plans_patient_read on treatment_plans;
create policy plans_patient_read on treatment_plans for select to authenticated
  using (patient_id = app.current_patient_id() and status <> 'rascunho');

-- Ciência do paciente via RPC security definer: grava SOMENTE as colunas de
-- consentimento, do próprio paciente e apenas quando o plano está 'pendente'.
-- Assim não concedemos UPDATE amplo ao paciente sobre treatment_plans (que tem
-- texto/valores sensíveis) — ele não pode alterar o conteúdo do plano.
create or replace function plan_patient_acknowledge(p_plan uuid, p_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update treatment_plans
     set status = 'consentido',
         consentido_em = now(),
         consentido_via = 'portal',
         assinatura_hash = p_hash
   where id = p_plan
     and patient_id = app.current_patient_id()
     and status = 'pendente';
  if not found then
    raise exception 'Plano não encontrado, não enviado ou já processado.';
  end if;
end $$;

revoke all on function plan_patient_acknowledge(uuid, text) from public;
grant execute on function plan_patient_acknowledge(uuid, text) to authenticated;
