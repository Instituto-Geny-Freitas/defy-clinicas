-- =============================================================================
-- 0041_card_installments.sql
-- Parcelamento no cartão de crédito:
--   • Para o PACIENTE a obrigação fica liquidada (liquidado_paciente=true) no ato.
--   • Para a CLÍNICA cada parcela é um "a receber" (status='pendente') com
--     vencimento mensal (1ª após ~30 dias). Quando recebida, vira 'pago'.
--   • Chargeback: a parcela vira 'estornado' e a obrigação volta a pendente para
--     o paciente (some do "liquidado" e o saldo do orçamento reabre).
-- =============================================================================

alter table payments
  add column if not exists parcelamento_grupo uuid,
  add column if not exists liquidado_paciente  boolean not null default false;

create index if not exists idx_payments_grupo on payments(parcelamento_grupo);
create index if not exists idx_payments_vencimento on payments(vencimento);

-- Recria o saldo do orçamento: conta como quitado tudo que o PACIENTE já liquidou
-- (pagamentos 'pago' OU parcelas de cartão liquidadas e não estornadas).
drop view if exists v_quote_balances;
create view v_quote_balances
with (security_invoker = true) as
select
  q.id                          as quote_id,
  q.patient_id,
  q.valor_total,
  coalesce(sum(p.valor) filter (
    where p.status = 'pago'
       or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado'))
  ), 0)                         as total_pago,
  q.valor_total - coalesce(sum(p.valor) filter (
    where p.status = 'pago'
       or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado'))
  ), 0)                         as saldo_a_receber
from quotes q
left join payments p on p.quote_id = q.id
group by q.id;

comment on view v_quote_balances is
  'Saldo a receber por orçamento (considera parcelas de cartão liquidadas pelo paciente). security_invoker.';
