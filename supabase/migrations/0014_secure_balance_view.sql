-- =============================================================================
-- 0014_secure_balance_view.sql
-- Correção de segurança: recria v_quote_balances com security_invoker.
--
-- Por padrão, uma view no Postgres executa com as permissões do DONO (postgres),
-- o que IGNORA o RLS das tabelas subjacentes. Como a view é exposta pela API
-- (PostgREST), qualquer autenticado poderia ler os saldos de TODOS os pacientes.
-- Com security_invoker = true, a view respeita o RLS do usuário que consulta:
-- paciente vê só os próprios saldos; equipe vê todos.
-- =============================================================================

drop view if exists v_quote_balances;

create view v_quote_balances
with (security_invoker = true) as
select
  q.id                                   as quote_id,
  q.patient_id,
  q.valor_total,
  coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)        as total_pago,
  q.valor_total
    - coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)    as saldo_a_receber
from quotes q
left join payments p on p.quote_id = q.id
group by q.id;

comment on view v_quote_balances is
  'Saldo a receber por orçamento. security_invoker: respeita o RLS do consultante.';
