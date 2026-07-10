import { useEffect, useState } from 'react'
import { localDateToday } from '@/lib/format'
import { createProcedure, deleteProcedure, listProcedures, updateProcedure, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listInventory, listInventoryLots, type InventoryItem, type InventoryLot } from '@/lib/inventory'
import { listQuotes, brl, syncProcedureProductsToQuote, type Quote } from '@/lib/finance'
import { supabase } from '@/lib/supabase'
import { listTreatmentPlans, type TreatmentPlan } from '@/lib/treatmentPlans'
import { listProcedureTypes, type ProcedureType } from '@/lib/domains'
import { formatDateBR, parseMoneyBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
}

export default function ProceduresPanel({ patientId, clinicId, professionalId }: Props) {
  const [procs, setProcs] = useState<ProcedureRecord[]>([])
  const [pagas, setPagas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ProcedureRecord | null>(null)

  function recarregar() {
    listProcedures(patientId).then(setProcs).catch(() => {}).finally(() => setCarregando(false))
    // Orçamentos quitados do paciente → marca os procedimentos vinculados como pagos.
    supabase.from('v_quote_balances').select('quote_id, saldo_a_receber').eq('patient_id', patientId)
      .then(({ data }) => setPagas(new Set((data ?? []).filter((b) => Number(b.saldo_a_receber) <= 0.005).map((b) => b.quote_id as string))))
  }
  useEffect(recarregar, [patientId])

  async function excluir(p: ProcedureRecord) {
    if (!confirm(`Excluir o procedimento "${p.procedimento}"? Os produtos utilizados retornam ao estoque.`)) return
    await deleteProcedure(clinicId, p)
    recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Procedimentos realizados</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Registrar procedimento
        </button>
      </div>

      {modal && (
        <RegistrarModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} proc={null}
          onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {editando && (
        <RegistrarModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} proc={editando}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />
      )}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : procs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum procedimento registrado.</p>
      ) : (
        <div className="space-y-2">
          {procs.map((p) => {
            const pago = !!p.quote_id && pagas.has(p.quote_id)
            return (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-texto">{p.procedimento}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
                  <button onClick={() => setEditando(p)} className="text-xs font-medium text-primaria hover:underline">Editar</button>
                  <button onClick={() => excluir(p)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
                </div>
              </div>
              {p.regiao && <div className="text-sm text-texto/60">Região: {p.regiao}</div>}
              {p.observacoes && <div className="mt-1 text-sm text-texto/70">{p.observacoes}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {!p.quote_id && Number(p.valor_cobrado) > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Avulso · {brl(Number(p.valor_cobrado))}</span>
                )}
                {p.quote_id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Vinculado a orçamento</span>}
                {pago && <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-medium text-white">✓ Pago</span>}
              </div>
              {p.produtos_usados?.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-xs font-medium text-texto/60">Produtos utilizados (baixa de estoque){pago && <span className="ml-1 text-emerald-600">· pagos</span>}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.produtos_usados.map((u, i) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${pago ? 'bg-emerald-50 text-emerald-700' : 'bg-black/5 text-texto/70'}`}>
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
          )})}
        </div>
      )}
    </div>
  )
}

function RegistrarModal({
  clinicId, patientId, professionalId, proc, onClose, onSaved,
}: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  proc: ProcedureRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const editar = !!proc
  const [estoque, setEstoque] = useState<InventoryItem[]>([])
  const [lotes, setLotes] = useState<InventoryLot[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [tipos, setTipos] = useState<ProcedureType[]>([])
  const [planoId, setPlanoId] = useState('')
  const [quoteId, setQuoteId] = useState(proc?.quote_id ?? '')
  const [procSelect, setProcSelect] = useState('')
  const [procedimento, setProcedimento] = useState(proc?.procedimento ?? '')
  const [data, setData] = useState(proc?.data ? proc.data.slice(0, 10) : localDateToday())
  const [regiao, setRegiao] = useState(proc?.regiao ?? '')
  const [obs, setObs] = useState(proc?.observacoes ?? '')
  const [valorCobrado, setValorCobrado] = useState(proc && Number(proc.valor_cobrado) > 0 ? String(Number(proc.valor_cobrado).toFixed(2)).replace('.', ',') : '')
  const [produtos, setProdutos] = useState<UsedProduct[]>(proc?.produtos_usados ?? [])
  const [filtroLote, setFiltroLote] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listInventory().then(setEstoque).catch(() => {})
    listInventoryLots().then(setLotes).catch(() => {})
    listProcedureTypes().then(setTipos).catch(() => {})
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
  }, [patientId])

  const orcamentosDoPlano = planoId ? orcamentos.filter((q) => q.treatment_plan_id === planoId) : orcamentos
  const avulso = !quoteId

  const nomeProduto = (invId: string) => estoque.find((i) => i.id === invId)?.produto ?? ''
  const lotesComSaldo = lotes.filter((l) => Number(l.qtd_atual) > 0)
  const rotuloLote = (l: InventoryLot) =>
    `${nomeProduto(l.inventory_id)} · ${l.lote || 's/ lote'}${l.validade ? ` · val ${formatDateBR(l.validade)}` : ''} · ${l.qtd_atual} un${Number(l.preco_venda) > 0 ? ` · ${brl(Number(l.preco_venda))}` : ''}`
  // Filtro textual por nome do produto, lote ou validade (facilita achar em listas grandes).
  const matchFiltro = (l: InventoryLot) => {
    const t = filtroLote.trim().toLowerCase()
    if (!t) return true
    return `${nomeProduto(l.inventory_id)} ${l.lote ?? ''} ${l.validade ? formatDateBR(l.validade) : ''}`.toLowerCase().includes(t)
  }
  const saldoLote = (lotId?: string | null) => (lotId ? Number(lotes.find((l) => l.id === lotId)?.qtd_atual ?? 0) : 0)
  const totalProdutos = produtos.reduce((s, p) => s + Number(p.preco_venda || 0) * p.qtd, 0)

  function addProduto() { setProdutos((p) => [...p, { inventory_id: '', produto: '', qtd: 1 }]) }
  function setProdutoLote(idx: number, lot: InventoryLot | null, qtd: number) {
    setProdutos((arr) => arr.map((p, i) => i === idx
      ? (lot
        ? { inventory_id: lot.inventory_id, produto: nomeProduto(lot.inventory_id), lot_id: lot.id, marca: lot.marca, lote: lot.lote, validade: lot.validade, qtd, preco_venda: lot.preco_venda }
        : { inventory_id: '', produto: '', qtd })
      : p))
  }
  function removeProduto(idx: number) { setProdutos((arr) => arr.filter((_, i) => i !== idx)) }

  async function salvar() {
    setErro(null)
    if (!procedimento.trim()) { setErro('Informe o procedimento.'); return }
    const prods = produtos.filter((p) => p.inventory_id)
    // Bloqueia registrar baixa acima do saldo do lote (procedimento novo).
    if (!editar) {
      const semSaldo = prods.find((p) => p.lot_id && p.qtd > saldoLote(p.lot_id))
      if (semSaldo) { setErro(`"${semSaldo.produto}" tem quantidade (${semSaldo.qtd}) acima do saldo do lote (${saldoLote(semSaldo.lot_id)}).`); return }
    }
    setSalvando(true)
    try {
      const valor = avulso ? parseMoneyBR(valorCobrado) : 0
      if (proc) {
        await updateProcedure({
          clinicId, anterior: proc, procedimento, data,
          regiao, observacoes: obs, valorCobrado: valor, produtos: prods,
        })
        // Sincroniza os produtos com o orçamento vinculado (e limpa o anterior, se mudou).
        const anteriorQuote = proc.quote_id
        if (anteriorQuote && anteriorQuote !== (quoteId || null)) await syncProcedureProductsToQuote(anteriorQuote, proc.id, []).catch(() => {})
        if (quoteId) await syncProcedureProductsToQuote(quoteId, proc.id, prods).catch(() => {})
      } else {
        const criado = await createProcedure({
          clinicId, patientId, professionalId, quoteId: quoteId || null, procedimento,
          data, regiao, observacoes: obs,
          valorCobrado: valor, produtos: prods,
        })
        if (quoteId) await syncProcedureProductsToQuote(quoteId, criado.id, prods).catch(() => {})
      }
      onSaved()
    } catch { setSalvando(false) }
  }

  const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar procedimento' : 'Registrar procedimento'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Procedimento *</label>
            <select className={field} value={procSelect}
              onChange={(e) => { setProcSelect(e.target.value); if (e.target.value && e.target.value !== '__outro__') setProcedimento(e.target.value) }}>
              <option value="">{editar ? procedimento || 'Selecione…' : 'Selecione…'}</option>
              {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              <option value="__outro__">Outro (digitar)…</option>
            </select>
            {(procSelect === '__outro__' || editar) && (
              <input className={`${field} mt-2`} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Descreva o procedimento" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Região</label><input className={field} value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
          </div>

          {/* Vínculo: Plano -> Orçamento (opcional). Sem orçamento = avulso com valor a cobrar. */}
          <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-texto/70">Plano de tratamento</label>
                <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                  <option value="">— Sem plano —</option>
                  {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-texto/70">Orçamento</label>
                <select className={field} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                  <option value="">— Sem orçamento (avulso) —</option>
                  {orcamentosDoPlano.map((q) => (
                    <option key={q.id} value={q.id}>{new Date(q.created_at).toLocaleDateString('pt-BR')} · {brl(q.valor_total)}</option>
                  ))}
                </select>
              </div>
            </div>
            {avulso && (
              <div className="mt-2">
                <label className="mb-1 block text-sm text-texto/70">Valor a cobrar (procedimento avulso)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-texto/50">R$</span>
                  <input className={field} inputMode="decimal" value={valorCobrado} onChange={(e) => setValorCobrado(e.target.value)} placeholder="0,00" />
                </div>
                <p className="mt-1 text-xs text-texto/60">Sem orçamento: informe o valor (use vírgula para centavos). Ele poderá ser importado depois em “Novo orçamento”. {parseMoneyBR(valorCobrado) > 0 && <strong>{brl(parseMoneyBR(valorCobrado))}</strong>}</p>
                {totalProdutos > 0 && (
                  <p className="mt-1 text-xs text-texto/60">
                    Total dos produtos utilizados: <strong>{brl(totalProdutos)}</strong>
                    <button type="button" onClick={() => setValorCobrado(String(totalProdutos.toFixed(2)).replace('.', ','))} className="ml-2 font-medium text-primaria hover:underline">usar como valor a cobrar</button>
                  </p>
                )}
              </div>
            )}
          </div>

          <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-texto/70">Produtos utilizados (baixa de estoque)</label>
              <button onClick={addProduto} className="text-xs font-medium text-primaria hover:underline">+ Adicionar</button>
            </div>
            {produtos.length === 0 && <p className="text-xs text-texto/40">Nenhum produto. (Opcional)</p>}
            {produtos.length > 0 && lotesComSaldo.length > 0 && (
              <input className={`${field} mb-2`} placeholder="🔍 Filtrar por produto, lote ou validade…" value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)} />
            )}
            {lotesComSaldo.length === 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Nenhum lote com saldo em estoque. Registre uma entrada (Financeiro → Nova Despesa, Estoque → +Entrada ou Editar Produto — admin) antes de usar produtos.</p>
            )}
            <div className="space-y-2">
              {produtos.map((p, idx) => {
                // Lotes disponíveis: com saldo > 0 (e o já escolhido), aplicando o filtro textual.
                const opcoes = lotesComSaldo.filter((l) => l.id === p.lot_id || (Number(l.qtd_atual) > 0 && matchFiltro(l)))
                const semSaldo = !!p.lot_id && !editar && p.qtd > saldoLote(p.lot_id)
                return (
                  <div key={idx}>
                    <div className="flex gap-2">
                      <select className={field} value={p.lot_id ?? ''}
                        onChange={(e) => setProdutoLote(idx, lotes.find((l) => l.id === e.target.value) ?? null, p.qtd)}>
                        <option value="">{p.lot_id ? '' : (p.produto ? `${p.produto} (lote antigo)` : 'Selecione o lote…')}</option>
                        {opcoes.map((l) => <option key={l.id} value={l.id}>{rotuloLote(l)}</option>)}
                      </select>
                      <input type="number" min={1} className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm outline-none focus:border-primaria"
                        value={p.qtd} onChange={(e) => setProdutos((arr) => arr.map((x, i) => i === idx ? { ...x, qtd: Number(e.target.value) } : x))} />
                      <button onClick={() => removeProduto(idx)} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                      {(p.lote || p.validade) && <span className="text-texto/50">Lote {p.lote || 's/ nº'}{p.validade ? ` · val ${formatDateBR(p.validade)}` : ''}</span>}
                      {Number(p.preco_venda) > 0 && <span className="text-texto/50">Venda: {brl(Number(p.preco_venda))} × {p.qtd} = <strong className="text-texto/70">{brl(Number(p.preco_venda) * p.qtd)}</strong></span>}
                      {semSaldo && <span className="font-medium text-secundaria">Quantidade acima do saldo do lote ({saldoLote(p.lot_id)}).</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {produtos.some((p) => Number(p.preco_venda) > 0) && (
              <p className="mt-1 text-right text-xs text-texto/60">Total dos produtos (venda): <strong>{brl(produtos.reduce((s, p) => s + Number(p.preco_venda || 0) * p.qtd, 0))}</strong></p>
            )}
            {editar && produtos.length > 0 && <p className="mt-1 text-xs text-texto/40">Ao salvar, o estoque é reconciliado (devolve os antigos e baixa os novos).</p>}
          </div>

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : editar ? 'Salvar' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
