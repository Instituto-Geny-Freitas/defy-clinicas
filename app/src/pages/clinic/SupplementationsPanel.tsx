import { useEffect, useState } from 'react'
import { createSupplementation, listSupplementations, setSupplementationPaid, type Supplementation } from '@/lib/supplementations'
import { listActiveIngredients, listRoutes, type ActiveIngredient, type DomainItem } from '@/lib/domains'
import { brl } from '@/lib/finance'
import { formatDateBR } from '@/lib/format'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function SupplementationsPanel({ patientId, clinicId, professionalId }: Props) {
  const [itens, setItens] = useState<Supplementation[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listSupplementations(patientId).then(setItens).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function togglePago(s: Supplementation) {
    await setSupplementationPaid(s.id, !s.pago)
    recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Suplementação</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova suplementação</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma suplementação prescrita.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr><th className="px-4 py-2 font-medium">Medicação</th><th className="px-4 py-2 font-medium">Via/Local</th><th className="px-4 py-2 font-medium">Validade</th><th className="px-4 py-2 font-medium">Lote</th><th className="px-4 py-2 font-medium">Valor</th><th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Pagamento</th></tr>
            </thead>
            <tbody>
              {itens.map((s) => (
                <tr key={s.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{s.medicacao}</td>
                  <td className="px-4 py-2 text-texto/70">{s.via_adm ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{s.validade ? formatDateBR(s.validade) : '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{s.lote ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{Number(s.valor_venda) > 0 ? brl(Number(s.valor_venda)) : '—'}</td>
                  <td className="px-4 py-2 text-texto/60">{formatDateBR(s.data)}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => togglePago(s)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.pago ? 'Pago' : 'Não pago'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [ativos, setAtivos] = useState<ActiveIngredient[]>([])
  const [vias, setVias] = useState<DomainItem[]>([])
  const [ativoId, setAtivoId] = useState('')
  const [via, setVia] = useState('')
  const [validade, setValidade] = useState('')
  const [lote, setLote] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [valorVenda, setValorVenda] = useState(0)
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listActiveIngredients().then(setAtivos).catch(() => {})
    listRoutes().then(setVias).catch(() => {})
  }, [])

  const ativo = ativos.find((a) => a.id === ativoId) ?? null

  function escolherAtivo(id: string) {
    setAtivoId(id)
    const a = ativos.find((x) => x.id === id)
    if (a) {
      setVia(a.via ?? '')
      setValidade(a.validade ?? '')
      setLote(a.lote ?? '')
      setFornecedor(a.fornecedor ?? '')
      setValorVenda(Number(a.preco_venda) || 0)
    }
  }

  async function salvar() {
    if (!ativo) return
    setSalvando(true)
    try {
      await createSupplementation({
        clinicId, patientId, professionalId,
        medicacao: ativo.nome,
        via_adm: via || null,
        validade: validade || null,
        lote: lote || null,
        fornecedor: fornecedor || null,
        valor_venda: valorVenda,
        observacoes: obs || null,
      })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Nova suplementação" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Medicação *</label>
          <select className={field} value={ativoId} onChange={(e) => escolherAtivo(e.target.value)}>
            <option value="">Selecione o ativo…</option>
            {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        {ativo && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-texto/70">Via Adm / local</label>
                <select className={field} value={via} onChange={(e) => setVia(e.target.value)}>
                  <option value="">Selecione…</option>
                  {vias.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                  {via && !vias.some((v) => v.nome === via) && <option value={via}>{via}</option>}
                </select>
              </div>
              <div><label className="mb-1 block text-sm text-texto/70">Fornecedor</label><input className={field} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} /></div>
              <div><label className="mb-1 block text-sm text-texto/70">Lote</label><input className={field} value={lote} onChange={(e) => setLote(e.target.value)} /></div>
              <div><label className="mb-1 block text-sm text-texto/70">Validade</label><input type="date" className={field} value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
              <div>
                <label className="mb-1 block text-sm text-texto/70">Valor de Venda</label>
                <input className={field} inputMode="decimal" value={valorVenda} onChange={(e) => setValorVenda(Number(e.target.value) || 0)} />
                <p className="mt-1 text-xs text-texto/50">{brl(valorVenda)}</p>
              </div>
            </div>
            <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </>
        )}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || !ativo} label={salvando ? 'Salvando…' : 'Salvar'} />
      </div>
    </Shell>
  )
}
