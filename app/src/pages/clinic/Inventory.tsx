import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { formatDateBR } from '@/lib/format'
import {
  addStockEntryLot,
  createInventoryItem,
  deleteInventoryItem,
  estoqueBaixo,
  listInventory,
  listInventoryLots,
  setInventoryQty,
  updateInventoryItem,
  validadeProxima,
  type InventoryInput,
  type InventoryItem,
  type InventoryLot,
} from '@/lib/inventory'
import Calculadora from '@/components/Calculadora'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const OPCOES_QTD = [20, 50, 100]

/** Normaliza (sem acento, maiúsculo) para comparar a inicial do produto. */
function inicial(nome: string): string {
  const c = nome.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

export default function Inventory() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const isAdmin = profile?.professional?.role === 'admin'
  const [itens, setItens] = useState<InventoryItem[]>([])
  const [lotes, setLotes] = useState<InventoryLot[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<InventoryItem | null>(null)
  const [entrando, setEntrando] = useState<InventoryItem | null>(null)
  const [busca, setBusca] = useState('')
  const [letra, setLetra] = useState<string | null>(null)
  const [porPagina, setPorPagina] = useState(20)
  const [qtdCustom, setQtdCustom] = useState('')
  const [pagina, setPagina] = useState(0)

  function recarregar() {
    listInventory().then(setItens).catch(() => {}).finally(() => setCarregando(false))
    listInventoryLots().then(setLotes).catch(() => {})
  }
  useEffect(recarregar, [])

  const lotesPorProduto = useMemo(() => {
    const m = new Map<string, InventoryLot[]>()
    for (const l of lotes) { const arr = m.get(l.inventory_id) ?? []; arr.push(l); m.set(l.inventory_id, arr) }
    return m
  }, [lotes])

  const iniciaisExistentes = useMemo(() => {
    const s = new Set<string>()
    itens.forEach((i) => s.add(inicial(i.produto)))
    return s
  }, [itens])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => {
      if (termo && !i.produto.toLowerCase().includes(termo) && !(i.marca ?? '').toLowerCase().includes(termo)) return false
      if (letra && inicial(i.produto) !== letra) return false
      return true
    })
  }, [itens, busca, letra])

  useEffect(() => { setPagina(0) }, [busca, letra, porPagina])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const inicio = paginaSegura * porPagina
  const visiveis = filtrados.slice(inicio, inicio + porPagina)

  function aplicarCustom() {
    const n = Number(qtdCustom)
    if (n > 0) setPorPagina(Math.floor(n))
  }

  async function excluir(item: InventoryItem) {
    if (!confirm(`Remover "${item.produto}" do estoque?`)) return
    await deleteInventoryItem(item.id)
    recarregar()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-texto">Estoque</h1>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo produto
        </button>
      </div>

      {modal && clinicId && (
        <ProdutoModal clinicId={clinicId} item={null} isAdmin={isAdmin} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {editando && clinicId && (
        <ProdutoModal clinicId={clinicId} item={editando} isAdmin={isAdmin} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />
      )}
      {entrando && clinicId && (
        <EntradaModal clinicId={clinicId} item={entrando} onClose={() => setEntrando(null)} onSaved={() => { setEntrando(null); recarregar() }} />
      )}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por produto ou marca…"
        className="mt-4 w-full max-w-sm rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
      />

      {/* Filtro por letra inicial */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <button
          onClick={() => setLetra(null)}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition ${letra === null ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
        >
          Todos
        </button>
        {ALFABETO.map((l) => {
          const existe = iniciaisExistentes.has(l)
          const ativo = letra === l
          return (
            <button
              key={l}
              disabled={!existe}
              onClick={() => setLetra(ativo ? null : l)}
              className={`h-7 w-7 rounded-md text-xs font-semibold transition ${
                ativo
                  ? 'bg-primaria text-white'
                  : existe
                    ? 'bg-black/5 text-texto/70 hover:bg-black/10'
                    : 'cursor-default text-texto/20'
              }`}
            >
              {l}
            </button>
          )
        })}
        {iniciaisExistentes.has('#') && (
          <button
            onClick={() => setLetra(letra === '#' ? null : '#')}
            className={`h-7 w-7 rounded-md text-xs font-semibold transition ${letra === '#' ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
            title="Outros (número/símbolo)"
          >
            #
          </button>
        )}
      </div>

      {/* Controle de quantidade por página */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-texto/70">
        <span>Mostrar</span>
        {OPCOES_QTD.map((n) => (
          <button
            key={n}
            onClick={() => { setPorPagina(n); setQtdCustom('') }}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${porPagina === n && qtdCustom === '' ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={qtdCustom}
          onChange={(e) => setQtdCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') aplicarCustom() }}
          onBlur={aplicarCustom}
          placeholder="outro"
          className="w-20 rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-primaria"
        />
        <span className="text-xs text-texto/50">registros por página</span>
      </div>

      {/* Card com scroll horizontal CONFINADO (não arrasta a página inteira) */}
      <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum produto encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-black/[0.02] text-left text-texto/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Produto</th>
                  <th className="px-4 py-2 font-medium">Lote</th>
                  <th className="px-4 py-2 font-medium">Validade</th>
                  <th className="px-4 py-2 font-medium">Qtd</th>
                  <th className="px-4 py-2 font-medium">Venda</th>
                  <th className="px-4 py-2 font-medium">Margem</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr key={i.id} className="border-t border-black/5">
                    <td className="px-4 py-2 text-texto">
                      {i.produto}
                      {i.marca && <span className="text-texto/40"> · {i.marca}</span>}
                      {(() => {
                        const ls = lotesPorProduto.get(i.id) ?? []
                        if (ls.length === 0) return null
                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ls.map((l) => {
                              const venc = l.validade ? (new Date(l.validade).getTime() - Date.now()) / 86400000 <= 30 : false
                              return (
                                <span key={l.id} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-texto/60">
                                  {l.lote || 's/ lote'}{l.validade && <span className={venc ? 'text-secundaria' : ''}> · {formatDateBR(l.validade)}</span>} · {l.qtd_atual} un
                                </span>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-2 text-texto/60">{i.lote ?? '—'}</td>
                    <td className="px-4 py-2">
                      {i.validade ? (
                        <span className={validadeProxima(i) ? 'font-medium text-secundaria' : 'text-texto/60'}>
                          {formatDateBR(i.validade)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={estoqueBaixo(i) ? 'font-semibold text-secundaria' : 'text-texto'}>
                        {i.qtd_atual}
                      </span>
                      {estoqueBaixo(i) && <span className="ml-1 text-xs text-secundaria">(baixo)</span>}
                    </td>
                    <td className="px-4 py-2 text-texto/70">{brl(i.preco_venda)}</td>
                    <td className="px-4 py-2 text-texto/70">{brl(i.margem_unit)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEntrando(i)} className="text-xs font-medium text-primaria hover:underline">
                        + Entrada
                      </button>
                      <button onClick={() => setEditando(i)} className="ml-3 text-xs font-medium text-texto/60 hover:underline">
                        Editar
                      </button>
                      <button onClick={() => excluir(i)} className="ml-3 text-xs font-medium text-secundaria hover:underline">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rodapé: contagem + paginação */}
      {!carregando && filtrados.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-texto/60">
          <span>
            {inicio + 1}–{Math.min(inicio + porPagina, filtrados.length)} de {filtrados.length}
            {(busca || letra) && ` (${itens.length} no total)`}
          </span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={paginaSegura === 0}
                className="rounded-md bg-black/5 px-3 py-1 text-xs font-semibold text-texto/70 hover:bg-black/10 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs">Página {paginaSegura + 1} de {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaSegura >= totalPaginas - 1}
                className="rounded-md bg-black/5 px-3 py-1 text-xs font-semibold text-texto/70 hover:bg-black/10 disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProdutoModal({ clinicId, item, isAdmin, onClose, onSaved }: { clinicId: string; item: InventoryItem | null; isAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  const editar = !!item
  const [f, setF] = useState<InventoryInput>(
    item
      ? {
          produto: item.produto, marca: item.marca, lote: item.lote, validade: item.validade,
          custo_unit: item.custo_unit, preco_venda: item.preco_venda, qtd_atual: item.qtd_atual,
          qtd_minima: item.qtd_minima, unidade: item.unidade, categoria: item.categoria,
        }
      : { produto: '', custo_unit: 0, preco_venda: 0, qtd_atual: 0, qtd_minima: 0 },
  )
  const [salvando, setSalvando] = useState(false)
  const set = <K extends keyof InventoryInput>(k: K, v: InventoryInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.produto.trim()) return
    setSalvando(true)
    try {
      if (item) {
        await updateInventoryItem(item.id, f)
        if (isAdmin && f.qtd_atual !== item.qtd_atual) await setInventoryQty(item.id, f.qtd_atual ?? 0)
      } else {
        await createInventoryItem(clinicId, f)
      }
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar produto' : 'Novo produto'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Produto *</label>
            <input className={field} value={f.produto} onChange={(e) => set('produto', e.target.value)} />
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Marca</label><input className={field} value={f.marca ?? ''} onChange={(e) => set('marca', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Lote</label><input className={field} value={f.lote ?? ''} onChange={(e) => set('lote', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Validade</label><input type="date" className={field} value={f.validade ?? ''} onChange={(e) => set('validade', e.target.value)} /></div>
          {editar ? (
            <div>
              <label className="mb-1 block text-sm text-texto/70">
                Qtd atual
                {isAdmin && <span className="ml-1 text-xs font-normal text-primaria">(editável — admin)</span>}
              </label>
              {isAdmin ? (
                <input type="number" className={field} value={f.qtd_atual ?? 0} onChange={(e) => set('qtd_atual', Number(e.target.value))} />
              ) : (
                <input className={`${field} bg-black/[0.03]`} value={f.qtd_atual ?? 0} disabled readOnly />
              )}
              {!isAdmin && <p className="mt-1 text-xs text-texto/40">Ajuste via "+ Entrada" (movimentações)</p>}
            </div>
          ) : (
            <div><label className="mb-1 block text-sm text-texto/70">Qtd inicial</label><input type="number" className={field} value={f.qtd_atual ?? 0} onChange={(e) => set('qtd_atual', Number(e.target.value))} /></div>
          )}
          <div><label className="mb-1 block text-sm text-texto/70">Estoque mínimo</label><input type="number" className={field} value={f.qtd_minima ?? 0} onChange={(e) => set('qtd_minima', Number(e.target.value))} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Unidade</label><input className={field} placeholder="un, ml, cx…" value={f.unidade ?? ''} onChange={(e) => set('unidade', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Custo unit. (R$)</label><input type="number" step="0.01" className={field} value={f.custo_unit ?? 0} onChange={(e) => set('custo_unit', Number(e.target.value))} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Preço venda (R$)</label><input type="number" step="0.01" className={field} value={f.preco_venda ?? 0} onChange={(e) => set('preco_venda', Number(e.target.value))} /></div>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button type="submit" disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : editar ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Entrada de estoque por LOTE: soma no mesmo lote (marca+lote+validade) ou cria um novo. */
function EntradaModal({ clinicId, item, onClose, onSaved }: { clinicId: string; item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [lotes, setLotes] = useState<InventoryLot[]>([])
  const [lotSel, setLotSel] = useState('')
  const [marca, setMarca] = useState(item.marca ?? '')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [qtd, setQtd] = useState('1')
  const [custo, setCusto] = useState('')
  const [preco, setPreco] = useState('')
  const [calc, setCalc] = useState<null | 'custo' | 'preco'>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { listInventoryLots().then((all) => setLotes(all.filter((l) => l.inventory_id === item.id))).catch(() => {}) }, [])

  function escolherLote(id: string) {
    setLotSel(id)
    const l = lotes.find((x) => x.id === id)
    if (l) {
      setMarca(l.marca ?? ''); setLote(l.lote ?? ''); setValidade(l.validade ?? '')
      setCusto(l.custo_unit ? String(l.custo_unit).replace('.', ',') : '')
      setPreco(l.preco_venda ? String(l.preco_venda).replace('.', ',') : '')
    } else { setLote(''); setValidade('') }
  }

  async function salvar() {
    const q = Number(qtd.replace(',', '.'))
    if (!(q > 0)) return
    setSalvando(true)
    try {
      await addStockEntryLot({
        clinicId, inventoryId: item.id,
        marca: marca || null, lote: lote || null, validade: validade || null,
        quantidade: q,
        custoUnit: custo ? Number(custo.replace(',', '.')) : undefined,
        precoVenda: preco ? Number(preco.replace(',', '.')) : undefined,
      })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Entrada de estoque</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <p className="mb-4 text-sm text-texto/60">{item.produto}{item.marca ? ` · ${item.marca}` : ''}</p>
        <div className="space-y-3">
          {lotes.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-texto/70">Lote</label>
              <select className={field} value={lotSel} onChange={(e) => escolherLote(e.target.value)}>
                <option value="">➕ Novo lote…</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>{l.lote || 's/ lote'}{l.validade ? ` · val ${formatDateBR(l.validade)}` : ''} · {l.qtd_atual} un</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-texto/50">Mesmo lote+validade soma na quantidade; diferente cria um novo lote.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Marca</label><input className={field} value={marca} onChange={(e) => setMarca(e.target.value)} disabled={!!lotSel} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Lote</label><input className={field} value={lote} onChange={(e) => setLote(e.target.value)} disabled={!!lotSel} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Validade</label><input type="date" className={field} value={validade} onChange={(e) => setValidade(e.target.value)} disabled={!!lotSel} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Quantidade *</label><input inputMode="decimal" className={field} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Custo unit. (R$)</label>
              <div className="flex gap-1">
                <input inputMode="decimal" className={field} value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
                <button type="button" onClick={() => setCalc('custo')} title="Calcular por unidade" className="shrink-0 rounded-lg border border-black/10 px-2 hover:bg-black/5">🧮</button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Preço venda (R$)</label>
              <div className="flex gap-1">
                <input inputMode="decimal" className={field} value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
                <button type="button" onClick={() => setCalc('preco')} title="Calcular por unidade" className="shrink-0 rounded-lg border border-black/10 px-2 hover:bg-black/5">🧮</button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !(Number(qtd.replace(',', '.')) > 0)} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Registrar entrada'}
          </button>
        </div>
      </div>
      {calc && (
        <Calculadora
          valorInicial={calc === 'custo' ? Number(custo.replace(',', '.')) || undefined : Number(preco.replace(',', '.')) || undefined}
          onUsar={(v) => { const s = String(v.toFixed(2)).replace('.', ','); if (calc === 'custo') setCusto(s); else setPreco(s) }}
          onClose={() => setCalc(null)}
        />
      )}
    </div>
  )
}
