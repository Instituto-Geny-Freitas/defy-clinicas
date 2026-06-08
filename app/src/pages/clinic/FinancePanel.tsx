import { useEffect, useState } from 'react'
import {
  brl,
  calcItensTotal,
  createQuote,
  listPaymentsByPatient,
  listQuotes,
  registerPayment,
  totalPago,
  type Payment,
  type PaymentMethod,
  type Quote,
  type QuoteItem,
} from '@/lib/finance'
import { listProcedures, produtosDoOrcamento, type ProcedureRecord } from '@/lib/procedures'
import { listTreatmentPlans, type TreatmentPlan } from '@/lib/treatmentPlans'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
}

export default function FinancePanel({ patientId, clinicId, professionalId }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedureRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalOrc, setModalOrc] = useState(false)
  const [pagandoQuote, setPagandoQuote] = useState<Quote | null>(null)

  function recarregar() {
    Promise.all([listQuotes(patientId), listPaymentsByPatient(patientId), listProcedures(patientId)])
      .then(([q, p, proc]) => {
        setQuotes(q)
        setPagamentos(p)
        setProcedimentos(proc)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

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
                <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
                  <span className="text-texto/60">Pago {brl(pago)}</span>
                  <span className={saldo > 0 ? 'font-semibold text-secundaria' : 'font-semibold text-emerald-600'}>
                    {saldo > 0 ? `Saldo ${brl(saldo)}` : 'Quitado'}
                  </span>
                  {saldo > 0 && (
                    <button onClick={() => setPagandoQuote(q)} className="rounded-md bg-primaria px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                      Registrar pagamento
                    </button>
                  )}
                </div>
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
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listTreatmentPlans(patientId).then((ps) => { setPlanos(ps); if (ps.length) setPlanoId(ps[0].id) }).catch(() => {})
  }, [patientId])

  const bruto = calcItensTotal(itens)
  const total = Math.max(0, bruto - desconto)

  function setItem(idx: number, patch: Partial<QuoteItem>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function salvar() {
    const validos = itens.filter((i) => i.descricao.trim())
    if (validos.length === 0) return
    setSalvando(true)
    try {
      await createQuote({ clinicId, patientId, professionalId, treatmentPlanId: planoId || null, itens: validos, desconto })
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
            {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {new Date(p.data).toLocaleDateString('pt-BR')}</option>)}
          </select>
          {planos.length === 0 && <p className="mt-1 text-xs text-texto/40">Crie um plano na aba "Plano" para vincular.</p>}
        </div>

        <div className="space-y-2">
          {itens.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <input className={field} placeholder="Descrição" value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value })} />
              <input type="number" min={1} className="w-16 rounded-lg border border-black/10 px-2 py-2 text-sm" value={it.qtd} onChange={(e) => setItem(idx, { qtd: Number(e.target.value) })} />
              <input type="number" step="0.01" className="w-28 rounded-lg border border-black/10 px-2 py-2 text-sm" placeholder="Valor un." value={it.valor_unit} onChange={(e) => setItem(idx, { valor_unit: Number(e.target.value) })} />
              <button onClick={() => setItens((a) => a.filter((_, i) => i !== idx))} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
            </div>
          ))}
          <button onClick={() => setItens((a) => [...a, { descricao: '', qtd: 1, valor_unit: 0, total: 0 }])} className="text-xs font-medium text-primaria hover:underline">
            + Adicionar item
          </button>
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
