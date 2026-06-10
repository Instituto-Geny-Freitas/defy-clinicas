import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { formatDateBR } from '@/lib/format'
import {
  addStockEntry,
  createInventoryItem,
  deleteInventoryItem,
  estoqueBaixo,
  listInventory,
  updateInventoryItem,
  validadeProxima,
  type InventoryInput,
  type InventoryItem,
} from '@/lib/inventory'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function Inventory() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [itens, setItens] = useState<InventoryItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<InventoryItem | null>(null)

  function recarregar() {
    listInventory().then(setItens).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [])

  async function entrada(item: InventoryItem) {
    const qtd = Number(prompt(`Entrada de estoque para "${item.produto}" — quantidade:`, '1'))
    if (!qtd || qtd <= 0 || !clinicId) return
    await addStockEntry(clinicId, item.id, qtd)
    recarregar()
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
        <ProdutoModal clinicId={clinicId} item={null} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {editando && clinicId && (
        <ProdutoModal clinicId={clinicId} item={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum produto cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
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
              {itens.map((i) => (
                <tr key={i.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">
                    {i.produto}
                    {i.marca && <span className="text-texto/40"> · {i.marca}</span>}
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
                    <button onClick={() => entrada(i)} className="text-xs font-medium text-primaria hover:underline">
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
        )}
      </div>
    </div>
  )
}

function ProdutoModal({ clinicId, item, onClose, onSaved }: { clinicId: string; item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
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
      if (item) await updateInventoryItem(item.id, f)
      else await createInventoryItem(clinicId, f)
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
              <label className="mb-1 block text-sm text-texto/70">Qtd atual</label>
              <input className={`${field} bg-black/[0.03]`} value={f.qtd_atual ?? 0} disabled readOnly />
              <p className="mt-1 text-xs text-texto/40">Ajuste via "+ Entrada" (movimentações)</p>
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
