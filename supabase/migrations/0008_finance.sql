-- =============================================================================
-- 0008_finance.sql
-- Orçamentos e pagamentos. PIX priorizado (integração com gateway via webhook).
-- Saldo a receber derivado de quotes.valor_total - soma de pagamentos pagos.
-- =============================================================================

create table quotes (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  numero          text,                                    -- numeração amigável (ex.: ORC-2026-001)
  itens           jsonb not null default '[]'::jsonb,      -- [{ descricao, qtd, valor_unit, total }]
  valor_bruto     numeric(12,2) not null default 0,
  desconto        numeric(12,2) not null default 0,
  valor_total     numeric(12,2) not null default 0,
  status          quote_status not null default 'rascunho',
  validade        date,
  observacoes     text,
  aprovado_em     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_quotes_patient on quotes(patient_id);
create index idx_quotes_status on quotes(status);

create trigger trg_quotes_updated_at
  before update on quotes
  for each row execute function app.set_updated_at();

create table payments (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  patient_id      uuid not null references patients(id) on delete cascade,
  valor           numeric(12,2) not null,
  metodo          payment_method not null default 'pix',
  status          payment_status not null default 'pendente',
  parcela         integer not null default 1,
  total_parcelas  integer not null default 1,
  vencimento      date,
  pago_em         timestamptz,
  -- Integração com gateway (ex.: Asaas/Mercado Pago/Pagar.me):
  gateway         text,
  gateway_ref     text,                                    -- id da cobrança no gateway
  pix_qrcode      text,
  pix_copia_cola  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_payments_quote on payments(quote_id);
create index idx_payments_patient on payments(patient_id);
create index idx_payments_status on payments(status);
create index idx_payments_gateway_ref on payments(gateway_ref);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function app.set_updated_at();

-- Visão de saldo por orçamento (valor_total - pagamentos confirmados) ---------
create or replace view v_quote_balances as
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

comment on table quotes is 'Orçamentos de tratamento; itens em JSONB.';
comment on table payments is 'Pagamentos/parcelas; suporte a PIX via gateway (webhook confirma).';
comment on view v_quote_balances is 'Saldo a receber por orçamento.';
