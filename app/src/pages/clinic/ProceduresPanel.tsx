import { useEffect, useState } from 'react'
import { localDateToday } from '@/lib/format'
import { createProcedure, deleteProcedure, listProcedures, updateProcedure, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listInventory, type InventoryItem } from '@/lib/inventory'
import { listQuotes, brl, type Quote } from '@/lib/finance'
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
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ProcedureRecord | null>(null)

  function recarregar() {
    listProcedures(patientId).then(setProcs).catch(() => {}).finally(() => setCarregando(false))
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
          {procs.map((p) => (
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
              </div>
              {p.produtos_usados?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.produtos_usados.map((u, i) => (
                    <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">{u.produto} ×{u.qtd}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
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
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listInventory().then(setEstoque).catch(() => {})
    listProcedureTypes().then(setTipos).catch(() => {})
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
  }, [patientId])

  const orcamentosDoPlano = planoId ? orcamentos.filter((q) => q.treatment_plan_id === planoId) : orcamentos
  const avulso = !quoteId

  function addProduto() { setProdutos((p) => [...p, { inventory_id: '', produto: '', qtd: 1 }]) }
  function setProduto(idx: number, item: InventoryItem | null, qtd: number) {
    setProdutos((arr) => arr.map((p, i) => i === idx
      ? { inventory_id: item?.id ?? '', produto: item?.produto ?? '', lote: item?.lote ?? null, qtd, preco_venda: item?.preco_venda }
      : p))
  }
  function removeProduto(idx: number) { setProdutos((arr) => arr.filter((_, i) => i !== idx)) }

  async function salvar() {
    setErro(null)
    if (!procedimento.trim()) { setErro('Informe o procedimento.'); return }
    setSalvando(true)
    try {
      const prods = produtos.filter((p) => p.inventory_id)
      const valor = avulso ? parseMoneyBR(valorCobrado) : 0
      if (proc) {
        await updateProcedure({
          clinicId, anterior: proc, procedimento, data,
          regiao, observacoes: obs, valorCobrado: valor, produtos: prods,
        })
      } else {
        await createProcedure({
          clinicId, patientId, professionalId, quoteId: quoteId || null, procedimento,
          data, regiao, observacoes: obs,
          valorCobrado: valor, produtos: prods,
        })
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
            <div className="space-y-2">
              {produtos.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <select className={field} value={p.inventory_id}
                    onChange={(e) => setProduto(idx, estoque.find((i) => i.id === e.target.value) ?? null, p.qtd)}>
                    <option value="">{p.produto || 'Selecione o produto…'}</option>
                    {estoque.map((i) => <option key={i.id} value={i.id}>{i.produto} (estoque: {i.qtd_atual})</option>)}
                  </select>
                  <input type="number" min={1} className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm outline-none focus:border-primaria"
                    value={p.qtd} onChange={(e) => setProduto(idx, estoque.find((i) => i.id === p.inventory_id) ?? null, Number(e.target.value))} />
                  <button onClick={() => removeProduto(idx)} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
                </div>
              ))}
            </div>
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
