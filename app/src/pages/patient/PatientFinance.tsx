import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { brl, listQuotes, listPaymentsByPatient, totalPago, type Payment, type Quote } from '@/lib/finance'

export default function PatientFinance() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!patientId) return
    Promise.all([listQuotes(patientId), listPaymentsByPatient(patientId)])
      .then(([q, p]) => { setQuotes(q); setPagamentos(p) })
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
            const pago = totalPago(pagamentos, q.id)
            const saldo = q.valor_total - pago
            return (
              <div key={q.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="space-y-0.5 text-sm text-texto/80">
                  {q.itens.map((it, i) => (
                    <div key={i}>{it.qtd}× {it.descricao}</div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-sm">
                  <span className="font-semibold text-texto">{brl(q.valor_total)}</span>
                  <span className={saldo > 0 ? 'font-medium text-secundaria' : 'font-medium text-emerald-600'}>
                    {saldo > 0 ? `Saldo ${brl(saldo)}` : 'Quitado'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
