import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/finance'
import { estoqueBaixo, listInventory, validadeProxima } from '@/lib/inventory'

interface Resumo {
  recebidoMes: number
  recebidoTotal: number
  aReceber: number
  estoqueBaixo: number
  estoqueValidade: number
  custoEstoque: number
  vendaEstoque: number
  procedimentosMes: number
  atendimentosMes: number
}

export default function Reports() {
  const [r, setR] = useState<Resumo | null>(null)
  const [porMetodo, setPorMetodo] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
      const isoMes = inicioMes.toISOString()

      const [pays, saldos, inv, procs, appts] = await Promise.all([
        supabase.from('payments').select('valor, metodo, pago_em, status').eq('status', 'pago'),
        supabase.from('v_quote_balances').select('saldo_a_receber'),
        listInventory(),
        supabase.from('procedures_log').select('id', { count: 'exact', head: true }).gte('data', isoMes),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'realizado').gte('inicio', isoMes),
      ])

      const pagamentos = pays.data ?? []
      const recebidoTotal = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
      const recebidoMes = pagamentos.filter((p) => p.pago_em && p.pago_em >= isoMes).reduce((s, p) => s + Number(p.valor), 0)
      const metodos: Record<string, number> = {}
      for (const p of pagamentos.filter((p) => p.pago_em && p.pago_em >= isoMes)) metodos[p.metodo] = (metodos[p.metodo] ?? 0) + Number(p.valor)
      setPorMetodo(metodos)

      setR({
        recebidoMes,
        recebidoTotal,
        aReceber: (saldos.data ?? []).reduce((s, x) => s + Number(x.saldo_a_receber), 0),
        estoqueBaixo: inv.filter(estoqueBaixo).length,
        estoqueValidade: inv.filter(validadeProxima).length,
        custoEstoque: inv.reduce((s, i) => s + i.custo_unit * i.qtd_atual, 0),
        vendaEstoque: inv.reduce((s, i) => s + i.preco_venda * i.qtd_atual, 0),
        procedimentosMes: procs.count ?? 0,
        atendimentosMes: appts.count ?? 0,
      })
    }
    load().catch(() => {})
  }, [])

  if (!r) return <p className="text-sm text-texto/50">Carregando relatórios…</p>

  const card = (label: string, valor: string, cor = 'text-primaria') => (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <div className={`text-2xl font-semibold ${cor}`}>{valor}</div>
      <div className="mt-1 text-sm text-texto/70">{label}</div>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Relatórios</h1>
      <p className="mt-1 text-sm text-texto/60">Mês atual e visão geral</p>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-texto/70">Faturamento</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card('Recebido no mês', brl(r.recebidoMes), 'text-emerald-600')}
        {card('A receber', brl(r.aReceber), 'text-secundaria')}
        {card('Recebido (total)', brl(r.recebidoTotal))}
        {card('Atendimentos no mês', String(r.atendimentosMes))}
      </div>
      {Object.keys(porMetodo).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-texto/60">
          {Object.entries(porMetodo).map(([m, v]) => (
            <span key={m} className="rounded-full bg-black/5 px-2 py-0.5">{m}: {brl(v)}</span>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-2 text-sm font-semibold text-texto/70">Estoque</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card('Valor de custo', brl(r.custoEstoque))}
        {card('Valor de venda', brl(r.vendaEstoque))}
        {card('Itens em baixa', String(r.estoqueBaixo), r.estoqueBaixo > 0 ? 'text-secundaria' : 'text-primaria')}
        {card('Validade próxima', String(r.estoqueValidade), r.estoqueValidade > 0 ? 'text-amber-600' : 'text-primaria')}
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold text-texto/70">Atendimento</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card('Procedimentos no mês', String(r.procedimentosMes))}
      </div>
    </div>
  )
}
