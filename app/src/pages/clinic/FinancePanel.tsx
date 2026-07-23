import { useEffect, useState } from 'react'
import {
  brl,
  calcItensTotal,
  cancelInstallmentGroup,
  chargebackGroup,
  chargebackPayment,
  createQuote,
  deletePayment,
  deleteQuote,
  getPatientCredit,
  listPaymentsByPatient,
  listQuotes,
  markInstallmentReceived,
  registerCardInstallments,
  registerPayment,
  totalLiquidado,
  updatePayment,
  updateQuote,
  type Payment,
  type PaymentMethod,
  type Quote,
  type QuoteItem,
} from '@/lib/finance'
import { listProcedures, listUnbilledProcedures, linkProceduresToQuote, unlinkProcedureFromQuote, produtosDoOrcamento, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listTreatmentPlans, type TreatmentPlan } from '@/lib/treatmentPlans'
import { listUnpaidSupplementations, listSupplementations, setSupplementationPaid } from '@/lib/supplementations'
import { createSharedDocument, listSharedDocuments, type SharedDocument } from '@/lib/sharedDocs'
import { buildOrcamentoPdf } from '@/lib/orcamentoPdf'
import { useClinic } from '@/theme/ThemeProvider'
import { useAuth } from '@/auth/AuthProvider'
import { formatDateBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
  pacienteNome?: string
}

export default function FinancePanel({ patientId, clinicId, professionalId, pacienteNome }: Props) {
  const clinic = useClinic()
  const { profile } = useAuth()
  const isAdmin = profile?.professional?.role === 'admin'
  const [corrigindo, setCorrigindo] = useState<{ quote: Quote; grupo: string; parcelasAtuais: number } | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedureRecord[]>([])
  const [compartilhados, setCompartilhados] = useState<SharedDocument[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalOrc, setModalOrc] = useState(false)
  const [editandoOrc, setEditandoOrc] = useState<Quote | null>(null)
  const [pagandoQuote, setPagandoQuote] = useState<Quote | null>(null)
  const [editandoPg, setEditandoPg] = useState<Payment | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)

  async function excluirPagamento(p: Payment) {
    if (!confirm(`Excluir o pagamento de ${brl(Number(p.valor))}?`)) return
    await deletePayment(p.id)
    recarregar()
  }
  async function receberParcela(p: Payment) {
    if (!confirm(`Confirmar recebimento da parcela ${p.parcela}/${p.total_parcelas} (${brl(Number(p.valor))})?`)) return
    await markInstallmentReceived(p.id)
    recarregar()
  }
  async function estornarParcela(p: Payment) {
    if (!confirm(`Registrar chargeback da parcela ${p.parcela}/${p.total_parcelas}? A obrigação volta a ficar pendente para o paciente.`)) return
    await chargebackPayment(p.id)
    recarregar()
  }
  async function estornarGrupo(grupo: string) {
    if (!confirm('Registrar chargeback de TODAS as parcelas desta venda? A obrigação volta a ficar pendente para o paciente.')) return
    await chargebackGroup(grupo)
    recarregar()
  }
  const metodoLabel: Record<string, string> = {
    pix: 'PIX', cartao_credito: 'Cartão crédito', cartao_debito: 'Cartão débito',
    dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro',
  }

  async function excluirOrc(q: Quote) {
    const pago = totalLiquidado(pagamentos, q.id)
    if (pago > 0) { alert('Este orçamento já tem pagamento registrado. Exclua/estorne os pagamentos antes.'); return }
    if (!confirm('Excluir este orçamento?')) return
    try { await deleteQuote(q.id); recarregar() }
    catch { alert('Não foi possível excluir (há vínculos como pagamentos ou procedimentos).') }
  }

  function recarregar() {
    Promise.all([listQuotes(patientId), listPaymentsByPatient(patientId), listProcedures(patientId), listSharedDocuments(patientId), listSupplementations(patientId)])
      .then(([q, p, proc, sd, supl]) => {
        setQuotes(q)
        setPagamentos(p)
        setProcedimentos(proc)
        setCompartilhados(sd)
        reconciliarSuplementos(q, p, supl)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  /**
   * Sincroniza o status "pago" das suplementações com a quitação do orçamento em
   * que foram importadas: se o orçamento está quitado, a suplementação vira paga
   * (e some do "importar não pagas"); se reabre (chargeback/exclusão), volta a
   * não paga. Só grava quando o status muda. Suplementações fora de orçamentos
   * não são tocadas (preserva o toggle manual do painel de Suplementação).
   */
  async function reconciliarSuplementos(qs: Quote[], pgs: Payment[], supl: { id: string; pago: boolean }[]) {
    const atual = new Map(supl.map((s) => [s.id, s.pago]))
    const desejado = new Map<string, boolean>()
    for (const q of qs) {
      const quitado = (Number(q.valor_total) - totalLiquidado(pgs, q.id)) <= 0.005
      for (const it of q.itens ?? []) {
        if (it.origem === 'suplementacao' && it.ref_id) {
          desejado.set(it.ref_id, (desejado.get(it.ref_id) ?? false) || quitado)
        }
      }
    }
    const updates: Promise<void>[] = []
    for (const [id, querPago] of desejado) {
      if (atual.has(id) && atual.get(id) !== querPago) updates.push(setSupplementationPaid(id, querPago))
    }
    if (updates.length) await Promise.allSettled(updates)
  }

  /** Documento de orçamento já enviado ao paciente, se houver. */
  function orcamentoEnviado(quoteId: string): SharedDocument | undefined {
    return compartilhados.find((d) => d.quote_id === quoteId && d.enviado_paciente)
  }

  async function enviarOrcamento(q: Quote) {
    setEnviando(q.id)
    try {
      const { blob } = buildOrcamentoPdf({ clinic, pacienteNome: pacienteNome ?? 'Paciente', quote: q })
      await createSharedDocument({
        clinicId, patientId, professionalId,
        titulo: `Orçamento ${q.numero ?? new Date(q.created_at).toLocaleDateString('pt-BR')}`,
        categoria: 'orcamento',
        quoteId: q.id,
        blob,
        enviarPaciente: true,
      })
      recarregar()
    } catch (e) {
      alert((e as Error).message ?? 'Não foi possível gerar/enviar o orçamento.')
    } finally {
      setEnviando(null)
    }
  }

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Orçamentos e pagamentos</h3>
        <button onClick={() => setModalOrc(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo orçamento
        </button>
      </div>

      {modalOrc && (
        <OrcamentoModal
          clinicId={clinicId}
          patientId={patientId}
          professionalId={professionalId}
          onClose={() => setModalOrc(false)}
          onSaved={() => { setModalOrc(false); recarregar() }}
        />
      )}
      {editandoOrc && (
        <EditarItensModal
          quote={editandoOrc}
          pago={totalLiquidado(pagamentos, editandoOrc.id)}
          onClose={() => setEditandoOrc(null)}
          onSaved={() => { setEditandoOrc(null); recarregar() }}
        />
      )}
      {pagandoQuote && (
        <PagamentoModal
          clinicId={clinicId}
          patientId={patientId}
          quote={pagandoQuote}
          saldo={pagandoQuote.valor_total - totalLiquidado(pagamentos, pagandoQuote.id)}
          onClose={() => setPagandoQuote(null)}
          onSaved={() => { setPagandoQuote(null); recarregar() }}
        />
      )}
      {editandoPg && (
        <EditarPagamentoModal
          pagamento={editandoPg}
          onClose={() => setEditandoPg(null)}
          onSaved={() => { setEditandoPg(null); recarregar() }}
        />
      )}
      {corrigindo && (
        <CorrigirParcelasModal
          clinicId={clinicId}
          patientId={patientId}
          quote={corrigindo.quote}
          grupo={corrigindo.grupo}
          parcelasAtuais={corrigindo.parcelasAtuais}
          onClose={() => setCorrigindo(null)}
          onSaved={() => { setCorrigindo(null); recarregar() }}
        />
      )}

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum orçamento.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const pago = totalLiquidado(pagamentos, q.id)
            const saldo = q.valor_total - pago
            const produtos = produtosDoOrcamento(procedimentos, q.id)
            return (
              <div key={q.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-texto/50">{new Date(q.created_at).toLocaleDateString('pt-BR')}</div>
                    <div className="mt-1 space-y-0.5 text-sm text-texto/80">
                      {q.itens.map((it, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5">
                          <span>{it.qtd}× {it.descricao} — {brl(it.total)}</span>
                          {it.origem && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ORIGEM_CHIP[it.origem] ?? 'bg-black/5 text-texto/60'}`}>{ORIGEM_LABEL[it.origem]}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-texto">{brl(q.valor_total)}</div>
                    {q.desconto > 0 && <div className="text-xs text-texto/50">desc. {brl(q.desconto)}</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/5 pt-3 text-sm">
                  <span className="text-texto/60">Pago {brl(pago)}</span>
                  <span className={saldo > 0 ? 'font-semibold text-secundaria' : 'font-semibold text-emerald-600'}>
                    {saldo > 0 ? `Saldo ${brl(saldo)}` : 'Quitado'}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {orcamentoEnviado(q.id) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Orçamento enviado
                      </span>
                    ) : (
                      <button
                        onClick={() => enviarOrcamento(q)}
                        disabled={enviando === q.id}
                        className="rounded-md border border-primaria px-3 py-1 text-xs font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50"
                      >
                        {enviando === q.id ? 'Enviando…' : 'Gerar e enviar orçamento'}
                      </button>
                    )}
                    {saldo > 0 && (
                      <button onClick={() => setPagandoQuote(q)} className="rounded-md bg-primaria px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                        Registrar pagamento
                      </button>
                    )}
                    <button onClick={() => setEditandoOrc(q)} className="text-xs font-medium text-texto/60 hover:underline">Editar itens</button>
                    <button onClick={() => excluirOrc(q)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
                  </div>
                </div>

                {(() => {
                  const doQuote = pagamentos.filter((p) => p.quote_id === q.id)
                  const avista = doQuote.filter((p) => !p.parcelamento_grupo && p.status === 'pago')
                  const parcelas = doQuote.filter((p) => p.parcelamento_grupo && p.status !== 'cancelado').sort((a, b) => a.parcela - b.parcela)
                  const grupo = parcelas[0]?.parcelamento_grupo ?? null
                  const algumAtivo = parcelas.some((p) => p.status !== 'estornado')
                  if (avista.length === 0 && parcelas.length === 0) return null
                  return (
                    <div className="mt-3 border-t border-black/5 pt-3">
                      {avista.length > 0 && <div className="mb-1 text-xs font-medium text-texto/60">Pagamentos</div>}
                      <div className="space-y-1">
                        {avista.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-texto/70">
                              {brl(Number(p.valor))} · {metodoLabel[p.metodo] ?? p.metodo}
                              {p.pago_em && <span className="text-texto/40"> · {new Date(p.pago_em).toLocaleDateString('pt-BR')}</span>}
                            </span>
                            <span className="whitespace-nowrap">
                              <button onClick={() => setEditandoPg(p)} className="text-xs text-texto/60 hover:underline">Editar</button>
                              <button onClick={() => excluirPagamento(p)} className="ml-3 text-xs text-secundaria hover:underline">Excluir</button>
                            </span>
                          </div>
                        ))}
                      </div>

                      {parcelas.length > 0 && (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium text-texto/60">Cartão parcelado ({parcelas[0].total_parcelas}×)</span>
                            <span className="flex items-center gap-3">
                              {isAdmin && grupo && (
                                <button onClick={() => setCorrigindo({ quote: q, grupo, parcelasAtuais: parcelas[0].total_parcelas })} className="text-xs font-medium text-primaria hover:underline" title="Cancelar este parcelamento e registrar com o número correto de parcelas (admin)">Corrigir parcelamento</button>
                              )}
                              {grupo && algumAtivo && (
                                <button onClick={() => estornarGrupo(grupo)} className="text-xs font-medium text-secundaria hover:underline">Chargeback total</button>
                              )}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {parcelas.map((p) => {
                              const badge = p.status === 'estornado'
                                ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">estornada</span>
                                : p.status === 'pago'
                                  ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">recebida</span>
                                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">a receber</span>
                              return (
                                <div key={p.id} className="flex items-center justify-between text-sm">
                                  <span className="text-texto/70">
                                    {p.parcela}/{p.total_parcelas} · {brl(Number(p.valor))}
                                    {p.vencimento && <span className="text-texto/40"> · vence {formatDateBR(p.vencimento)}</span>} {badge}
                                  </span>
                                  <span className="whitespace-nowrap">
                                    {p.status === 'pendente' && <button onClick={() => receberParcela(p)} className="text-xs font-medium text-emerald-600 hover:underline">Recebida</button>}
                                    {p.status !== 'estornado' && <button onClick={() => estornarParcela(p)} className="ml-3 text-xs text-secundaria hover:underline">Chargeback</button>}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {produtos.length > 0 && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <div className="mb-1 text-xs font-medium text-texto/60">Produtos utilizados (baixa de estoque)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {produtos.map((u, i) => (
                        <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">
                          {u.produto} ×{u.qtd}
                          {u.lote && <span className="opacity-70"> · lote {u.lote}</span>}
                          {u.validade && <span className="opacity-70"> · val {formatDateBR(u.validade)}</span>}
                          {Number(u.preco_venda) > 0 && ` · ${brl(Number(u.preco_venda) * u.qtd)}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

const ORIGEM_LABEL: Record<string, string> = { procedimento: 'Procedimento', suplementacao: 'Suplementação', produto: 'Produto' }
const ORIGEM_CHIP: Record<string, string> = { procedimento: 'bg-violet-100 text-violet-700', suplementacao: 'bg-amber-100 text-amber-700', produto: 'bg-sky-100 text-sky-700' }

/** Cria um item cobrável do orçamento a partir de um produto utilizado (usa o preço de venda do estoque). */
function produtoParaItem(u: UsedProduct, refId: string): QuoteItem {
  const qtd = Number(u.qtd) || 1
  const pv = Number(u.preco_venda) || 0
  const det = [u.lote ? `lote ${u.lote}` : '', u.validade ? `val ${formatDateBR(u.validade)}` : ''].filter(Boolean).join(' · ')
  return { descricao: `Produto: ${u.produto}${det ? ` (${det})` : ''}`, qtd, valor_unit: pv, total: pv * qtd, origem: 'produto', ref_id: refId }
}

function OrcamentoModal({ clinicId, patientId, professionalId, onClose, onSaved }: {
  clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void
}) {
  const [itens, setItens] = useState<QuoteItem[]>([{ descricao: '', qtd: 1, valor_unit: 0, total: 0 }])
  const [desconto, setDesconto] = useState(0)
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [planoId, setPlanoId] = useState('')
  const [procImportados, setProcImportados] = useState<string[]>([])
  const [avisoNovo, setAvisoNovo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listTreatmentPlans(patientId).then((ps) => { setPlanos(ps); if (ps.length) setPlanoId(ps[0].id) }).catch(() => {})
  }, [patientId])

  const bruto = calcItensTotal(itens)
  const total = Math.max(0, bruto - desconto)

  // Remove um item; se for procedimento importado, tira-o da fila de vínculo.
  function removerItem(idx: number) {
    const it = itens[idx]
    if (it.origem === 'procedimento' && it.ref_id) setProcImportados((ids) => ids.filter((id) => id !== it.ref_id))
    setItens((a) => a.filter((_, i) => i !== idx))
  }

  function setItem(idx: number, patch: Partial<QuoteItem>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function importarSuplementacoes() {
    const supl = await listUnpaidSupplementations(patientId)
    if (supl.length === 0) { alert('Nenhuma suplementação não paga.'); return }
    const novos: QuoteItem[] = supl.map((s) => ({ descricao: `Suplementação: ${s.medicacao}`, qtd: 1, valor_unit: Number(s.valor_venda) || 0, total: Number(s.valor_venda) || 0, origem: 'suplementacao', ref_id: s.id }))
    setItens((arr) => [...arr.filter((i) => i.descricao.trim()), ...novos])
  }

  async function importarProcedimentos() {
    const procs = await listUnbilledProcedures(patientId)
    if (procs.length === 0) { alert('Nenhum procedimento avulso (sem orçamento) com valor a cobrar.'); return }
    const ids = procs.map((p) => p.id)
    const novos: QuoteItem[] = []
    for (const p of procs) {
      if (Number(p.valor_cobrado) > 0) novos.push({ descricao: `Procedimento: ${p.procedimento}`, qtd: 1, valor_unit: Number(p.valor_cobrado), total: Number(p.valor_cobrado), origem: 'procedimento', ref_id: p.id })
      // Produtos utilizados com preço de venda entram como itens cobráveis do orçamento.
      for (const u of p.produtos_usados ?? []) {
        if (Number(u.preco_venda) > 0) novos.push(produtoParaItem(u, p.id))
      }
    }
    setProcImportados((prev) => [...new Set([...prev, ...ids])])
    // Reconcilia: remove itens já referentes a esses procedimentos ou de mesma descrição (evita duplicar).
    const novasDesc = new Set(novos.map((n) => n.descricao))
    setItens((arr) => [...arr.filter((i) => i.descricao.trim() && !(i.ref_id && ids.includes(i.ref_id)) && !novasDesc.has(i.descricao)), ...novos])
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim())
    if (validos.length === 0) return
    setSalvando(true)
    try {
      const quote = await createQuote({ clinicId, patientId, professionalId, treatmentPlanId: planoId || null, itens: validos, desconto })
      if (procImportados.length > 0) await linkProceduresToQuote(quote.id, procImportados)
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Novo orçamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm text-texto/70">Plano de tratamento (vínculo)</label>
          <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
            <option value="">— Sem vínculo —</option>
            {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
          </select>
          {planos.length === 0 && <p className="mt-1 text-xs text-texto/40">Crie um plano na aba "Plano" para vincular.</p>}
        </div>

        <div className="space-y-2">
          {itens.map((it, idx) => {
            const travado = !!it.origem
            return (
              <div key={idx}>
                <div className="flex gap-2">
                  <input className={`${field} ${travado ? 'bg-black/[0.03] text-texto/70' : ''}`} placeholder="Descrição" value={it.descricao} readOnly={travado} onChange={(e) => !travado && setItem(idx, { descricao: e.target.value })} />
                  <input type="number" min={1} className={`w-16 rounded-lg border border-black/10 px-2 py-2 text-sm ${travado ? 'bg-black/[0.03] text-texto/70' : ''}`} value={it.qtd} readOnly={travado} onChange={(e) => !travado && setItem(idx, { qtd: Number(e.target.value) })} />
                  <input type="number" step="0.01" className={`w-28 rounded-lg border border-black/10 px-2 py-2 text-sm ${travado ? 'cursor-not-allowed bg-black/[0.03] text-texto/70' : ''}`} placeholder="Valor un." value={it.valor_unit} readOnly={travado} onMouseDown={() => travado && setAvisoNovo('Estes valores só podem ser ajustados nos respectivos painéis (Procedimentos ou Suplementação).')} onChange={(e) => !travado && setItem(idx, { valor_unit: Number(e.target.value) })} />
                  <button onClick={() => removerItem(idx)} className="px-2 text-texto/40 hover:text-secundaria" title={travado ? 'Desvincular' : 'Remover'}>✕</button>
                </div>
                {travado && <div className="mt-0.5 text-[10px] text-amber-700">{ORIGEM_LABEL[it.origem!] ?? 'Item'} importado · valor travado (✕ para desvincular)</div>}
              </div>
            )
          })}
          {avisoNovo && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{avisoNovo}</p>}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setItens((a) => [...a, { descricao: '', qtd: 1, valor_unit: 0, total: 0 }])} className="text-xs font-medium text-primaria hover:underline">
              + Adicionar item (Outros serviços)
            </button>
            <button onClick={importarSuplementacoes} className="text-xs font-medium text-primaria hover:underline">
              + Importar suplementações não pagas
            </button>
            <button onClick={importarProcedimentos} className="text-xs font-medium text-primaria hover:underline">
              + Importar procedimentos avulsos
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <span className="text-texto/60">Desconto</span>
          <input type="number" step="0.01" className="w-28 rounded-lg border border-black/10 px-2 py-1.5" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
        </div>
        <div className="mt-2 text-right text-lg font-semibold text-texto">Total: {brl(total)}</div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Salvar orçamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditarItensModal({ quote, pago = 0, onClose, onSaved }: { quote: Quote; pago?: number; onClose: () => void; onSaved: () => void }) {
  const [itens, setItens] = useState<QuoteItem[]>(
    quote.itens?.length ? quote.itens.map((i) => ({ ...i })) : [{ descricao: '', qtd: 1, valor_unit: 0, total: 0 }],
  )
  const [desconto, setDesconto] = useState(Number(quote.desconto) || 0)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [produtosUsados, setProdutosUsados] = useState<UsedProduct[]>([])
  const [procImportados, setProcImportados] = useState<string[]>([])
  // Vínculo com plano + procedimentos vinculados "sem valor" (não somam ao total).
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [planoId, setPlanoId] = useState<string>(quote.treatment_plan_id ?? '')
  const [procsPaciente, setProcsPaciente] = useState<ProcedureRecord[]>([])
  const [vincularSel, setVincularSel] = useState('')
  const [linkStaged, setLinkStaged] = useState<string[]>([])
  const [unlinkStaged, setUnlinkStaged] = useState<string[]>([])
  const orcamentoPago = pago > 0.005

  // Procedimentos do paciente (listar vinculados + permitir vincular novos) e produtos importáveis.
  useEffect(() => {
    listProcedures(quote.patient_id)
      .then((all) => { setProcsPaciente(all); setProdutosUsados(produtosDoOrcamento(all, quote.id)) })
      .catch(() => {})
  }, [quote.id, quote.patient_id])
  useEffect(() => { listTreatmentPlans(quote.patient_id).then(setPlanos).catch(() => {}) }, [quote.patient_id])

  const MSG_TRAVADO = 'Estes valores só podem ser ajustados nos respectivos painéis (Procedimentos ou Suplementação).'
  const bruto = calcItensTotal(itens)
  const total = Math.max(0, bruto - desconto)
  function setItem(idx: number, patch: Partial<QuoteItem>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  // Procedimentos vinculados "sem valor": com quote_id deste orçamento e que NÃO são itens cobráveis.
  const itemRefIds = new Set(itens.filter((i) => i.origem === 'procedimento' && i.ref_id).map((i) => i.ref_id as string))
  const vinculados = [
    ...procsPaciente.filter((p) => p.quote_id === quote.id && !itemRefIds.has(p.id) && !unlinkStaged.includes(p.id)),
    ...procsPaciente.filter((p) => linkStaged.includes(p.id)),
  ]
  const avulsosDisponiveis = procsPaciente.filter((p) => p.quote_id == null && !linkStaged.includes(p.id))
  function stageVincular() {
    if (!vincularSel) return
    setLinkStaged((s) => [...new Set([...s, vincularSel])])
    setVincularSel('')
  }
  function stageDesvincular(procId: string) {
    setLinkStaged((s) => s.filter((id) => id !== procId))
    if (procsPaciente.some((p) => p.id === procId && p.quote_id === quote.id)) {
      setUnlinkStaged((s) => [...new Set([...s, procId])])
    }
  }

  // Adiciona os produtos utilizados (com preço de venda) que ainda não estão no orçamento.
  function importarProdutos() {
    const jaTem = new Set(itens.filter((i) => i.origem === 'produto').map((i) => i.descricao))
    const novos = produtosUsados
      .filter((u) => Number(u.preco_venda) > 0 && !jaTem.has(`Produto: ${u.produto}`))
      .map((u) => produtoParaItem(u, `prod:${u.produto}`))
    if (novos.length === 0) { setAviso('Nenhum produto novo com valor de venda para importar.'); return }
    setItens((a) => [...a, ...novos])
    setAviso(`${novos.length} produto(s) adicionado(s) ao orçamento.`)
  }

  // Importa procedimentos avulsos (valor do procedimento + produtos), reconciliando (não duplica):
  // remove itens que referenciam esses procedimentos OU que tenham a mesma descrição dos novos
  // (limpa produtos soltos importados antes).
  async function importarProcedimentos() {
    const procs = await listUnbilledProcedures(quote.patient_id)
    if (procs.length === 0) { setAviso('Nenhum procedimento avulso para importar.'); return }
    const ids = procs.map((p) => p.id)
    const novos: QuoteItem[] = []
    for (const p of procs) {
      if (Number(p.valor_cobrado) > 0) novos.push({ descricao: `Procedimento: ${p.procedimento}`, qtd: 1, valor_unit: Number(p.valor_cobrado), total: Number(p.valor_cobrado), origem: 'procedimento', ref_id: p.id })
      for (const u of p.produtos_usados ?? []) { if (Number(u.preco_venda) > 0) novos.push(produtoParaItem(u, p.id)) }
    }
    const novasDesc = new Set(novos.map((n) => n.descricao))
    setItens((arr) => [...arr.filter((it) => it.descricao.trim() && !(it.ref_id && ids.includes(it.ref_id)) && !novasDesc.has(it.descricao)), ...novos])
    setProcImportados((s) => [...new Set([...s, ...ids])])
    setAviso(`${procs.length} procedimento(s) importado(s) com valor e produtos.`)
  }

  async function desvincular(idx: number) {
    const it = itens[idx]
    if (it.origem === 'procedimento' && it.ref_id) {
      try { await unlinkProcedureFromQuote(it.ref_id) } catch { /* segue removendo o item */ }
    }
    setItens((a) => a.filter((_, i) => i !== idx))
    setAviso(`${ORIGEM_LABEL[it.origem!] ?? 'Item'} desvinculado deste orçamento.`)
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim())
    if (validos.length === 0) { alert('Inclua ao menos um item.'); return }
    // Guarda contra o erro que gera crédito fantasma: total abaixo do já pago.
    if (total < pago - 0.005) {
      const credito = Math.round((pago - total) * 100) / 100
      if (!confirm(`Atenção: o total do orçamento (${brl(total)}) ficou abaixo do que já foi pago (${brl(pago)}). A diferença de ${brl(credito)} vira CRÉDITO do paciente. Deseja continuar?`)) return
    }
    // Guarda: orçamento já pago cujo total AUMENTOU → reabre saldo a receber.
    if (orcamentoPago && total > pago + 0.005) {
      const aReceber = Math.round((total - pago) * 100) / 100
      if (!confirm(`Este orçamento já tinha ${brl(pago)} pago e o novo total é ${brl(total)} — isso REABRE um saldo a receber de ${brl(aReceber)}. Para cobrar procedimentos/itens extras, o ideal é criar um NOVO orçamento (pode usar o mesmo plano). Deseja continuar mesmo assim?`)) return
    }
    setSalvando(true)
    try {
      await updateQuote(quote.id, { itens: validos, desconto, treatmentPlanId: planoId || null })
      if (procImportados.length > 0) await linkProceduresToQuote(quote.id, procImportados)
      if (linkStaged.length > 0) await linkProceduresToQuote(quote.id, linkStaged)
      for (const id of unlinkStaged) await unlinkProcedureFromQuote(id)
      onSaved()
    } catch { setSalvando(false); alert('Não foi possível salvar.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Editar itens do orçamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm text-texto/70">Plano de tratamento (vínculo)</label>
          <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
            <option value="">— Sem vínculo —</option>
            {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {itens.map((it, idx) => {
            const travado = !!it.origem
            return (
              <div key={idx}>
                <div className="flex gap-2">
                  <input
                    className={`${field} ${travado ? 'bg-black/[0.03] text-texto/70' : ''}`}
                    placeholder="Descrição" value={it.descricao} readOnly={travado}
                    onChange={(e) => !travado && setItem(idx, { descricao: e.target.value })} />
                  <input type="number" min={1}
                    className={`w-16 rounded-lg border border-black/10 px-2 py-2 text-sm ${travado ? 'bg-black/[0.03] text-texto/70' : ''}`}
                    value={it.qtd} readOnly={travado}
                    onChange={(e) => !travado && setItem(idx, { qtd: Number(e.target.value) })} />
                  <input type="number" step="0.01"
                    className={`w-28 rounded-lg border border-black/10 px-2 py-2 text-sm ${travado ? 'cursor-not-allowed bg-black/[0.03] text-texto/70' : ''}`}
                    placeholder="Valor un." value={it.valor_unit} readOnly={travado}
                    onMouseDown={() => travado && setAviso(MSG_TRAVADO)}
                    onChange={(e) => !travado && setItem(idx, { valor_unit: Number(e.target.value) })} />
                  {travado ? (
                    <button onClick={() => desvincular(idx)} className="shrink-0 rounded-md border border-amber-300 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Desvincular</button>
                  ) : (
                    <button onClick={() => setItens((a) => a.filter((_, i) => i !== idx))} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
                  )}
                </div>
                {travado && (
                  <div className="mt-0.5 text-[10px] text-amber-700">
                    {ORIGEM_LABEL[it.origem!] ?? 'Item'} vinculado · valor travado (ajuste no painel de origem)
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setItens((a) => [...a, { descricao: '', qtd: 1, valor_unit: 0, total: 0 }])} className="text-xs font-medium text-primaria hover:underline">
              + Adicionar item
            </button>
            <button onClick={importarProcedimentos} className="text-xs font-medium text-primaria hover:underline">
              + Importar procedimentos avulsos
            </button>
            {produtosUsados.some((u) => Number(u.preco_venda) > 0) && (
              <button onClick={importarProdutos} className="text-xs font-medium text-primaria hover:underline">
                + Importar só produtos (procedimentos já vinculados)
              </button>
            )}
          </div>
        </div>

        {/* Procedimentos vinculados SEM valor (só histórico — não somam ao total). */}
        <div className="mt-4 border-t border-black/5 pt-3">
          <div className="text-sm font-medium text-texto/80">Procedimentos vinculados (sem valor)</div>
          <p className="mb-2 text-[11px] text-texto/50">Associados a este orçamento apenas para histórico — <strong>não somam ao total</strong> (o valor cobrado é o do orçamento).</p>
          {vinculados.length === 0 ? (
            <p className="text-xs text-texto/40">Nenhum procedimento vinculado sem valor.</p>
          ) : (
            <div className="space-y-1">
              {vinculados.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.02] px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-texto/80">{p.procedimento}<span className="text-texto/40"> · {formatDateBR(p.data)}{p.regiao ? ` · ${p.regiao}` : ''}</span></span>
                  <button onClick={() => stageDesvincular(p.id)} className="shrink-0 text-xs font-medium text-secundaria hover:underline">Desvincular</button>
                </div>
              ))}
            </div>
          )}
          {avulsosDisponiveis.length > 0 && (
            <div className="mt-2 flex gap-2">
              <select className={field} value={vincularSel} onChange={(e) => setVincularSel(e.target.value)}>
                <option value="">Vincular procedimento existente…</option>
                {avulsosDisponiveis.map((p) => (
                  <option key={p.id} value={p.id}>{p.procedimento} · {formatDateBR(p.data)}{Number(p.valor_cobrado) > 0 ? ` · (avulso ${brl(Number(p.valor_cobrado))})` : ''}</option>
                ))}
              </select>
              <button onClick={stageVincular} disabled={!vincularSel} className="shrink-0 rounded-lg border border-primaria px-3 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-40">Vincular</button>
            </div>
          )}
          {orcamentoPago && (
            <p className="mt-1 text-[11px] text-amber-700">Orçamento já pago: vincular aqui <strong>não cobra</strong> valor extra. Para cobrar um procedimento à parte, crie um <strong>novo orçamento</strong> (pode usar o mesmo plano).</p>
          )}
        </div>

        {aviso && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{aviso}</p>}

        <div className="mt-4 space-y-1 border-t border-black/5 pt-3 text-sm">
          <div className="flex items-center justify-between text-texto/60"><span>Subtotal</span><span>{brl(bruto)}</span></div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-texto/60">Desconto{bruto > 0 && desconto > 0 ? ` (${Math.round((desconto / bruto) * 100)}%)` : ''}</span>
            <span className="flex items-center gap-2">
              {desconto > 0 && <button type="button" onClick={() => setDesconto(0)} className="text-xs font-medium text-primaria hover:underline">zerar</button>}
              <input type="number" step="0.01" min={0} className="w-28 rounded-lg border border-black/10 px-2 py-1.5 text-right" value={desconto} onChange={(e) => setDesconto(Math.max(0, Number(e.target.value)))} />
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-texto"><span>Total</span><span>{brl(total)}</span></div>
        </div>
        {total < pago - 0.005 && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            O total ({brl(total)}) está abaixo do já pago ({brl(pago)}). Ao salvar, a diferença de <strong>{brl(Math.round((pago - total) * 100) / 100)}</strong> vira crédito do paciente.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditarPagamentoModal({ pagamento, onClose, onSaved }: { pagamento: Payment; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState(String(pagamento.valor))
  const [metodo, setMetodo] = useState<PaymentMethod>(pagamento.metodo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = Number(valor)
    if (!v || v <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true)
    try { await updatePayment(pagamento.id, { valor: v, metodo }); onSaved() }
    catch { setErro('Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-texto">Editar pagamento</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Valor</label>
            <input className={field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Método</label>
            <select className={field} value={metodo} onChange={(e) => setMetodo(e.target.value as PaymentMethod)}>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão crédito</option>
              <option value="cartao_debito">Cartão débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {erro && <p className="text-sm text-secundaria">{erro}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/60 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

/** Correção (admin) do nº de parcelas: cancela o parcelamento atual (só se todas
 *  estão "a receber") e re-registra o mesmo valor total com o número correto. */
function CorrigirParcelasModal({ clinicId, patientId, quote, grupo, parcelasAtuais, onClose, onSaved }: {
  clinicId: string; patientId: string; quote: Quote; grupo: string; parcelasAtuais: number; onClose: () => void; onSaved: () => void
}) {
  const [n, setN] = useState(Math.max(2, parcelasAtuais - 1))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setErro(null); setSalvando(true)
    try {
      const total = await cancelInstallmentGroup(grupo) // cancela e devolve o total que estava parcelado
      await registerCardInstallments({ clinicId, quoteId: quote.id, patientId, valorTotal: total, parcelas: n })
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível corrigir o parcelamento.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Corrigir parcelamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <p className="mb-3 text-sm text-texto/60">
          Parcelamento atual: <strong>{parcelasAtuais}×</strong>. Ao confirmar, as parcelas atuais (a receber) são <strong>canceladas</strong> e um novo parcelamento é registrado com o <strong>mesmo valor total</strong>. Se alguma parcela já foi recebida ou estornada, a correção é bloqueada.
        </p>
        <label className="mb-1 block text-sm text-texto/70">Novo número de parcelas</label>
        <select className={field} value={n} onChange={(e) => setN(Number(e.target.value))}>
          {Array.from({ length: 11 }, (_, i) => i + 2).map((x) => <option key={x} value={x}>{x}×</option>)}
        </select>
        {erro && <p className="mt-3 text-sm text-secundaria">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/60 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Corrigir'}</button>
        </div>
      </div>
    </div>
  )
}

function PagamentoModal({ clinicId, patientId, quote, saldo, onClose, onSaved }: {
  clinicId: string; patientId: string; quote: Quote; saldo: number; onClose: () => void; onSaved: () => void
}) {
  const [valor, setValor] = useState(saldo)
  const [metodo, setMetodo] = useState<PaymentMethod>('pix')
  const [parcelas, setParcelas] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [credito, setCredito] = useState(0)

  useEffect(() => { getPatientCredit(patientId).then(setCredito).catch(() => {}) }, [patientId])

  const parcelado = metodo === 'cartao_credito' && parcelas > 1
  const valorParcela = parcelado ? valor / parcelas : valor
  // Ao usar crédito, o valor não pode passar do saldo do orçamento nem do crédito disponível.
  const maxCredito = Math.min(saldo, credito)

  function trocarMetodo(m: PaymentMethod) {
    setMetodo(m)
    if (m === 'credito') { setParcelas(1); setValor(Number(Math.min(saldo, credito).toFixed(2))) }
  }

  async function salvar() {
    if (valor <= 0) return
    if (metodo === 'credito' && valor > maxCredito + 0.005) return
    setSalvando(true)
    try {
      if (parcelado) {
        await registerCardInstallments({ clinicId, quoteId: quote.id, patientId, valorTotal: valor, parcelas })
      } else {
        await registerPayment({ clinicId, quoteId: quote.id, patientId, valor, metodo, status: 'pago' })
      }
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Registrar pagamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <p className="mb-3 text-sm text-texto/60">Saldo do orçamento: <strong>{brl(saldo)}</strong></p>
        {credito > 0.005 && (
          <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
            Este paciente tem <strong>{brl(credito)}</strong> de crédito disponível. Escolha “Crédito do paciente” para abater.
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Valor</label>
            <input type="number" step="0.01" className={field} value={valor} onChange={(e) => setValor(Number(e.target.value))} />
            {metodo === 'credito' && <p className="mt-1 text-xs text-texto/50">Máximo com crédito: <strong>{brl(maxCredito)}</strong></p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Forma de pagamento</label>
            <select className={field} value={metodo} onChange={(e) => trocarMetodo(e.target.value as PaymentMethod)}>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cartao_debito">Cartão de débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
              {credito > 0.005 && <option value="credito">Crédito do paciente ({brl(credito)})</option>}
            </select>
          </div>
          {metodo === 'cartao_credito' && (
            <div>
              <label className="mb-1 block text-sm text-texto/70">Parcelas</label>
              <select className={field} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}× {n === 1 ? '(à vista)' : `de ${brl(valor / n)}`}</option>
                ))}
              </select>
              {parcelado && (
                <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                  O paciente fica <strong>quitado</strong> agora. A clínica recebe {parcelas}× de <strong>{brl(valorParcela)}</strong>,
                  a 1ª em ~30 dias — aparecem como <strong>a receber</strong> no fluxo de caixa.
                </p>
              )}
            </div>
          )}
          {metodo === 'pix' && (
            <p className="rounded-lg bg-primaria/5 p-2 text-xs text-texto/60">
              Cobrança PIX automática via gateway será gerada quando um gateway for configurado em Configurações → Integrações.
            </p>
          )}
          {metodo === 'credito' && (
            <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
              Abatimento de <strong>{brl(valor)}</strong> do crédito do paciente neste orçamento. Não entra como receita nova (é uso de saldo já pago).
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando || valor <= 0 || (metodo === 'credito' && valor > maxCredito + 0.005)} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
