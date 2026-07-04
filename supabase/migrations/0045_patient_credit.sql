-- =============================================================================
-- 0045_patient_credit.sql
-- Crédito do paciente: quando os pagamentos REAIS (dinheiro/pix/cartão) de um
-- orçamento superam o valor dele, o excedente vira crédito do paciente, que pode
-- ser abatido em pagamentos futuros de OUTROS orçamentos do mesmo paciente.
--
-- Modelagem: o uso do crédito é um pagamento com metodo = 'credito' (status
-- 'pago') no orçamento de destino — abate o saldo dele exatamente como qualquer
-- pagamento. Esse lançamento NÃO é dinheiro novo (é realocação), então é
-- EXCLUÍDO dos totais de receita no app (listPaymentsPeriodo e Dashboard).
--
-- As comparações usam ::text para não referenciar o novo rótulo do enum na mesma
-- transação em que ele é criado (evita o erro "unsafe use of new value").
-- =============================================================================

-- 1) Novo método de pagamento -------------------------------------------------
alter type payment_method add value if not exists 'credito';

-- 2) Crédito disponível por paciente -----------------------------------------
--    credito_gerado   = Σ por orçamento de max(0, pago_real - valor_total)
--    credito_consumido = Σ pagamentos com metodo 'credito' (não estornados)
--    credito_disponivel = gerado - consumido
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
gerado as (
  select patient_id, coalesce(sum(greatest(0, pago_real - valor_total)), 0) as credito_gerado
  from real_paid
  group by patient_id
),
consumido as (
  select patient_id, coalesce(sum(valor), 0) as credito_consumido
  from payments
  where metodo::text = 'credito' and status not in ('estornado', 'cancelado')
  group by patient_id
)
select
  g.patient_id,
  g.credito_gerado,
  coalesce(c.credito_consumido, 0)                             as credito_consumido,
  g.credito_gerado - coalesce(c.credito_consumido, 0)          as credito_disponivel
from gerado g
left join consumido c on c.patient_id = g.patient_id;

comment on view v_patient_credits is
  'Crédito disponível por paciente (excedente de pagamentos reais sobre o valor dos orçamentos, menos crédito já usado). security_invoker.';

grant select on v_patient_credits to authenticated;
