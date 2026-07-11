import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { brl, listQuotes, listPaymentsByPatient, totalLiquidado, type Payment, type Quote } from '@/lib/finance'
import { listProcedures, produtosDoOrcamento, type ProcedureRecord } from '@/lib/procedures'
import { formatDateBR } from '@/lib/format'

const METODO_LABEL: Record<string, string> = {
  pix: 'PIX', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito',
  dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro', credito: 'Crédito do paciente',
}

export default function PatientFinance() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedureRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!patientId) return
    Promise.all([listQuotes(patientId), listPaymentsByPatient(patientId), listProcedures(patientId)])
      .then(([q, p, proc]) => { setQuotes(q); setPagamentos(p); setProcedimentos(proc) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [patientId])

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Financeiro</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Seus orçamentos e pagamentos.</p>

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum orçamento.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const pago = totalLiquidado(pagamentos, q.id)
            const saldo = q.valor_total - pago
            const produtos = produtosDoOrcamento(procedimentos, q.id)
            const avista = pagamentos.filter((p) => p.quote_id === q.id && !p.parcelamento_grupo && p.status === 'pago').sort((a, b) => (a.pago_em ?? '').localeCompare(b.pago_em ?? ''))
            const parcelas = pagamentos.filter((p) => p.quote_id === q.id && p.parcelamento_grupo).sort((a, b) => a.parcela - b.parcela)
            const estornadas = parcelas.filter((p) => p.status === 'estornado')
            return (
              <div key={q.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-texto/50">
                  <span>Orçamento {q.numero ?? ''}</span>
                  <span>{formatDateBR(q.created_at)}</span>
                </div>
                <div className="space-y-1.5 text-sm text-texto/80">
                  {q.itens.map((it, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <span className="flex-1">
                        {it.qtd}× {it.descricao}
                        {it.origem && <span className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-texto/60">{({ procedimento: 'Procedimento', suplementacao: 'Suplementação', produto: 'Produto' } as Record<string, string>)[it.origem]}</span>}
                        {Number(it.valor_unit) > 0 && it.qtd > 1 && (
                          <span className="block text-xs text-texto/40">{brl(Number(it.valor_unit))} cada</span>
                        )}
                      </span>
                      <span className="whitespace-nowrap font-medium text-texto">{brl(Number(it.total))}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2 text-sm">
                  {Number(q.desconto) > 0 && (
                    <>
                      <div className="flex items-center justify-between text-texto/60"><span>Subtotal</span><span>{brl(Number(q.valor_bruto))}</span></div>
                      <div className="flex items-center justify-between text-texto/60"><span>Desconto</span><span>− {brl(Number(q.desconto))}</span></div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-texto">Total {brl(q.valor_total)}</span>
                    <span className={saldo > 0 ? 'font-medium text-secundaria' : 'font-medium text-emerald-600'}>
                      {saldo > 0 ? `Saldo ${brl(saldo)}` : 'Quitado'}
                    </span>
                  </div>
                </div>
                {avista.length > 0 && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <div className="mb-1 text-xs font-medium text-texto/60">Pagamentos</div>
                    <div className="space-y-0.5 text-xs text-texto/70">
                      {avista.map((p) => (
                        <div key={p.id} className="flex items-center justify-between">
                          <span>{METODO_LABEL[p.metodo] ?? p.metodo}{p.pago_em ? ` · ${formatDateBR(p.pago_em)}` : ''}</span>
                          <span className="font-medium">{brl(Number(p.valor))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parcelas.length > 0 && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <div className="mb-1 text-xs font-medium text-texto/60">Pagamento no cartão ({parcelas[0].total_parcelas}×)</div>
                    {estornadas.length > 0 && (
                      <p className="mb-1 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                        {estornadas.length === parcelas.length ? 'Pagamento estornado (chargeback)' : `${estornadas.length} parcela(s) estornada(s)`} — o valor de {brl(estornadas.reduce((s, p) => s + Number(p.valor), 0))} voltou a ficar <strong>pendente</strong>.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {parcelas.map((p) => (
                        <span key={p.id} className={`rounded-full px-2 py-0.5 text-[11px] ${p.status === 'estornado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {p.parcela}/{p.total_parcelas} {p.status === 'estornado' ? 'estornada' : 'paga'}{p.vencimento ? ` · ${formatDateBR(p.vencimento)}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {produtos.length > 0 && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <div className="mb-1 text-xs font-medium text-texto/60">Produtos utilizados</div>
                    <div className="flex flex-wrap gap-1.5">
                      {produtos.map((u, i) => (
                        <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">
                          {u.produto} ×{u.qtd}
                          {u.lote && <span className="opacity-70"> · lote {u.lote}</span>}
                          {u.validade && <span className="opacity-70"> · val {formatDateBR(u.validade)}</span>}
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
