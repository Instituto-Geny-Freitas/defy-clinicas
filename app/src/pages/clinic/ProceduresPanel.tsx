import { useEffect, useState } from 'react'
import { listProcedures, createProcedure, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listInventory, type InventoryItem } from '@/lib/inventory'

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
  const [procedimento, setProcedimento] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [regiao, setRegiao] = useState('')
  const [obs, setObs] = useState('')
  const [produtos, setProdutos] = useState<UsedProduct[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listInventory().then(setEstoque).catch(() => {})
  }, [])

  function addProduto() {
    setProdutos((p) => [...p, { inventory_id: '', produto: '', qtd: 1 }])
  }
  function setProduto(idx: number, item: InventoryItem | null, qtd: number) {
    setProdutos((arr) =>
      arr.map((p, i) =>
        i === idx
          ? { inventory_id: item?.id ?? '', produto: item?.produto ?? '', lote: item?.lote ?? null, qtd }
          : p,
      ),
    )
  }
  function removeProduto(idx: number) {
    setProdutos((arr) => arr.filter((_, i) => i !== idx))
  }

  async function salvar() {
    if (!procedimento.trim()) return
    setSalvando(true)
    try {
      await createProcedure({
        clinicId,
        patientId,
        professionalId,
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
            <input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Toxina botulínica" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Região</label><input className={field} value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
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
