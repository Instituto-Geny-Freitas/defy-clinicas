import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listAllQuotes, registerPayment, updatePayment, deletePayment, brl, type PaymentMethod, type Quote } from '@/lib/finance'
import { buildRelatorioFinanceiroPdf } from '@/lib/relatorioFinanceiroPdf'
import { supabase } from '@/lib/supabase'
import { formatDateBR } from '@/lib/format'
import {
  createExpense,
  createMovement,
  deleteExpense,
  deleteMovement,
  listExpenseTypes,
  listExpenses,
  listMovements,
  listPaymentsPeriodo,
  setExpensePaid,
  updateExpense,
  type Classificacao,
  type Expense,
  type ExpenseType,
  type FinancialMovement,
  type FormaPagamento,
  type MovTipo,
  type PaymentRow,
  type Periodo,
} from '@/lib/cashflow'

type Tab = 'consolidado' | 'receitas' | 'despesas' | 'caixa' | 'relatorio'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

function monthRange(ano: number, mes: number): { de: string; ate: string } {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const mm = String(mes + 1).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

interface BalanceRow { quote_id: string; saldo_a_receber: number; total_pago: number }

export default function Finance() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id ?? ''
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())
  const [tab, setTab] = useState<Tab>('consolidado')

  const [pagamentos, setPagamentos] = useState<PaymentRow[]>([])
  const [despesas, setDespesas] = useState<Expense[]>([])
  const [movimentos, setMovimentos] = useState<FinancialMovement[]>([])
  const [tipos, setTipos] = useState<ExpenseType[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [saldos, setSaldos] = useState<Record<string, BalanceRow>>({})
  const [carregando, setCarregando] = useState(true)

  const { de, ate } = useMemo(() => monthRange(ano, mes), [ano, mes])

  function recarregar() {
    setCarregando(true)
    Promise.all([
      listPaymentsPeriodo(de, ate),
      listExpenses(de, ate),
      listMovements(),
      listExpenseTypes(),
      listAllQuotes(),
      supabase.from('v_quote_balances').select('quote_id, saldo_a_receber, total_pago'),
    ])
      .then(([pg, dp, mv, tp, qs, bal]) => {
        setPagamentos(pg)
        setDespesas(dp)
        setMovimentos(mv)
        setTipos(tp)
        setQuotes(qs)
        const map: Record<string, BalanceRow> = {}
        for (const r of (bal.data ?? []) as BalanceRow[]) map[r.quote_id] = r
        setSaldos(map)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [de, ate])

  // Totais
  const totalReceitas = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
  const despesasPagas = despesas.filter((d) => d.pago)
  const despesasNaoPagas = despesas.filter((d) => !d.pago)
  const totalDespesasPagas = despesasPagas.reduce((s, d) => s + Number(d.valor), 0)
  const totalDespesasNaoPagas = despesasNaoPagas.reduce((s, d) => s + Number(d.valor), 0)
  const resultado = totalReceitas - totalDespesasPagas

  const totalAReceber = Object.values(saldos).reduce((s, r) => s + Number(r.saldo_a_receber), 0)
  const totalCaixa = movimentos.filter((m) => m.tipo === 'caixa').reduce((s, m) => s + Number(m.valor), 0)
  const totalAplic = movimentos.filter((m) => m.tipo === 'aplicacao').reduce((s, m) => s + Number(m.valor), 0)
  const totalAportes = movimentos.filter((m) => m.tipo === 'aporte').reduce((s, m) => s + Number(m.valor), 0)
  const posicaoCaixa = totalCaixa + totalAplic + totalAportes

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 4 + i)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Financeiro</h1>
          <p className="mt-1 text-sm text-texto/60">Fluxo de caixa — receitas, despesas e balanço</p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-black/5">
        {([
          ['consolidado', 'Consolidado'],
          ['receitas', 'Receitas'],
          ['despesas', 'Despesas'],
          ['caixa', 'Caixa & Aportes'],
          ['relatorio', 'Relatório'],
        ] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-primaria text-primaria' : 'text-texto/60 hover:text-texto'}`}>
            {l}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="p-6 text-sm text-texto/50">Carregando…</p>
      ) : tab === 'consolidado' ? (
        <ConsolidadoView {...{ totalReceitas, totalDespesasPagas, totalDespesasNaoPagas, resultado, totalAReceber, totalCaixa, totalAplic, totalAportes, posicaoCaixa }} />
      ) : tab === 'receitas' ? (
        <ReceitasView clinicId={clinicId} pagamentos={pagamentos} totalReceitas={totalReceitas} totalAReceber={totalAReceber}
          quotes={quotes} saldos={saldos} onChange={recarregar} />
      ) : tab === 'despesas' ? (
        <DespesasView clinicId={clinicId} tipos={tipos} pagas={despesasPagas} naoPagas={despesasNaoPagas}
          totalPagas={totalDespesasPagas} totalNaoPagas={totalDespesasNaoPagas} de={de} onChange={recarregar} />
      ) : tab === 'relatorio' ? (
        <RelatorioView anoAtual={ano} mesAtual={mes} />
      ) : (
        <CaixaView clinicId={clinicId} movimentos={movimentos} totais={{ totalCaixa, totalAplic, totalAportes }} onChange={recarregar} />
      )}
    </div>
  )
}

function Card({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className={`text-xl font-semibold ${cor ?? 'text-texto'}`}>{brl(valor)}</div>
      <div className="text-xs text-texto/60">{label}</div>
    </div>
  )
}

function ConsolidadoView(p: {
  totalReceitas: number; totalDespesasPagas: number; totalDespesasNaoPagas: number; resultado: number
  totalAReceber: number; totalCaixa: number; totalAplic: number; totalAportes: number; posicaoCaixa: number
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-texto/70">Resultado do mês</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card label="Receitas recebidas" valor={p.totalReceitas} cor="text-emerald-600" />
          <Card label="Despesas pagas" valor={p.totalDespesasPagas} cor="text-secundaria" />
          <Card label="Resultado (recebido − pago)" valor={p.resultado} cor={p.resultado >= 0 ? 'text-emerald-600' : 'text-secundaria'} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-texto/70">Pendências</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card label="A receber (orçamentos)" valor={p.totalAReceber} cor="text-amber-600" />
          <Card label="Despesas a pagar (mês)" valor={p.totalDespesasNaoPagas} cor="text-amber-600" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-texto/70">Posição patrimonial</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="Em caixa" valor={p.totalCaixa} />
          <Card label="Aplicações" valor={p.totalAplic} />
          <Card label="Aportes" valor={p.totalAportes} />
          <Card label="Posição total" valor={p.posicaoCaixa} cor="text-primaria" />
        </div>
      </div>
    </div>
  )
}

// ---- Receitas ---------------------------------------------------------------
function ReceitasView(props: {
  clinicId: string
  pagamentos: PaymentRow[]
  totalReceitas: number
  totalAReceber: number
  quotes: Quote[]
  saldos: Record<string, BalanceRow>
  onChange: () => void
}) {
  const { clinicId, pagamentos, totalReceitas, totalAReceber, quotes, saldos, onChange } = props
  const [view, setView] = useState<'pagos' | 'receber'>('pagos')
  const [cobranca, setCobranca] = useState(false)
  const [editandoPg, setEditandoPg] = useState<PaymentRow | null>(null)

  async function excluirPagamento(p: PaymentRow) {
    if (!confirm(`Excluir o pagamento de ${brl(Number(p.valor))}?`)) return
    await deletePayment(p.id)
    onChange()
  }

  const aReceber = quotes
    .map((q) => ({ q, saldo: saldos[q.id] ? Number(saldos[q.id].saldo_a_receber) : Number(q.valor_total) }))
    .filter((x) => x.saldo > 0.005)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Card label="Recebido no mês" valor={totalReceitas} cor="text-emerald-600" />
          <Card label="A receber (total)" valor={totalAReceber} cor="text-amber-600" />
        </div>
        <button onClick={() => setCobranca(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Registrar cobrança recebida
        </button>
      </div>

      <div className="mb-3 flex gap-1 text-sm">
        <button onClick={() => setView('pagos')} className={`rounded-lg px-3 py-1.5 ${view === 'pagos' ? 'bg-primaria/10 font-semibold text-primaria' : 'text-texto/60'}`}>Realizado (Pagos)</button>
        <button onClick={() => setView('receber')} className={`rounded-lg px-3 py-1.5 ${view === 'receber' ? 'bg-primaria/10 font-semibold text-primaria' : 'text-texto/60'}`}>Não pagos (A receber)</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        {view === 'pagos' ? (
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
              <th className="px-4 py-2 font-medium">Paciente</th><th className="px-4 py-2 font-medium">Método</th>
              <th className="px-4 py-2 font-medium">Pago em</th><th className="px-4 py-2 font-medium text-right">Valor</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr></thead>
            <tbody>
              {pagamentos.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{p.patients?.nome ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/60">{p.metodo}</td>
                  <td className="px-4 py-2 text-texto/60">{p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium text-emerald-600">{brl(Number(p.valor))}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditandoPg(p)} className="text-xs text-texto/60 hover:underline">Editar</button>
                    <button onClick={() => excluirPagamento(p)} className="ml-3 text-xs text-secundaria hover:underline">Excluir</button>
                  </td>
                </tr>
              ))}
              {pagamentos.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-texto/50">Nenhum pagamento no mês.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
              <th className="px-4 py-2 font-medium">Paciente</th><th className="px-4 py-2 font-medium">Orçamento</th>
              <th className="px-4 py-2 font-medium">Total</th><th className="px-4 py-2 font-medium text-right">Saldo a receber</th>
            </tr></thead>
            <tbody>
              {aReceber.map(({ q, saldo }) => (
                <tr key={q.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{q.patients?.nome ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/60">{q.numero ?? new Date(q.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 text-texto/70">{brl(Number(q.valor_total))}</td>
                  <td className="px-4 py-2 text-right font-medium text-amber-600">{brl(saldo)}</td>
                </tr>
              ))}
              {aReceber.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-texto/50">Nada a receber.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {cobranca && <CobrancaModal clinicId={clinicId} quotes={quotes} saldos={saldos} onClose={() => setCobranca(false)} onSaved={() => { setCobranca(false); onChange() }} />}
      {editandoPg && <PagamentoEditModal pagamento={editandoPg} onClose={() => setEditandoPg(null)} onSaved={() => { setEditandoPg(null); onChange() }} />}
    </div>
  )
}

function PagamentoEditModal({ pagamento, onClose, onSaved }: { pagamento: PaymentRow; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState(String(pagamento.valor))
  const [metodo, setMetodo] = useState<PaymentMethod>((pagamento.metodo as PaymentMethod) ?? 'pix')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = Number(valor)
    if (!v || v <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true)
    try { await updatePayment(pagamento.id, { valor: v, metodo }); onSaved() }
    catch (e) { setErro((e as Error).message ?? 'Erro ao salvar.'); setSalvando(false) }
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

function CobrancaModal(props: {
  clinicId: string
  quotes: Quote[]
  saldos: Record<string, BalanceRow>
  onClose: () => void
  onSaved: () => void
}) {
  const { clinicId, quotes, saldos, onClose, onSaved } = props
  // Pacientes únicos a partir dos orçamentos
  const pacientes = useMemo(() => {
    const map = new Map<string, string>()
    for (const q of quotes) map.set(q.patient_id, q.patients?.nome ?? 'Paciente')
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [quotes])

  const [patientId, setPatientId] = useState('')
  const [quoteId, setQuoteId] = useState('')
  const [valor, setValor] = useState('')
  const [metodo, setMetodo] = useState<PaymentMethod>('pix')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const orcsDoPaciente = quotes.filter((q) => q.patient_id === patientId)
  const saldoSel = quoteId && saldos[quoteId] ? Number(saldos[quoteId].saldo_a_receber) : null

  function escolherOrc(id: string) {
    setQuoteId(id)
    const s = saldos[id] ? Number(saldos[id].saldo_a_receber) : null
    if (s != null && s > 0) setValor(String(s.toFixed(2)))
  }

  async function salvar() {
    setErro('')
    const v = Number(valor)
    if (!quoteId || !patientId) { setErro('Selecione o paciente e o orçamento.'); return }
    if (!v || v <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true)
    try {
      await registerPayment({ clinicId, quoteId, patientId, valor: v, metodo, status: 'pago' })
      onSaved()
    } catch (e) {
      setErro((e as Error).message ?? 'Erro ao registrar.')
    } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-texto">Registrar cobrança recebida</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Paciente</label>
            <select className={field} value={patientId} onChange={(e) => { setPatientId(e.target.value); setQuoteId(''); setValor('') }}>
              <option value="">Selecione…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Orçamento</label>
            <select className={field} value={quoteId} onChange={(e) => escolherOrc(e.target.value)} disabled={!patientId}>
              <option value="">Selecione…</option>
              {orcsDoPaciente.map((q) => {
                const s = saldos[q.id] ? Number(saldos[q.id].saldo_a_receber) : Number(q.valor_total)
                return <option key={q.id} value={q.id}>{(q.numero ?? new Date(q.created_at).toLocaleDateString('pt-BR'))} — {brl(Number(q.valor_total))} (saldo {brl(s)})</option>
              })}
            </select>
          </div>
          {saldoSel != null && <p className="text-xs text-texto/50">Saldo a receber: <strong>{brl(saldoSel)}</strong></p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Valor recebido</label>
              <input className={field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
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
          </div>
          {erro && <p className="text-sm text-secundaria">{erro}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/60 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

// ---- Despesas ---------------------------------------------------------------
function DespesasView(props: {
  clinicId: string
  tipos: ExpenseType[]
  pagas: Expense[]
  naoPagas: Expense[]
  totalPagas: number
  totalNaoPagas: number
  de: string
  onChange: () => void
}) {
  const { clinicId, tipos, pagas, naoPagas, totalPagas, totalNaoPagas, de, onChange } = props
  const [view, setView] = useState<'pagas' | 'naoPagas'>('pagas')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Expense | null>(null)
  const lista = view === 'pagas' ? pagas : naoPagas

  async function alternarPago(d: Expense) { await setExpensePaid(d.id, !d.pago); onChange() }
  async function remover(d: Expense) { if (confirm('Excluir esta despesa?')) { await deleteExpense(d.id); onChange() } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Card label="Pagas no mês" valor={totalPagas} cor="text-secundaria" />
          <Card label="A pagar no mês" valor={totalNaoPagas} cor="text-amber-600" />
        </div>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova despesa</button>
      </div>

      <div className="mb-3 flex gap-1 text-sm">
        <button onClick={() => setView('pagas')} className={`rounded-lg px-3 py-1.5 ${view === 'pagas' ? 'bg-primaria/10 font-semibold text-primaria' : 'text-texto/60'}`}>Realizado (Pagas)</button>
        <button onClick={() => setView('naoPagas')} className={`rounded-lg px-3 py-1.5 ${view === 'naoPagas' ? 'bg-primaria/10 font-semibold text-primaria' : 'text-texto/60'}`}>Não pagas</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
            <th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Descrição</th><th className="px-4 py-2 font-medium text-right">Valor</th>
            <th className="px-4 py-2 font-medium text-right">Ações</th>
          </tr></thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto/60">
                  {formatDateBR(d.data)}
                  {d.parcela_total ? <span className="ml-1 text-[10px] text-primaria">{d.parcela_num}/{d.parcela_total}</span>
                    : d.recorrencia_grupo ? <span className="ml-1 text-[10px] text-primaria">↻</span> : null}
                </td>
                <td className="px-4 py-2 text-texto">
                  {d.expense_types?.nome ?? '—'}
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${d.classificacao === 'produto' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                    {d.classificacao === 'produto' ? 'Produto' : 'Fixo'}
                  </span>
                </td>
                <td className="px-4 py-2 text-texto/60">
                  {d.descricao ?? '—'}
                  {Number(d.quantidade) > 1 && <span className="ml-1 text-[10px] text-texto/50">×{d.quantidade}</span>}
                  {d.forma_pagamento && <span className="ml-1 text-[10px] uppercase text-texto/40">· {d.forma_pagamento === 'cartao' ? 'Cartão' : d.forma_pagamento}</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium text-texto">{brl(Number(d.valor))}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => alternarPago(d)} className="text-xs text-primaria hover:underline">{d.pago ? 'Não pago' : 'Pago'}</button>
                  <button onClick={() => setEditando(d)} className="ml-3 text-xs text-texto/60 hover:underline">Editar</button>
                  <button onClick={() => remover(d)} className="ml-3 text-xs text-secundaria hover:underline">Excluir</button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-texto/50">Nenhuma despesa.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <DespesaModal clinicId={clinicId} tipos={tipos} dataPadrao={de} despesa={null} onClose={() => setModal(false)} onSaved={() => { setModal(false); onChange() }} />}
      {editando && <DespesaModal clinicId={clinicId} tipos={tipos} dataPadrao={de} despesa={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); onChange() }} />}
    </div>
  )
}

function DespesaModal(props: {
  clinicId: string
  tipos: ExpenseType[]
  dataPadrao: string
  despesa: Expense | null
  onClose: () => void
  onSaved: () => void
}) {
  const { clinicId, tipos, dataPadrao, despesa, onClose, onSaved } = props
  const editar = !!despesa
  const [tipoId, setTipoId] = useState(despesa?.expense_type_id ?? '')
  const [classificacao, setClassificacao] = useState<Classificacao>(despesa?.classificacao ?? 'fixo')
  const [descricao, setDescricao] = useState(despesa?.descricao ?? '')
  const [valor, setValor] = useState(despesa ? String(despesa.valor) : '')
  const [quantidade, setQuantidade] = useState(despesa ? String(despesa.quantidade) : '1')
  const [data, setData] = useState(despesa?.data ?? dataPadrao)
  const [pago, setPago] = useState(despesa?.pago ?? false)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(despesa?.forma_pagamento ?? 'pix')
  // Produto: à vista x parcelado
  const [parcelado, setParcelado] = useState(false)
  const [parcelas, setParcelas] = useState('2')
  // Gasto fixo: recorrência
  const [recorrente, setRecorrente] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>('mensal')
  const [repeticoes, setRepeticoes] = useState('12')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Tipos disponíveis conforme a classificação escolhida.
  const tiposFiltrados = tipos.filter((t) => t.tipo === classificacao)

  // Ao trocar a classificação, limpa o tipo se não pertencer à nova classificação.
  function escolherClassificacao(c: Classificacao) {
    setClassificacao(c)
    const atual = tipos.find((t) => t.id === tipoId)
    if (!atual || atual.tipo !== c) setTipoId('')
  }

  const v = Number(valor) || 0
  const nParcelas = Math.max(1, Number(parcelas) || 1)

  async function salvar() {
    setErro('')
    if (!v || v <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true)
    try {
      if (despesa) {
        await updateExpense(despesa.id, {
          expenseTypeId: tipoId || null, descricao: descricao || null, valor: v, data, pago,
          classificacao, formaPagamento, quantidade: Number(quantidade) || 1,
        })
      } else {
        await createExpense({
          clinicId,
          expenseTypeId: tipoId || null,
          descricao: descricao || null,
          valor: v,
          data,
          pago,
          classificacao,
          formaPagamento,
          quantidade: Number(quantidade) || 1,
          parcelado: classificacao === 'produto' && parcelado,
          parcelas: nParcelas,
          recorrente: classificacao === 'fixo' && recorrente,
          periodo,
          repeticoes: Number(repeticoes) || 1,
        })
      }
      onSaved()
    } catch (e) { setErro((e as Error).message ?? 'Erro ao salvar.') } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-texto">{editar ? 'Editar despesa' : 'Nova despesa'}</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Classificação</label>
            <div className="flex gap-2">
              {(['produto', 'fixo'] as Classificacao[]).map((c) => (
                <button key={c} type="button" onClick={() => escolherClassificacao(c)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${classificacao === c ? 'border-primaria bg-primaria/10 text-primaria' : 'border-black/10 text-texto/60'}`}>
                  {c === 'produto' ? 'Produto' : 'Gasto fixo'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Tipo de despesa</label>
            <select className={field} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              <option value="">Selecione…</option>
              {tiposFiltrados.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            {tiposFiltrados.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Nenhum tipo classificado como “{classificacao === 'produto' ? 'Produto' : 'Gasto fixo'}”. Cadastre/classifique em Configurações → Tipos de Despesa.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Descrição</label>
            <input className={field} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Valor{classificacao === 'produto' && parcelado ? ' total' : ''}</label>
              <input className={field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Qtd. de itens</label>
              <input className={field} inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Data</label>
              <input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Forma de pagamento</label>
            <div className="flex gap-2">
              {(['pix', 'cartao'] as FormaPagamento[]).map((fp) => (
                <button key={fp} type="button" onClick={() => setFormaPagamento(fp)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${formaPagamento === fp ? 'border-primaria bg-primaria/10 text-primaria' : 'border-black/10 text-texto/60'}`}>
                  {fp === 'pix' ? 'Pix' : 'Cartão'}
                </button>
              ))}
            </div>
          </div>

          {/* Produto: à vista x parcelado (apenas na criação) */}
          {!editar && classificacao === 'produto' && (
            <div className="rounded-lg bg-black/[0.02] p-3">
              <label className="mb-1 block text-xs font-medium text-texto/60">Pagamento</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setParcelado(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${!parcelado ? 'border-primaria bg-primaria/10 text-primaria' : 'border-black/10 text-texto/60'}`}>À vista</button>
                <button type="button" onClick={() => setParcelado(true)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${parcelado ? 'border-primaria bg-primaria/10 text-primaria' : 'border-black/10 text-texto/60'}`}>Parcelado</button>
              </div>
              {parcelado && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-texto/60">Nº de parcelas</label>
                  <input className={field} inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                  {v > 0 && <p className="mt-1 text-xs text-texto/50">{nParcelas}× de {brl(Math.round((v / nParcelas) * 100) / 100)} (mensais, a partir da data)</p>}
                </div>
              )}
            </div>
          )}

          {/* Gasto fixo: recorrência (apenas na criação) */}
          {!editar && classificacao === 'fixo' && (
            <>
              <label className="flex items-center gap-2 text-sm text-texto/70">
                <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Despesa recorrente
              </label>
              {recorrente && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-black/[0.02] p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-texto/60">Repetir</label>
                    <select className={field} value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
                      <option value="semanal">Semanalmente</option>
                      <option value="quinzenal">Quinzenalmente</option>
                      <option value="mensal">Mensalmente</option>
                      <option value="anual">Anualmente</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-texto/60">Nº de ocorrências</label>
                    <input className={field} inputMode="numeric" value={repeticoes} onChange={(e) => setRepeticoes(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-texto/70">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            {classificacao === 'produto' && parcelado ? 'Primeira parcela já paga' : 'Já está paga'}
          </label>

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

// ---- Caixa & Aportes --------------------------------------------------------
function CaixaView(props: {
  clinicId: string
  movimentos: FinancialMovement[]
  totais: { totalCaixa: number; totalAplic: number; totalAportes: number }
  onChange: () => void
}) {
  const { clinicId, movimentos, totais, onChange } = props
  const [modal, setModal] = useState(false)
  const rotulo: Record<MovTipo, string> = { caixa: 'Em caixa', aplicacao: 'Aplicação', aporte: 'Aporte' }

  async function remover(id: string) { if (confirm('Excluir este lançamento?')) { await deleteMovement(id); onChange() } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Card label="Em caixa" valor={totais.totalCaixa} />
          <Card label="Aplicações" valor={totais.totalAplic} />
          <Card label="Aportes" valor={totais.totalAportes} />
        </div>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo lançamento</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
            <th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Tipo</th>
            <th className="px-4 py-2 font-medium">Descrição</th><th className="px-4 py-2 font-medium text-right">Valor</th>
            <th className="px-4 py-2 font-medium text-right">Ações</th>
          </tr></thead>
          <tbody>
            {movimentos.map((m) => (
              <tr key={m.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto/60">{formatDateBR(m.data)}</td>
                <td className="px-4 py-2 text-texto">{rotulo[m.tipo]}</td>
                <td className="px-4 py-2 text-texto/60">{m.descricao ?? '—'}</td>
                <td className="px-4 py-2 text-right font-medium text-texto">{brl(Number(m.valor))}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remover(m.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
              </tr>
            ))}
            {movimentos.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-texto/50">Nenhum lançamento.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <MovimentoModal clinicId={clinicId} onClose={() => setModal(false)} onSaved={() => { setModal(false); onChange() }} />}
    </div>
  )
}

function MovimentoModal(props: { clinicId: string; onClose: () => void; onSaved: () => void }) {
  const { clinicId, onClose, onSaved } = props
  const hojeIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const [tipo, setTipo] = useState<MovTipo>('caixa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeIso)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    const v = Number(valor)
    if (!v || v <= 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true)
    try {
      await createMovement(clinicId, { tipo, descricao: descricao || undefined, valor: v, data })
      onSaved()
    } catch (e) { setErro((e as Error).message ?? 'Erro ao salvar.') } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-texto">Novo lançamento</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Tipo</label>
            <select className={field} value={tipo} onChange={(e) => setTipo(e.target.value as MovTipo)}>
              <option value="caixa">Valor em caixa</option>
              <option value="aplicacao">Aplicação</option>
              <option value="aporte">Aporte financeiro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-texto/60">Descrição</label>
            <input className={field} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Valor</label>
              <input className={field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-texto/60">Data</label>
              <input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} />
            </div>
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

// ---- Relatório / Estatísticas de despesas ----------------------------------
type ModoPeriodo = 'mensal' | 'anual' | 'intervalo'

function RelatorioView({ anoAtual, mesAtual }: { anoAtual: number; mesAtual: number }) {
  const clinic = useClinic()
  const [modo, setModo] = useState<ModoPeriodo>('mensal')
  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState(mesAtual)
  const [de, setDe] = useState(`${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`)
  const [ate, setAte] = useState(monthRange(anoAtual, mesAtual).ate)
  const [despesas, setDespesas] = useState<Expense[]>([])
  const [pagamentos, setPagamentos] = useState<PaymentRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [serie, setSerie] = useState<{ mes: string; receita: number; despesa: number }[]>([])

  // Intervalo efetivo conforme o modo escolhido.
  const range = useMemo(() => {
    if (modo === 'mensal') return monthRange(ano, mes)
    if (modo === 'anual') return { de: `${ano}-01-01`, ate: `${ano}-12-31` }
    return { de, ate }
  }, [modo, ano, mes, de, ate])

  useEffect(() => {
    setCarregando(true)
    Promise.all([listExpenses(range.de, range.ate), listPaymentsPeriodo(range.de, range.ate)])
      .then(([dp, pg]) => { setDespesas(dp); setPagamentos(pg) })
      .catch(() => { setDespesas([]); setPagamentos([]) })
      .finally(() => setCarregando(false))
  }, [range.de, range.ate])

  // Série anual (evolução mês a mês) — independente do modo, sempre do ano selecionado.
  useEffect(() => {
    Promise.all([listExpenses(`${ano}-01-01`, `${ano}-12-31`), listPaymentsPeriodo(`${ano}-01-01`, `${ano}-12-31`)])
      .then(([dp, pg]) => {
        const r = Array.from({ length: 12 }, () => ({ receita: 0, despesa: 0 }))
        for (const d of dp) { if (d.pago) { const m = Number(d.data.slice(5, 7)) - 1; if (m >= 0 && m < 12) r[m].despesa += Number(d.valor) } }
        for (const p of pg) { if (p.pago_em) { const m = Number(p.pago_em.slice(5, 7)) - 1; if (m >= 0 && m < 12) r[m].receita += Number(p.valor) } }
        setSerie(r.map((x, i) => ({ mes: MESES[i].slice(0, 3), receita: x.receita, despesa: x.despesa })))
      })
      .catch(() => setSerie([]))
  }, [ano])

  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i)

  // Agregações — despesas
  const total = despesas.reduce((s, d) => s + Number(d.valor), 0)
  const totalPago = despesas.filter((d) => d.pago).reduce((s, d) => s + Number(d.valor), 0)
  const totalAberto = total - totalPago
  const qtdItens = despesas.reduce((s, d) => s + (Number(d.quantidade) || 1), 0)

  // Agregações — receitas (pagamentos recebidos no período) e resultado (regime de caixa)
  const totalReceitas = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
  const resultado = totalReceitas - totalPago
  const maxRD = Math.max(totalReceitas, totalPago, 1)

  const porClassificacao = (['produto', 'fixo'] as Classificacao[]).map((c) => ({
    chave: c,
    rotulo: c === 'produto' ? 'Produtos' : 'Gastos fixos',
    valor: despesas.filter((d) => d.classificacao === c).reduce((s, d) => s + Number(d.valor), 0),
  }))

  const porForma = (['pix', 'cartao'] as FormaPagamento[]).map((fp) => ({
    chave: fp,
    rotulo: fp === 'pix' ? 'Pix' : 'Cartão',
    valor: despesas.filter((d) => d.forma_pagamento === fp).reduce((s, d) => s + Number(d.valor), 0),
  }))

  const porTipo = (() => {
    const map = new Map<string, { nome: string; valor: number; itens: number; lanc: number }>()
    for (const d of despesas) {
      const nome = d.expense_types?.nome ?? 'Sem tipo'
      const cur = map.get(nome) ?? { nome, valor: 0, itens: 0, lanc: 0 }
      cur.valor += Number(d.valor)
      cur.itens += Number(d.quantidade) || 1
      cur.lanc += 1
      map.set(nome, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor)
  })()

  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

  const periodoLabel = modo === 'mensal' ? `${MESES[mes]} de ${ano}`
    : modo === 'anual' ? `Ano de ${ano}`
    : `${formatDateBR(range.de)} a ${formatDateBR(range.ate)}`

  function exportarPdf() {
    const { blob, filename } = buildRelatorioFinanceiroPdf({
      clinic,
      periodoLabel,
      totalReceitas,
      totalDespesasPagas: totalPago,
      resultado,
      totalDespesas: total,
      totalEmAberto: totalAberto,
      lancamentos: despesas.length,
      itens: qtdItens,
      porClassificacao: porClassificacao.map((r) => ({ rotulo: r.rotulo, valor: r.valor })),
      porForma: porForma.map((r) => ({ rotulo: r.rotulo, valor: r.valor })),
      porTipo,
      serie,
      serieAno: ano,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg bg-black/[0.03] p-1 text-sm">
          {(['mensal', 'anual', 'intervalo'] as ModoPeriodo[]).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`rounded-md px-3 py-1.5 capitalize ${modo === m ? 'bg-white font-semibold text-primaria shadow-sm' : 'text-texto/60'}`}>
              {m === 'intervalo' ? 'Intervalo' : m}
            </button>
          ))}
        </div>
        {modo === 'mensal' && (
          <>
            <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </>
        )}
        {modo === 'anual' && (
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {modo === 'intervalo' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className="rounded-lg border border-black/10 px-3 py-2" value={de} onChange={(e) => setDe(e.target.value)} />
            <span className="text-texto/50">até</span>
            <input type="date" className="rounded-lg border border-black/10 px-3 py-2" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        )}
        <button onClick={exportarPdf} className="ml-auto rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5">
          Exportar PDF
        </button>
      </div>

      {/* Evolução mês a mês (ano selecionado) */}
      <Bloco titulo={`Evolução mês a mês — ${ano}`}>
        <EvolucaoChart serie={serie} />
      </Bloco>

      {carregando ? (
        <p className="p-6 text-sm text-texto/50">Carregando…</p>
      ) : despesas.length === 0 && pagamentos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum lançamento no período.</p>
      ) : (
        <>
          {/* Comparativo Receita x Despesa (regime de caixa) */}
          <Bloco titulo="Receitas × Despesas (realizado no período)">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Card label="Receitas recebidas" valor={totalReceitas} cor="text-emerald-600" />
              <Card label="Despesas pagas" valor={totalPago} cor="text-secundaria" />
              <Card label="Resultado" valor={resultado} cor={resultado >= 0 ? 'text-emerald-600' : 'text-secundaria'} />
            </div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm"><span className="text-texto/80">Receitas</span><span className="text-texto/60">{brl(totalReceitas)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((totalReceitas / maxRD) * 100)}%` }} /></div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm"><span className="text-texto/80">Despesas</span><span className="text-texto/60">{brl(totalPago)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-secundaria" style={{ width: `${Math.round((totalPago / maxRD) * 100)}%` }} /></div>
              </div>
            </div>
          </Bloco>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Total de despesas" valor={total} cor="text-texto" />
            <Card label="Pago" valor={totalPago} cor="text-emerald-600" />
            <Card label="Em aberto" valor={totalAberto} cor="text-amber-600" />
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <div className="text-xl font-semibold text-texto">{despesas.length}</div>
              <div className="text-xs text-texto/60">Lançamentos · {qtdItens} itens</div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Bloco titulo="Por classificação">
              {porClassificacao.map((r) => <Barra key={r.chave} rotulo={r.rotulo} valor={r.valor} pct={pct(r.valor)} />)}
            </Bloco>
            <Bloco titulo="Por forma de pagamento">
              {porForma.map((r) => <Barra key={r.chave} rotulo={r.rotulo} valor={r.valor} pct={pct(r.valor)} />)}
            </Bloco>
          </div>

          <Bloco titulo="Por tipo de despesa">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-texto/50"><tr>
                  <th className="py-1 font-medium">Tipo</th>
                  <th className="py-1 text-center font-medium">Lanç.</th>
                  <th className="py-1 text-center font-medium">Itens</th>
                  <th className="py-1 text-right font-medium">Valor</th>
                  <th className="py-1 text-right font-medium">%</th>
                </tr></thead>
                <tbody>
                  {porTipo.map((r) => (
                    <tr key={r.nome} className="border-t border-black/5">
                      <td className="py-1.5 text-texto">{r.nome}</td>
                      <td className="py-1.5 text-center text-texto/60">{r.lanc}</td>
                      <td className="py-1.5 text-center text-texto/60">{r.itens}</td>
                      <td className="py-1.5 text-right font-medium text-texto">{brl(r.valor)}</td>
                      <td className="py-1.5 text-right text-texto/50">{pct(r.valor)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bloco>
        </>
      )}
    </div>
  )
}

function EvolucaoChart({ serie }: { serie: { mes: string; receita: number; despesa: number }[] }) {
  if (serie.length === 0) return <p className="text-sm text-texto/50">Sem dados no ano.</p>
  const max = Math.max(1, ...serie.map((s) => Math.max(s.receita, s.despesa)))
  // Geometria
  const W = 720, H = 220, padL = 44, padB = 24, padT = 10
  const innerW = W - padL - 8
  const innerH = H - padB - padT
  const stepX = innerW / serie.length
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const linha = (sel: (s: { receita: number; despesa: number }) => number) =>
    serie.map((s, i) => `${padL + stepX * (i + 0.5)},${y(sel(s))}`).join(' ')
  const fmtK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" /> Receitas</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-secundaria" /> Despesas</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((f) => {
          const yy = padT + innerH - f * innerH
          return (
            <g key={f}>
              <line x1={padL} y1={yy} x2={W - 8} y2={yy} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtK(max * f)}</text>
            </g>
          )
        })}
        <polyline points={linha((s) => s.receita)} fill="none" stroke="#10b981" strokeWidth={2} />
        <polyline points={linha((s) => s.despesa)} fill="none" stroke="#e11d48" strokeWidth={2} />
        {serie.map((s, i) => {
          const cx = padL + stepX * (i + 0.5)
          return (
            <g key={i}>
              <circle cx={cx} cy={y(s.receita)} r={2.5} fill="#10b981" />
              <circle cx={cx} cy={y(s.despesa)} r={2.5} fill="#e11d48" />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#6b7280">{s.mes}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-texto/70">{titulo}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Barra({ rotulo, valor, pct }: { rotulo: string; valor: number; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-texto/80">{rotulo}</span>
        <span className="text-texto/60">{brl(valor)} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-primaria" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
