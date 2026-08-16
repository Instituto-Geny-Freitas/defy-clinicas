import { listQuotes, listPaymentsByPatient, totalLiquidado, type Payment, type Quote } from '@/lib/finance'
import { listTreatmentPlans, listPlanItemsForPlans } from '@/lib/treatmentPlans'
import { listPackages, listPackageItemsForPackages, type TreatmentPackage } from '@/lib/packages'
import type { ProcedureRecord } from '@/lib/procedures'
import type { Supplementation } from '@/lib/supplementations'

// =============================================================================
// Situação financeira de um atendimento (procedimento/suplementação).
//
// Um registro pode ser coberto por um orçamento de TRÊS formas:
//   1) item direto no orçamento  — origem 'suplementacao'/'procedimento' + ref_id
//      (ou procedures_log.quote_id);
//   2) item de PLANO             — o plano é cobrado por um orçamento vinculado
//      (quotes.treatment_plan_id);
//   3) item de PACOTE            — o pacote é pré-pago por treatment_packages.quote_id.
//
// Considerar só (1) fazia registros legitimamente vinculados a plano/pacote
// aparecerem como "sem vínculo" — a origem do alerta falso na Suplementação.
// =============================================================================

export type Vinculo = 'quitado' | 'aberto' | 'nenhum'
export type ViaVinculo = 'item' | 'plano' | 'pacote' | 'orcamento' | null

export interface VinculoResultado {
  vinculo: Vinculo
  via: ViaVinculo
  /** Orçamento que cobre o registro (quando houver). */
  quoteId?: string | null
  /** Vínculo aponta para um plano/pacote que ainda NÃO tem orçamento. */
  semOrcamento?: boolean
  /** O item de plano/pacote referenciado não existe mais (link quebrado). */
  linkQuebrado?: boolean
}

export interface VinculoCtx {
  quotes: Quote[]
  pagamentos: Payment[]
  pacotes: TreatmentPackage[]
  /** treatment_plan_item_id → treatment_plan_id */
  planoDoItem: Map<string, string>
  /** treatment_package_item_id → package_id */
  pacoteDoItem: Map<string, string>
}

/** Carrega tudo o que a regra precisa, numa ida só. */
export async function carregarVinculoCtx(patientId: string): Promise<VinculoCtx> {
  const [quotes, pagamentos, planos, pacotes] = await Promise.all([
    listQuotes(patientId),
    listPaymentsByPatient(patientId),
    listTreatmentPlans(patientId),
    listPackages(patientId),
  ])
  const [planItems, pkgItems] = await Promise.all([
    listPlanItemsForPlans(planos.map((p) => p.id)),
    listPackageItemsForPackages(pacotes.map((p) => p.id)),
  ])
  return {
    quotes,
    pagamentos,
    pacotes,
    planoDoItem: new Map(planItems.map((i) => [i.id, i.treatment_plan_id])),
    pacoteDoItem: new Map(pkgItems.map((i) => [i.id, i.package_id])),
  }
}

const quitado = (q: Quote, pagamentos: Payment[]) =>
  (Number(q.valor_total) - totalLiquidado(pagamentos, q.id)) <= 0.005

/** Avalia uma lista de orçamentos candidatos: quitado > aberto. */
function avaliar(qs: Quote[], ctx: VinculoCtx, via: ViaVinculo): VinculoResultado | null {
  if (qs.length === 0) return null
  const pago = qs.find((q) => quitado(q, ctx.pagamentos))
  if (pago) return { vinculo: 'quitado', via, quoteId: pago.id }
  return { vinculo: 'aberto', via, quoteId: qs[0].id }
}

/** Situação da suplementação: item do orçamento, item de plano ou item de pacote. */
export function vinculoSuplementacao(s: Supplementation, ctx: VinculoCtx): VinculoResultado {
  // 1) Item importado direto no orçamento.
  const porItem = ctx.quotes.filter((q) => (q.itens ?? []).some((it) => it.origem === 'suplementacao' && it.ref_id === s.id))
  const r1 = avaliar(porItem, ctx, 'item')
  if (r1) return r1

  // 2) Item de plano → orçamento(s) do plano.
  if (s.treatment_plan_item_id) {
    const planId = ctx.planoDoItem.get(s.treatment_plan_item_id)
    if (!planId) return { vinculo: 'nenhum', via: 'plano', linkQuebrado: true }
    const r2 = avaliar(ctx.quotes.filter((q) => q.treatment_plan_id === planId), ctx, 'plano')
    if (r2) return r2
    return { vinculo: 'nenhum', via: 'plano', semOrcamento: true }
  }

  // 3) Item de pacote → orçamento do pacote (pré-pago).
  if (s.treatment_package_item_id) {
    const pkgId = ctx.pacoteDoItem.get(s.treatment_package_item_id)
    if (!pkgId) return { vinculo: 'nenhum', via: 'pacote', linkQuebrado: true }
    const pkg = ctx.pacotes.find((p) => p.id === pkgId)
    const q = pkg?.quote_id ? ctx.quotes.find((x) => x.id === pkg.quote_id) : null
    if (!q) return { vinculo: 'nenhum', via: 'pacote', semOrcamento: true }
    return { vinculo: quitado(q, ctx.pagamentos) ? 'quitado' : 'aberto', via: 'pacote', quoteId: q.id }
  }

  return { vinculo: 'nenhum', via: null }
}

/** Situação do procedimento: orçamento direto, item de plano ou item de pacote. */
export function vinculoProcedimento(p: ProcedureRecord, ctx: VinculoCtx): VinculoResultado {
  if (p.quote_id) {
    const q = ctx.quotes.find((x) => x.id === p.quote_id)
    if (!q) return { vinculo: 'nenhum', via: 'orcamento', linkQuebrado: true }
    return { vinculo: quitado(q, ctx.pagamentos) ? 'quitado' : 'aberto', via: 'orcamento', quoteId: q.id }
  }

  if (p.treatment_plan_item_id) {
    const planId = ctx.planoDoItem.get(p.treatment_plan_item_id)
    if (!planId) return { vinculo: 'nenhum', via: 'plano', linkQuebrado: true }
    const r = avaliar(ctx.quotes.filter((q) => q.treatment_plan_id === planId), ctx, 'plano')
    if (r) return r
    return { vinculo: 'nenhum', via: 'plano', semOrcamento: true }
  }

  if (p.treatment_package_item_id) {
    const pkgId = ctx.pacoteDoItem.get(p.treatment_package_item_id)
    if (!pkgId) return { vinculo: 'nenhum', via: 'pacote', linkQuebrado: true }
    const pkg = ctx.pacotes.find((x) => x.id === pkgId)
    const q = pkg?.quote_id ? ctx.quotes.find((x) => x.id === pkg.quote_id) : null
    if (!q) return { vinculo: 'nenhum', via: 'pacote', semOrcamento: true }
    return { vinculo: quitado(q, ctx.pagamentos) ? 'quitado' : 'aberto', via: 'pacote', quoteId: q.id }
  }

  return { vinculo: 'nenhum', via: null }
}

// ---- Diagnóstico de inconsistências ----------------------------------------
export type Severidade = 'erro' | 'atencao' | 'info'
export interface Achado {
  severidade: Severidade
  origem: 'suplementacao' | 'procedimento'
  registroId: string
  titulo: string
  detalhe: string
  comoResolver: string
}

/**
 * Verifica a coerência clínico-financeira do paciente: links quebrados,
 * planos/pacotes sem orçamento, marcações manuais divergentes e avulsos
 * pendentes de cobrança.
 */
export function diagnosticar(args: {
  ctx: VinculoCtx
  suplementacoes: Supplementation[]
  procedimentos: ProcedureRecord[]
}): Achado[] {
  const { ctx, suplementacoes, procedimentos } = args
  const achados: Achado[] = []

  for (const s of suplementacoes) {
    const r = vinculoSuplementacao(s, ctx)
    const nome = s.medicacao || 'Suplementação'

    if (r.linkQuebrado) {
      achados.push({
        severidade: 'erro', origem: 'suplementacao', registroId: s.id,
        titulo: `${nome}: vínculo quebrado`,
        detalhe: `Aponta para um item de ${r.via} que não existe mais (item removido ou plano/pacote excluído).`,
        comoResolver: 'Edite a suplementação e escolha novamente o item do plano/pacote — ou deixe-a avulsa.',
      })
    } else if (r.semOrcamento) {
      achados.push({
        severidade: 'atencao', origem: 'suplementacao', registroId: s.id,
        titulo: `${nome}: ${r.via} ainda sem orçamento`,
        detalhe: `Está vinculada a um ${r.via}, mas esse ${r.via} não tem orçamento gerado — então não há cobrança prevista.`,
        comoResolver: `Gere o orçamento em Financeiro → Novo orçamento (${r.via === 'pacote' ? 'Pacote (pré-pago)' : 'Plano'}).`,
      })
    } else if (r.vinculo === 'nenhum' && !s.pago) {
      achados.push({
        severidade: 'atencao', origem: 'suplementacao', registroId: s.id,
        titulo: `${nome}: avulsa e não paga`,
        detalhe: 'Não está em orçamento, plano ou pacote, e segue como não paga.',
        comoResolver: 'Importe-a num orçamento (Financeiro → Novo orçamento) ou vincule a um plano/pacote.',
      })
    }

    if (s.pago && r.vinculo === 'aberto') {
      achados.push({
        severidade: 'erro', origem: 'suplementacao', registroId: s.id,
        titulo: `${nome}: marcada como paga, mas o orçamento está em aberto`,
        detalhe: 'O orçamento que cobre esta suplementação ainda tem saldo.',
        comoResolver: 'Confira o recebimento na aba Financeiro; se não houve pagamento, reverta a marcação.',
      })
    }
    if (!s.pago && r.vinculo === 'quitado') {
      achados.push({
        severidade: 'info', origem: 'suplementacao', registroId: s.id,
        titulo: `${nome}: coberta por orçamento quitado, mas não marcada como paga`,
        detalhe: `O ${r.via === 'item' ? 'orçamento' : r.via} que a cobre já está quitado.`,
        comoResolver: 'Use "Marcar como pago" na aba Suplementação para alinhar o histórico.',
      })
    }
  }

  for (const p of procedimentos) {
    const r = vinculoProcedimento(p, ctx)
    const nome = p.procedimento || 'Procedimento'
    if (r.linkQuebrado) {
      achados.push({
        severidade: 'erro', origem: 'procedimento', registroId: p.id,
        titulo: `${nome}: vínculo quebrado`,
        detalhe: `Aponta para ${r.via === 'orcamento' ? 'um orçamento' : `um item de ${r.via}`} que não existe mais.`,
        comoResolver: 'Edite o procedimento e refaça o vínculo (ou deixe-o avulso com valor).',
      })
    } else if (r.semOrcamento) {
      achados.push({
        severidade: 'atencao', origem: 'procedimento', registroId: p.id,
        titulo: `${nome}: ${r.via} ainda sem orçamento`,
        detalhe: `Consome sessão de um ${r.via} que ainda não foi orçado — sem cobrança prevista.`,
        comoResolver: `Gere o orçamento do ${r.via} em Financeiro → Novo orçamento.`,
      })
    } else if (r.vinculo === 'nenhum' && Number(p.valor_cobrado) > 0) {
      achados.push({
        severidade: 'atencao', origem: 'procedimento', registroId: p.id,
        titulo: `${nome}: avulso com valor e sem orçamento`,
        detalhe: `Tem valor a cobrar e não está em nenhum orçamento.`,
        comoResolver: 'Importe-o em Financeiro → Novo orçamento → Importar procedimentos avulsos.',
      })
    }
  }

  return achados
}
