-- 0082_credit_inclui_credito_aplicado.sql
-- Crédito do paciente: o excedente de um orçamento passa a considerar TAMBÉM o
-- crédito já aplicado nele (pagamentos metodo='credito').
--
-- Por quê: antes, o cálculo do excedente (pago_real) ignorava o crédito aplicado.
-- Se um orçamento pago em parte com crédito tinha o total reduzido depois, o
-- excedente devolvido pelo aviso da tela ("a diferença vira CRÉDITO") não aparecia
-- em Financeiro → Créditos. Ex.: total 300 pago com 250 + 50 de crédito, reduzido
-- para 280 → deveria sobrar 20 de crédito; a view calculava 0.
--
-- Sem contagem dupla: o crédito usado continua descontado em credito_consumido;
-- incluí-lo no excedente só o devolve quando o orçamento de destino fica pago a mais.
-- Receita/relatórios NÃO mudam (continuam excluindo metodo='credito' — 0045).
-- Mesma estrutura de colunas da view (0055); só muda o filtro de pago_real.
-- Sem blocos $$ (pode colar direto no SQL Editor).

create or replace view v_patient_credits
with (security_invoker = true) as
with real_paid as (
  select
    q.patient_id,
    q.id as quote_id,
    q.valor_total,
    coalesce(sum(p.valor) filter (
      where p.status = 'pago' or (p.liquidado_paciente and p.status not in ('estornado', 'cancelado'))
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
