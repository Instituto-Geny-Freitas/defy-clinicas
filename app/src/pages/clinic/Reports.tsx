import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { brl, listAllQuotes } from '@/lib/finance'
import { estoqueBaixo, listInventory, validadeProxima } from '@/lib/inventory'
import { listExpenses, listPaymentsPeriodo } from '@/lib/cashflow'
import { buildMapaMensalPdf, type Linha } from '@/lib/mapaMensalPdf'
import { listNpsResponses, calcNps, type NpsResponse } from '@/lib/nps'
import { getGestaoConfig } from '@/lib/gestao'
import { listProfessionals } from '@/lib/settings'
import { useClinic } from '@/theme/ThemeProvider'
import { formatDateBR } from '@/lib/format'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
function monthRange(ano: number, mes: number): { de: string; ate: string } {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const mm = String(mes + 1).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

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
  faltasMes: number
  taxaFaltaMes: number
  ticketMedio: number
  taxaConversao: number
  metaMensal: number
}

interface ComissaoProf { nome: string; receita: number; pct: number; comissao: number }

export default function Reports() {
  const [r, setR] = useState<Resumo | null>(null)
  const [porMetodo, setPorMetodo] = useState<Record<string, number>>({})
  const [comissoes, setComissoes] = useState<ComissaoProf[]>([])
  const [nps, setNps] = useState<NpsResponse[]>([])

  useEffect(() => {
    listNpsResponses(300).then(setNps).catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
      const isoMes = inicioMes.toISOString()

      const [pays, saldos, inv, procs, appts, faltas, totQuotes, convQuotes, cfg, profs] = await Promise.all([
        supabase.from('payments').select('valor, metodo, pago_em, status, patient_id, quotes(professional_id)').eq('status', 'pago').neq('metodo', 'credito'),
        supabase.from('v_quote_balances').select('saldo_a_receber'),
        listInventory(),
        supabase.from('procedures_log').select('id', { count: 'exact', head: true }).gte('data', isoMes),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'realizado').gte('inicio', isoMes),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'faltou').gte('inicio', isoMes),
        supabase.from('quotes').select('id', { count: 'exact', head: true }),
        supabase.from('v_quote_balances').select('quote_id', { count: 'exact', head: true }).gt('total_pago', 0),
        getGestaoConfig(),
        listProfessionals(),
      ])

      const pagamentos = pays.data ?? []
      const doMes = pagamentos.filter((p) => p.pago_em && p.pago_em >= isoMes)
      const recebidoTotal = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
      const recebidoMes = doMes.reduce((s, p) => s + Number(p.valor), 0)
      const metodos: Record<string, number> = {}
      for (const p of doMes) metodos[p.metodo] = (metodos[p.metodo] ?? 0) + Number(p.valor)
      setPorMetodo(metodos)

      // Ticket médio do mês = recebido / nº de pacientes distintos que pagaram.
      const pagantes = new Set(doMes.map((p) => p.patient_id).filter(Boolean))
      const ticketMedio = pagantes.size > 0 ? recebidoMes / pagantes.size : 0

      // Comissões do mês: receita atribuída ao profissional do orçamento do pagamento.
      const nomeProf = new Map(profs.map((p) => [p.id, p.nome]))
      const receitaPorProf = new Map<string, number>()
      for (const p of doMes) {
        const q = p.quotes as { professional_id?: string | null } | { professional_id?: string | null }[] | null
        const profId = Array.isArray(q) ? q[0]?.professional_id : q?.professional_id
        if (!profId) continue
        receitaPorProf.set(profId, (receitaPorProf.get(profId) ?? 0) + Number(p.valor))
      }
      const comis: ComissaoProf[] = [...receitaPorProf.entries()]
        .map(([id, receita]) => {
          const pct = Number(cfg.comissoes[id]) || 0
          return { nome: nomeProf.get(id) ?? '—', receita, pct, comissao: Math.round(receita * pct) / 100 }
        })
        .sort((a, b) => b.receita - a.receita)
      setComissoes(comis)

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
        faltasMes: faltas.count ?? 0,
        taxaFaltaMes: (appts.count ?? 0) + (faltas.count ?? 0) > 0
          ? Math.round(((faltas.count ?? 0) / ((appts.count ?? 0) + (faltas.count ?? 0))) * 100)
          : 0,
        ticketMedio,
        taxaConversao: (totQuotes.count ?? 0) > 0 ? Math.round(((convQuotes.count ?? 0) / (totQuotes.count ?? 1)) * 100) : 0,
        metaMensal: cfg.metaMensal,
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

  const nps90 = nps.filter((n) => (Date.now() - new Date(n.created_at).getTime()) / 86400000 <= 90)
  const npsCalc = calcNps(nps90)
  const npsCor = npsCalc.nps >= 50 ? 'text-emerald-600' : npsCalc.nps >= 0 ? 'text-amber-600' : 'text-secundaria'
  const comentarios = nps.filter((n) => n.comentario && n.comentario.trim()).slice(0, 6)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Relatórios</h1>
      <p className="mt-1 text-sm text-texto/60">Mês atual e visão geral</p>

      <MapaMensal />


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

      <h2 className="mt-8 mb-2 text-sm font-semibold text-texto/70">Gestão financeira</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card('Ticket médio (mês)', brl(r.ticketMedio))}
        {card('Conversão de orçamentos', `${r.taxaConversao}%`, r.taxaConversao >= 50 ? 'text-emerald-600' : r.taxaConversao > 0 ? 'text-amber-600' : 'text-primaria')}
        {card('Meta do mês', r.metaMensal > 0 ? brl(r.metaMensal) : '—')}
        {(() => {
          const pct = r.metaMensal > 0 ? Math.round((r.recebidoMes / r.metaMensal) * 100) : 0
          const cor = r.metaMensal <= 0 ? 'text-primaria' : pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-secundaria'
          return card('Realizado da meta', r.metaMensal > 0 ? `${pct}%` : '—', cor)
        })()}
      </div>
      {comissoes.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <div className="border-b border-black/5 px-4 py-2 text-sm font-semibold text-texto/70">Comissões por profissional (mês)</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
                <th className="px-4 py-2 font-medium">Profissional</th>
                <th className="px-4 py-2 font-medium text-right">Receita</th>
                <th className="px-4 py-2 font-medium text-right">%</th>
                <th className="px-4 py-2 font-medium text-right">Comissão</th>
              </tr></thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.nome} className="border-t border-black/5">
                    <td className="px-4 py-2 text-texto">{c.nome}</td>
                    <td className="px-4 py-2 text-right text-texto/70">{brl(c.receita)}</td>
                    <td className="px-4 py-2 text-right text-texto/60">{c.pct > 0 ? `${c.pct}%` : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-600">{brl(c.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-texto/50">Receita atribuída ao profissional do orçamento; configure os percentuais em Configurações → Metas.</p>
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
        {card('Atendimentos realizados', String(r.atendimentosMes))}
        {card('Faltas no mês', String(r.faltasMes), r.faltasMes > 0 ? 'text-secundaria' : 'text-primaria')}
        {card('Taxa de faltas', `${r.taxaFaltaMes}%`, r.taxaFaltaMes >= 20 ? 'text-secundaria' : r.taxaFaltaMes > 0 ? 'text-amber-600' : 'text-primaria')}
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold text-texto/70">Satisfação (NPS — últimos 90 dias)</h2>
      {npsCalc.total === 0 ? (
        <p className="rounded-xl border border-black/5 bg-white p-5 text-sm text-texto/50">Ainda sem respostas de pesquisa de satisfação.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {card('NPS', String(npsCalc.nps), npsCor)}
            {card('Respostas', String(npsCalc.total))}
            {card('Promotores (9-10)', String(npsCalc.promotores), 'text-emerald-600')}
            {card('Detratores (0-6)', String(npsCalc.detratores), npsCalc.detratores > 0 ? 'text-secundaria' : 'text-primaria')}
          </div>
          {comentarios.length > 0 && (
            <div className="mt-4 rounded-xl border border-black/5 bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-texto/70">Comentários recentes</h3>
              <ul className="space-y-2">
                {comentarios.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${c.score >= 9 ? 'bg-emerald-100 text-emerald-700' : c.score >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{c.score}</span>
                    <span className="text-texto/80">“{c.comentario}” <span className="text-texto/40">— {c.patients?.nome ?? 'Paciente'}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Mapa financeiro mensal (4 colunas) ------------------------------------
interface BalanceRow { quote_id: string; saldo_a_receber: number }

function MapaMensal() {
  const clinic = useClinic()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())
  const [fixas, setFixas] = useState<Linha[]>([])
  const [produtos, setProdutos] = useState<Linha[]>([])
  const [pagamentos, setPagamentos] = useState<Linha[]>([])
  const [aReceber, setAReceber] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)

  const { de, ate } = useMemo(() => monthRange(ano, mes), [ano, mes])
  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 4 + i)

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      listExpenses(de, ate),
      listPaymentsPeriodo(de, ate),
      listAllQuotes(),
      supabase.from('v_quote_balances').select('quote_id, saldo_a_receber'),
    ])
      .then(([desp, pays, quotes, bal]) => {
        const descDespesa = (d: typeof desp[number]) =>
          `${formatDateBR(d.data)} · ${d.expense_types?.nome ?? 'Despesa'}${d.descricao ? ' — ' + d.descricao : ''}${d.parcela_total ? ` (${d.parcela_num}/${d.parcela_total})` : ''}`
        setFixas(desp.filter((d) => d.classificacao === 'fixo').map((d) => ({ descricao: descDespesa(d), valor: Number(d.valor) })))
        setProdutos(desp.filter((d) => d.classificacao === 'produto').map((d) => ({ descricao: descDespesa(d), valor: Number(d.valor) })))
        setPagamentos(pays.map((p) => ({ descricao: `${p.patients?.nome ?? 'Cliente'} · ${p.metodo}`, valor: Number(p.valor) })))

        // A receber por cliente (saldo atual dos orçamentos).
        const saldoMap = new Map<string, number>()
        for (const b of (bal.data ?? []) as BalanceRow[]) saldoMap.set(b.quote_id, Number(b.saldo_a_receber))
        const porCliente = new Map<string, number>()
        for (const q of quotes) {
          const saldo = saldoMap.has(q.id) ? saldoMap.get(q.id)! : Number(q.valor_total)
          if (saldo > 0.005) {
            const nome = q.patients?.nome ?? 'Cliente'
            porCliente.set(nome, (porCliente.get(nome) ?? 0) + saldo)
          }
        }
        setAReceber(Array.from(porCliente, ([nome, valor]) => ({ descricao: nome, valor })).sort((a, b) => b.valor - a.valor))
      })
      .catch(() => { setFixas([]); setProdutos([]); setPagamentos([]); setAReceber([]) })
      .finally(() => setCarregando(false))
  }, [de, ate])

  const soma = (l: Linha[]) => l.reduce((s, x) => s + x.valor, 0)
  const totFixas = soma(fixas), totProd = soma(produtos), totPag = soma(pagamentos), totReceber = soma(aReceber)
  const periodoLabel = `${MESES[mes]} de ${ano}`

  function exportar() {
    const { blob, filename } = buildMapaMensalPdf({ clinic, periodoLabel, despesasFixas: fixas, produtos, pagamentos, aReceber })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const colunas = [
    { titulo: 'Despesas fixas', linhas: fixas, total: totFixas, cor: 'bg-violet-600' },
    { titulo: 'Produtos e materiais', linhas: produtos, total: totProd, cor: 'bg-sky-600' },
    { titulo: 'Pagamentos das clientes', linhas: pagamentos, total: totPag, cor: 'bg-emerald-600' },
    { titulo: 'A receber das clientes', linhas: aReceber, total: totReceber, cor: 'bg-amber-500' },
  ]
  const saldoMes = totPag - (totFixas + totProd)

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-texto/70">Mapa financeiro mensal</h2>
        <div className="flex gap-2">
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={exportar} className="rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5">Exportar PDF</button>
        </div>
      </div>

      {carregando ? (
        <p className="p-6 text-sm text-texto/50">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {colunas.map((c) => (
              <div key={c.titulo} className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white">
                <div className={`${c.cor} px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white`}>{c.titulo}</div>
                <div className="max-h-80 flex-1 overflow-auto">
                  {c.linhas.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-texto/40">Sem lançamentos.</p>
                  ) : c.linhas.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 border-b border-black/5 px-3 py-1.5 text-xs">
                      <span className="text-texto/70">{l.descricao}</span>
                      <span className="shrink-0 font-medium text-texto">{brl(l.valor)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-black/10 bg-black/[0.02] px-3 py-2 text-sm font-semibold">
                  <span className="text-texto/70">Total</span><span className="text-texto">{brl(c.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-black/5 bg-white p-4"><div className="text-lg font-semibold text-emerald-600">{brl(totPag)}</div><div className="text-xs text-texto/60">Recebido no mês</div></div>
            <div className="rounded-xl border border-black/5 bg-white p-4"><div className="text-lg font-semibold text-secundaria">{brl(totFixas + totProd)}</div><div className="text-xs text-texto/60">Despesas pagas/lançadas</div></div>
            <div className="rounded-xl border border-black/5 bg-white p-4"><div className={`text-lg font-semibold ${saldoMes >= 0 ? 'text-emerald-600' : 'text-secundaria'}`}>{brl(saldoMes)}</div><div className="text-xs text-texto/60">Saldo do mês</div></div>
            <div className="rounded-xl border border-black/5 bg-white p-4"><div className="text-lg font-semibold text-amber-600">{brl(totReceber)}</div><div className="text-xs text-texto/60">A receber (total)</div></div>
          </div>
        </>
      )}
    </div>
  )
}
