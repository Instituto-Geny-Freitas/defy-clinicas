import { useEffect, useState } from 'react'
import {
  deletePrescription,
  listFormulationLibrary,
  listPrescriptions,
  prescribeFormula,
  type FormulationLib,
  type FormulationPrescription,
} from '@/lib/formulations'
import { formatDateBR } from '@/lib/format'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }

export default function FormulationsPanel({ patientId, clinicId, professionalId }: Props) {
  const [presc, setPresc] = useState<FormulationPrescription[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listPrescriptions(patientId).then(setPresc).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function remover(id: string) {
    if (!confirm('Remover esta fórmula do paciente?')) return
    await deletePrescription(id)
    recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Fórmulas designadas</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Designar fórmula</button>
      </div>
      {modal && (
        <DesignarModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : presc.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma fórmula designada. Use "Designar fórmula" para escolher da biblioteca.</p>
      ) : (
        <div className="space-y-2">
          {presc.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-texto">{p.formulations?.nome ?? 'Fórmula manipulada'}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
                  <button onClick={() => remover(p.id)} className="text-xs text-secundaria hover:underline">Remover</button>
                </div>
              </div>
              <ul className="mt-1 text-sm text-texto/80">
                {(p.composicao ?? []).map((a, i) => <li key={i}>• {a.ativo} — {a.quantidade}{a.unidade}</li>)}
              </ul>
              {p.posologia && <p className="mt-1 text-sm text-texto/60">Posologia: {p.posologia}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DesignarModal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [biblioteca, setBiblioteca] = useState<FormulationLib[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { listFormulationLibrary().then(setBiblioteca).catch(() => {}) }, [])
  const visiveis = biblioteca.filter((f) => f.nome.toLowerCase().includes(busca.toLowerCase()))
  function toggle(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function salvar() {
    if (sel.size === 0) return
    setSalvando(true)
    try {
      for (const f of biblioteca.filter((x) => sel.has(x.id))) {
        await prescribeFormula({ clinicId, patientId, professionalId, formula: f })
      }
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Designar fórmulas" onClose={onClose}>
      <div className="space-y-3">
        <input className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" placeholder="Buscar fórmula…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {biblioteca.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 p-4 text-center text-sm text-texto/50">
            Nenhuma fórmula na biblioteca. Cadastre em Configurações → Fórmulas.
          </p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-auto">
            {visiveis.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/5 p-3 text-sm hover:bg-black/[0.02]">
                <input type="checkbox" className="mt-0.5" checked={sel.has(f.id)} onChange={() => toggle(f.id)} />
                <span>
                  <span className="font-medium text-texto">{f.nome}</span>
                  {f.forma && <span className="ml-1 text-xs text-texto/50">({f.forma})</span>}
                  <span className="block text-xs text-texto/60">{(f.composicao ?? []).map((a) => `${a.ativo} ${a.quantidade}${a.unidade}`).join('; ')}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || sel.size === 0} label={salvando ? 'Designando…' : `Designar (${sel.size})`} />
      </div>
    </Shell>
  )
}
