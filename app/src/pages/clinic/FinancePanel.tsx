import { useEffect, useState } from 'react'
import {
  brl,
  calcItensTotal,
  createQuote,
  deletePayment,
  deleteQuote,
  listPaymentsByPatient,
  listQuotes,
  registerPayment,
  totalPago,
  updatePayment,
  updateQuote,
  type Payment,
  type PaymentMethod,
  type Quote,
  type QuoteItem,
} from '@/lib/finance'
import { listProcedures, listUnbilledProcedures, linkProceduresToQuote, unlinkProcedureFromQuote, produtosDoOrcamento, type ProcedureRecord } from '@/lib/procedures'
import { listTreatmentPlans, type TreatmentPlan } from '@/lib/treatmentPlans'
import { listUnpaidSupplementations } from '@/lib/supplementations'
import { createSharedDocument, listSharedDocuments, type SharedDocument } from '@/lib/sharedDocs'
import { buildOrcamentoPdf } from '@/lib/orcamentoPdf'
import { useClinic } from '@/theme/ThemeProvider'
import { formatDateBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
  pacienteNome?: string
}

export default function FinancePanel({ patientId, clinicId, professionalId, pacienteNome }: Props) {
  const clinic = useClinic()
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
  const metodoLabel: Record<string, string> = {
    pix: 'PIX', cartao_credito: 'Cartão crédito', cartao_debito: 'Cartão débito',
    dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro',
  }

  async function excluirOrc(q: Quote) {
    const pago = totalPago(pagamentos, q.id)
    if (pago > 0) { alert('Este orçamento já tem pagamento registrado. Exclua/estorne os pagamentos antes.'); return }
    if (!confirm('Excluir este orçamento?')) return
    try { await deleteQuote(q.id); recarregar() }
    catch { alert('Não foi possível excluir (há vínculos como pagamentos ou procedimentos).') }
  }

  function recarregar() {
    Promise.all([listQuotes(patientId), listPaymentsByPatient(patientId), listProcedures(patientId), listSharedDocuments(patientId)])
      .then(([q, p, proc, sd]) => {
        setQuotes(q)
        setPagamentos(p)
        setProcedimentos(proc)
        setCompartilhados(sd)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

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
          onClose={() => setEditandoOrc(null)}
          onSaved={() => { setEditandoOrc(null); recarregar() }}
        />
      )}
      {pagandoQuote && (
        <PagamentoModal
          clinicId={clinicId}
          patientId={patientId}
          quote={pagandoQuote}
          saldo={pagandoQuote.valor_total - totalPago(pagamentos, pagandoQuote.id)}
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

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum orçamento.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const pago = totalPago(pagamentos, q.id)
            const saldo = q.valor_total - pago
            const produtos = produtosDoOrcamento(procedimentos, q.id)
            return (
              <div key={q.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-texto/50">{new Date(q.created_at).toLocaleDateString('pt-BR')}</div>
                    <div className="mt-1 space-y-0.5 text-sm text-texto/80">
                      {q.itens.map((it, i) => (
                        <div key={i}>{it.qtd}× {it.descricao} — {brl(it.total)}</div>
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
                  const pgs = pagamentos.filter((p) => p.quote_id === q.id && p.status === 'pago')
                  if (pgs.length === 0) return null
                  return (
                    <div className="mt-3 border-t border-black/5 pt-3">
                      <div className="mb-1 text-xs font-medium text-texto/60">Pagamentos</div>
                      <div className="space-y-1">
                        {pgs.map((p) => (
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
                    </div>
                  )
                })()}
                {produtos.length > 0 && (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <div className="mb-1 text-xs font-medium text-texto/60">Produtos utilizados</div>
                    <div className="flex flex-wrap gap-1.5">
                      {produtos.map((u, i) => (
                        <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">
                          {u.produto} ×{u.qtd}
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
    const novos: QuoteItem[] = procs.map((p) => ({ descricao: `Procedimento: ${p.procedimento}`, qtd: 1, valor_unit: Number(p.valor_cobrado) || 0, total: Number(p.valor_cobrado) || 0, origem: 'procedimento', ref_id: p.id }))
    setProcImportados((ids) => [...new Set([...ids, ...procs.map((p) => p.id)])])
    setItens((arr) => [...arr.filter((i) => i.descricao.trim()), ...novos])
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
                {travado && <div className="mt-0.5 text-[10px] text-amber-700">{it.origem === 'procedimento' ? 'Procedimento' : 'Suplementação'} importado · valor travado (✕ para desvincular)</div>}
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

function EditarItensModal({ quote, onClose, onSaved }: { quote: Quote; onClose: () => void; onSaved: () => void }) {
  const [itens, setItens] = useState<QuoteItem[]>(
    quote.itens?.length ? quote.itens.map((i) => ({ ...i })) : [{ descricao: '', qtd: 1, valor_unit: 0, total: 0 }],
  )
  const [desconto, setDesconto] = useState(Number(quote.desconto) || 0)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const MSG_TRAVADO = 'Estes valores só podem ser ajustados nos respectivos painéis (Procedimentos ou Suplementação).'
  const bruto = calcItensTotal(itens)
  const total = Math.max(0, bruto - desconto)
  function setItem(idx: number, patch: Partial<QuoteItem>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function desvincular(idx: number) {
    const it = itens[idx]
    if (it.origem === 'procedimento' && it.ref_id) {
      try { await unlinkProcedureFromQuote(it.ref_id) } catch { /* segue removendo o item */ }
    }
    setItens((a) => a.filter((_, i) => i !== idx))
    setAviso(`${it.origem === 'procedimento' ? 'Procedimento' : 'Suplementação'} desvinculado deste orçamento.`)
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim())
    if (validos.length === 0) { alert('Inclua ao menos um item.'); return }
    setSalvando(true)
    try { await updateQuote(quote.id, { itens: validos, desconto }); onSaved() }
    catch { setSalvando(false); alert('Não foi possível salvar.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Editar itens do orçamento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
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
                    {it.origem === 'procedimento' ? 'Procedimento vinculado' : 'Suplementação vinculada'} · valor travado (ajuste no painel de origem)
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => setItens((a) => [...a, { descricao: '', qtd: 1, valor_unit: 0, total: 0 }])} className="text-xs font-medium text-primaria hover:underline">
            + Adicionar item
          </button>
        </div>

        {aviso && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{aviso}</p>}

        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <span className="text-texto/60">Desconto</span>
          <input type="number" step="0.01" className="w-28 rounded-lg border border-black/10 px-2 py-1.5" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
        </div>
        <div className="mt-2 text-right text-lg font-semibold text-texto">Total: {brl(total)}</div>

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

function PagamentoModal({ clinicId, patientId, quote, saldo, onClose, onSaved }: {
  clinicId: string; patientId: string; quote: Quote; saldo: number; onClose: () => void; onSaved: () => void
}) {
  const [valor, setValor] = useState(saldo)
  const [metodo, setMetodo] = useState<PaymentMethod>('pix')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (valor <= 0) return
    setSalvando(true)
    try {
      await registerPayment({ clinicId, quoteId: quote.id, patientId, valor, metodo, status: 'pago' })
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
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Valor</label>
            <input type="number" step="0.01" className={field} value={valor} onChange={(e) => setValor(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Forma de pagamento</label>
            <select className={field} value={metodo} onChange={(e) => setMetodo(e.target.value as PaymentMethod)}>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cartao_debito">Cartão de débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {metodo === 'pix' && (
            <p className="rounded-lg bg-primaria/5 p-2 text-xs text-texto/60">
              Cobrança PIX automática via gateway será gerada quando um gateway for configurado em Configurações → Integrações.
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
