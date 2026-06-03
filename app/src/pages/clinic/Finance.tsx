import { useEffect, useState } from 'react'
import { listAllQuotes, brl, type Quote } from '@/lib/finance'
import { supabase } from '@/lib/supabase'

interface BalanceRow {
  quote_id: string
  saldo_a_receber: number
  total_pago: number
}

export default function Finance() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [saldos, setSaldos] = useState<Record<string, BalanceRow>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function load() {
      const qs = await listAllQuotes()
      setQuotes(qs)
      const { data } = await supabase
        .from('v_quote_balances')
        .select('quote_id, saldo_a_receber, total_pago')
      const map: Record<string, BalanceRow> = {}
      for (const r of data ?? []) map[r.quote_id] = r
      setSaldos(map)
    }
    load().catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const totalReceber = Object.values(saldos).reduce((s, r) => s + Number(r.saldo_a_receber), 0)
  const totalRecebido = Object.values(saldos).reduce((s, r) => s + Number(r.total_pago), 0)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Financeiro</h1>
      <p className="mt-1 text-sm text-texto/60">Orçamentos e valores a receber</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <div className="text-2xl font-semibold text-emerald-600">{brl(totalRecebido)}</div>
          <div className="text-sm text-texto/60">Recebido</div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <div className="text-2xl font-semibold text-secundaria">{brl(totalReceber)}</div>
          <div className="text-sm text-texto/60">A receber</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : quotes.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum orçamento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Pago</th>
                <th className="px-4 py-2 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const b = saldos[q.id]
                const saldo = b ? Number(b.saldo_a_receber) : q.valor_total
                return (
                  <tr key={q.id} className="border-t border-black/5">
                    <td className="px-4 py-2 text-texto">{q.patients?.nome ?? '—'}</td>
                    <td className="px-4 py-2 text-texto/60">{new Date(q.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2 text-texto/70">{brl(q.valor_total)}</td>
                    <td className="px-4 py-2 text-texto/70">{brl(b ? Number(b.total_pago) : 0)}</td>
                    <td className={`px-4 py-2 font-medium ${saldo > 0 ? 'text-secundaria' : 'text-emerald-600'}`}>
                      {saldo > 0 ? brl(saldo) : 'Quitado'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
