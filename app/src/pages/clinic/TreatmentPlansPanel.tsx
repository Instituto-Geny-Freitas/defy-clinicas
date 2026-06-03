import { useEffect, useState } from 'react'
import {
  createTreatmentPlan,
  listSnippets,
  listTreatmentPlans,
  type TextSnippet,
  type TreatmentPlan,
} from '@/lib/treatmentPlans'
import { brl } from '@/lib/finance'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function TreatmentPlansPanel({ patientId, clinicId, professionalId }: Props) {
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Planos de tratamento</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo plano</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : planos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum plano de tratamento.</p>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-texto">{p.titulo || 'Plano de tratamento'}</div>
                <div className="text-xs text-texto/50">{new Date(p.data).toLocaleDateString('pt-BR')}</div>
              </div>
              {p.texto && <p className="mt-1 whitespace-pre-wrap text-sm text-texto/70">{p.texto}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-texto/50">
                {p.num_sessoes != null && <span>{p.num_sessoes} sessões</span>}
                {p.frequencia && <span>{p.frequencia}</span>}
                {p.valor_total != null && <span>{brl(p.valor_total)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [sessoes, setSessoes] = useState('')
  const [freq, setFreq] = useState('')
  const [valor, setValor] = useState('')
  const [snippets, setSnippets] = useState<TextSnippet[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { listSnippets('plano').then(setSnippets).catch(() => {}) }, [])

  function inserirSnippet(id: string) {
    const s = snippets.find((x) => x.id === id)
    if (s) setTexto((t) => (t ? t + '\n' : '') + s.conteudo)
  }

  async function salvar() {
    if (!texto.trim()) return
    setSalvando(true)
    try {
      await createTreatmentPlan({
        clinicId, patientId, professionalId, titulo: titulo || null, texto,
        num_sessoes: sessoes ? Number(sessoes) : null, frequencia: freq || null, valor_total: valor ? Number(valor) : null,
      })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Novo plano de tratamento" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm text-texto/70">Título</label><input className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        {snippets.length > 0 && (
          <div>
            <label className="mb-1 block text-sm text-texto/70">Inserir texto-padrão</label>
            <select className={field} value="" onChange={(e) => { inserirSnippet(e.target.value); e.target.value = '' }}>
              <option value="">Selecione um modelo…</option>
              {snippets.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
          </div>
        )}
        <div><label className="mb-1 block text-sm text-texto/70">Conteúdo *</label><textarea rows={6} className={field} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="mb-1 block text-sm text-texto/70">Sessões</label><input type="number" className={field} value={sessoes} onChange={(e) => setSessoes(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Frequência</label><input className={field} value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Valor (R$)</label><input type="number" className={field} value={valor} onChange={(e) => setValor(e.target.value)} /></div>
        </div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Salvar plano'} />
      </div>
    </Shell>
  )
}

export function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Footer({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{label}</button>
    </div>
  )
}
