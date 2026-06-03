import { useEffect, useState } from 'react'
import {
  EXAMES_PADRAO,
  createLabOrder,
  listLabOrders,
  listLabResults,
  type LabOrder,
  type LabResult,
} from '@/lib/labs'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }

export default function LabsPanel({ patientId, clinicId, professionalId }: Props) {
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    Promise.all([listLabOrders(patientId), listLabResults(patientId)])
      .then(([o, r]) => { setOrders(o); setResults(r) })
      .catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Exames laboratoriais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Requisitar exames</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}

      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-medium text-texto/70">Requisições</h4>
            {orders.length === 0 ? <p className="text-sm text-texto/40">Nenhuma requisição.</p> : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-xl border border-black/5 bg-white p-4">
                    <div className="mb-1 text-xs text-texto/50">{new Date(o.data).toLocaleDateString('pt-BR')} · {o.exames.length} exames</div>
                    <div className="flex flex-wrap gap-1.5">
                      {o.exames.map((e, i) => <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">{e}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-texto/70">Resultados enviados</h4>
            {results.length === 0 ? <p className="text-sm text-texto/40">Nenhum resultado anexado (o paciente pode enviar pelo portal).</p> : (
              <div className="space-y-2">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
                    <span className="text-sm text-texto/70">Resultado · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                    {r.signedUrl && <a href={r.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primaria hover:underline">Abrir</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  function toggle(e: string) {
    setSel((s) => { const n = new Set(s); n.has(e) ? n.delete(e) : n.add(e); return n })
  }

  async function salvar() {
    const exames = [...sel, ...extra.split(',').map((x) => x.trim()).filter(Boolean)]
    if (exames.length === 0) return
    setSalvando(true)
    try {
      await createLabOrder({ clinicId, patientId, professionalId, exames, observacoes: obs || null })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Requisitar exames" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-texto/50">
          <span>Selecione os exames do painel padrão</span>
          <button onClick={() => setSel(new Set(EXAMES_PADRAO))} className="font-medium text-primaria hover:underline">marcar todos</button>
        </div>
        <div className="grid max-h-60 grid-cols-2 gap-x-3 gap-y-1 overflow-auto rounded-lg border border-black/10 p-3 sm:grid-cols-3">
          {EXAMES_PADRAO.map((e) => (
            <label key={e} className="flex items-center gap-1.5 text-xs text-texto/80">
              <input type="checkbox" checked={sel.has(e)} onChange={() => toggle(e)} /> {e}
            </label>
          ))}
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Outros exames (separados por vírgula)</label><input className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : `Requisitar (${sel.size + (extra ? extra.split(',').filter((x) => x.trim()).length : 0)})`} />
      </div>
    </Shell>
  )
}
