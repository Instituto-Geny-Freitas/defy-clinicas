import { useEffect, useState } from 'react'
import {
  createPrescription,
  listFormulationLibrary,
  listPrescriptions,
  type Ativo,
  type FormulationLib,
  type FormulationPrescription,
} from '@/lib/formulations'
import { Shell, Footer } from './TreatmentPlansPanel'
import { ATIVO_CATEGORIAS, listActiveIngredients, type ActiveIngredient, type AtivoCategoria } from '@/lib/domains'
import { formatDateBR } from '@/lib/format'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function FormulationsPanel({ patientId, clinicId, professionalId }: Props) {
  const [presc, setPresc] = useState<FormulationPrescription[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listPrescriptions(patientId).then(setPresc).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Fórmulas manipuladas</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova prescrição</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : presc.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma fórmula prescrita.</p>
      ) : (
        <div className="space-y-2">
          {presc.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-texto">Fórmula manipulada</div>
                <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
              </div>
              <ul className="mt-1 text-sm text-texto/80">
                {p.composicao.map((a, i) => <li key={i}>• {a.ativo} — {a.quantidade}{a.unidade}</li>)}
              </ul>
              {p.posologia && <p className="mt-1 text-sm text-texto/60">Posologia: {p.posologia}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [ativos, setAtivos] = useState<Ativo[]>([{ ativo: '', quantidade: '', unidade: 'mg' }])
  const [posologia, setPosologia] = useState('')
  const [salvarBib, setSalvarBib] = useState(false)
  const [nomeBib, setNomeBib] = useState('')
  const [biblioteca, setBiblioteca] = useState<FormulationLib[]>([])
  const [catalogo, setCatalogo] = useState<ActiveIngredient[]>([])
  const [catFiltro, setCatFiltro] = useState<AtivoCategoria | ''>('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listFormulationLibrary().then(setBiblioteca).catch(() => {})
    listActiveIngredients().then(setCatalogo).catch(() => {})
  }, [])

  const ativosFiltrados = catalogo.filter((a) => !catFiltro || a.categoria === catFiltro)

  function carregarDaBiblioteca(id: string) {
    const f = biblioteca.find((x) => x.id === id)
    if (f) { setAtivos(f.composicao.length ? f.composicao : [{ ativo: '', quantidade: '', unidade: 'mg' }]); setPosologia(f.posologia ?? '') }
  }
  function setAtivo(i: number, patch: Partial<Ativo>) { setAtivos((arr) => arr.map((a, idx) => idx === i ? { ...a, ...patch } : a)) }

  async function salvar() {
    const comp = ativos.filter((a) => a.ativo.trim())
    if (comp.length === 0) return
    setSalvando(true)
    try {
      await createPrescription({ clinicId, patientId, professionalId, composicao: comp, posologia, salvarBiblioteca: salvarBib, nomeBiblioteca: nomeBib })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Nova fórmula manipulada" onClose={onClose}>
      <div className="space-y-3">
        {biblioteca.length > 0 && (
          <div>
            <label className="mb-1 block text-sm text-texto/70">Carregar da biblioteca</label>
            <select className={field} value="" onChange={(e) => { carregarDaBiblioteca(e.target.value); e.target.value = '' }}>
              <option value="">Selecione uma fórmula salva…</option>
              {biblioteca.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-texto/70">Composição</label>
            <button onClick={() => setAtivos((a) => [...a, { ativo: '', quantidade: '', unidade: 'mg' }])} className="text-xs font-medium text-primaria hover:underline">+ Ativo</button>
          </div>
          {catalogo.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-texto/50">Filtrar ativos:</span>
              <select className="rounded-lg border border-black/10 px-2 py-1 text-xs" value={catFiltro} onChange={(e) => setCatFiltro(e.target.value as AtivoCategoria | '')}>
                <option value="">Todas as categorias</option>
                {ATIVO_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
          )}
          {/* Lista de ativos do catálogo, filtrada pela categoria escolhida */}
          <datalist id="ativos-catalogo">
            {ativosFiltrados.map((a) => <option key={a.id} value={a.nome} />)}
          </datalist>
          <div className="space-y-2">
            {ativos.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input list="ativos-catalogo" className={field} placeholder="Ativo (escolha ou digite)" value={a.ativo} onChange={(e) => setAtivo(i, { ativo: e.target.value })} />
                <input className="w-24 rounded-lg border border-black/10 px-2 py-2 text-sm" placeholder="Qtd" value={a.quantidade} onChange={(e) => setAtivo(i, { quantidade: e.target.value })} />
                <input className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm" placeholder="un." value={a.unidade} onChange={(e) => setAtivo(i, { unidade: e.target.value })} />
                <button onClick={() => setAtivos((arr) => arr.filter((_, idx) => idx !== i))} className="px-1 text-texto/40 hover:text-secundaria">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Posologia</label><textarea rows={2} className={field} value={posologia} onChange={(e) => setPosologia(e.target.value)} placeholder="Ex.: 1 dose ao dia, à noite, 60 caps." /></div>
        <label className="flex items-center gap-2 text-sm text-texto/70">
          <input type="checkbox" checked={salvarBib} onChange={(e) => setSalvarBib(e.target.checked)} /> Salvar na biblioteca de fórmulas
        </label>
        {salvarBib && <input className={field} placeholder="Nome da fórmula na biblioteca" value={nomeBib} onChange={(e) => setNomeBib(e.target.value)} />}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Prescrever'} />
      </div>
    </Shell>
  )
}
