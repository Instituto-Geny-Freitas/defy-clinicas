-- =============================================================================
-- 0051_reconcile_ativo_primeiro_lote.sql
-- Reconciliação: leva os dados legados do CADASTRO do ativo (fornecedor, lote,
-- validade, preços) para o seu ÚNICO lote quando este está vazio. Isso recupera
-- os valores que ficaram no ativo após edições posteriores à migração 0047
-- (agora esses dados vivem no lote, não no cadastro). Só preenche vazios —
-- não sobrescreve lotes que já têm dados. Idempotente.
-- =============================================================================

update ativo_lotes l set
  fornecedor      = coalesce(nullif(l.fornecedor, ''), a.fornecedor),
  lote            = coalesce(nullif(l.lote, ''), a.lote),
  validade        = coalesce(l.validade, a.validade),
  custo_aquisicao = case when l.custo_aquisicao = 0 then a.preco_aquisicao else l.custo_aquisicao end,
  margem_pct      = case when l.margem_pct = 0 then a.margem_pct else l.margem_pct end,
  preco_venda     = case when l.preco_venda = 0 then a.preco_venda else l.preco_venda end,
  updated_at      = now()
from active_ingredients a
where l.ativo_id = a.id
  and (select count(*) from ativo_lotes l2 where l2.ativo_id = a.id) = 1
  and (
    coalesce(nullif(l.lote, ''), '') = ''
    or l.fornecedor is null
    or l.validade is null
    or l.preco_venda = 0
  );
