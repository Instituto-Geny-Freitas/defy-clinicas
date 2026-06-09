import { useEffect, useState } from 'react'
import { listProcedures, createProcedure, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listInventory, type InventoryItem } from '@/lib/inventory'
import { listQuotes, brl, type Quote } from '@/lib/finance'
import { listTreatmentPlans, type TreatmentPlan } from '@/lib/treatmentPlans'
import { listProcedureTypes, type ProcedureType } from '@/lib/domains'
import { formatDateBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
}

export default function ProceduresPanel({ patientId, clinicId, professionalId }: Props) {
  const [procs, setProcs] = useState<ProcedureRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listProcedures(patientId).then(setProcs).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Procedimentos realizados</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Registrar procedimento
        </button>
      </div>

      {modal && (
        <RegistrarModal
          clinicId={clinicId}
          patientId={patientId}
          professionalId={professionalId}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); recarregar() }}
        />
      )}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : procs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum procedimento registrado.</p>
      ) : (
        <div className="space-y-2">
          {procs.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-texto">{p.procedimento}</div>
                <div className="text-xs text-texto/50">{new Date(p.data).toLocaleDateString('pt-BR')}</div>
              </div>
              {p.regiao && <div className="text-sm text-texto/60">Região: {p.regiao}</div>}
              {p.observacoes && <div className="mt-1 text-sm text-texto/70">{p.observacoes}</div>}
              {p.produtos_usados?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.produtos_usados.map((u, i) => (
                    <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">
                      {u.produto} ×{u.qtd}
                    </span>
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
  clinicId,
  patientId,
  professionalId,
  onClose,
  onSaved,
}: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [estoque, setEstoque] = useState<InventoryItem[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [tipos, setTipos] = useState<ProcedureType[]>([])
  const [planoId, setPlanoId] = useState('')
  const [quoteId, setQuoteId] = useState('')
  const [procSelect, setProcSelect] = useState('') // valor do select de tipo
  const [procedimento, setProcedimento] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [regiao, setRegiao] = useState('')
  const [obs, setObs] = useState('')
  const [produtos, setProdutos] = useState<UsedProduct[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listInventory().then(setEstoque).catch(() => {})
    listProcedureTypes().then(setTipos).catch(() => {})
    listTreatmentPlans(patientId).then((ps) => { setPlanos(ps); if (ps.length) setPlanoId(ps[0].id) }).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
  }, [patientId])

  // Orçamentos do plano selecionado (ou todos, se nenhum plano escolhido).
  const orcamentosDoPlano = planoId ? orcamentos.filter((q) => q.treatment_plan_id === planoId) : orcamentos
  // Mantém o orçamento selecionado coerente com o plano.
  useEffect(() => {
    if (quoteId && !orcamentosDoPlano.some((q) => q.id === quoteId)) setQuoteId('')
    if (!quoteId && orcamentosDoPlano.length === 1) setQuoteId(orcamentosDoPlano[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoId, orcamentos])

  const planoSel = planos.find((p) => p.id === planoId)
  const orcSel = orcamentos.find((q) => q.id === quoteId)

  function addProduto() {
    setProdutos((p) => [...p, { inventory_id: '', produto: '', qtd: 1 }])
  }
  function setProduto(idx: number, item: InventoryItem | null, qtd: number) {
    setProdutos((arr) =>
      arr.map((p, i) =>
        i === idx
          ? { inventory_id: item?.id ?? '', produto: item?.produto ?? '', lote: item?.lote ?? null, qtd, preco_venda: item?.preco_venda }
          : p,
      ),
    )
  }
  function removeProduto(idx: number) {
    setProdutos((arr) => arr.filter((_, i) => i !== idx))
  }

  async function salvar() {
    setErro(null)
    if (!procedimento.trim()) { setErro('Informe o procedimento.'); return }
    if (orcamentos.length > 0 && !quoteId) { setErro('Selecione o orçamento (de um plano) ao qual este procedimento pertence.'); return }
    setSalvando(true)
    try {
      await createProcedure({
        clinicId,
        patientId,
        professionalId,
        quoteId: quoteId || null,
        procedimento,
        data: new Date(data).toISOString(),
        regiao,
        observacoes: obs,
        produtos: produtos.filter((p) => p.inventory_id),
      })
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Registrar procedimento</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Procedimento *</label>
            <select
              className={field}
              value={procSelect}
              onChange={(e) => {
                setProcSelect(e.target.value)
                setProcedimento(e.target.value === '__outro__' ? '' : e.target.value)
              }}
            >
              <option value="">Selecione…</option>
              {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              <option value="__outro__">Outro (digitar)…</option>
            </select>
            {procSelect === '__outro__' && (
              <input className={`${field} mt-2`} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Descreva o procedimento" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Região</label><input className={field} value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
          </div>

          {/* Vínculo: Plano -> Orçamento */}
          <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-texto/70">Plano de tratamento</label>
                <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                  <option value="">— Todos —</option>
                  {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-texto/70">Orçamento *</label>
                <select className={field} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {orcamentosDoPlano.map((q) => (
                    <option key={q.id} value={q.id}>
                      {new Date(q.created_at).toLocaleDateString('pt-BR')} · {brl(q.valor_total)}{q.itens?.[0] ? ` · ${q.itens[0].descricao}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-texto/70">
              {orcSel
                ? <>Registrando em: <strong>{planoSel?.titulo || (orcSel.treatment_plan_id ? 'Plano vinculado' : 'Sem plano')}</strong> › Orçamento de {new Date(orcSel.created_at).toLocaleDateString('pt-BR')} ({brl(orcSel.valor_total)})</>
                : orcamentos.length === 0
                  ? 'Nenhum orçamento. Crie um Plano e um Orçamento (aba Financeiro) para vincular.'
                  : 'Selecione o orçamento ao qual este procedimento pertence.'}
            </p>
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
                  <select
                    className={field}
                    value={p.inventory_id}
                    onChange={(e) => setProduto(idx, estoque.find((i) => i.id === e.target.value) ?? null, p.qtd)}
                  >
                    <option value="">Selecione o produto…</option>
                    {estoque.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.produto} (estoque: {i.qtd_atual})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm outline-none focus:border-primaria"
                    value={p.qtd}
                    onChange={(e) => setProduto(idx, estoque.find((i) => i.id === p.inventory_id) ?? null, Number(e.target.value))}
                  />
                  <button onClick={() => removeProduto(idx)} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
                </div>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
