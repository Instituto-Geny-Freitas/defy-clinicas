import { useEffect, useState } from 'react'
import {
  deletePrescription,
  listFormulationLibrary,
  listPrescriptions,
  prescribeFormula,
  type FormulationLib,
  type FormulationPrescription,
} from '@/lib/formulations'
import { listSuppliers, type Supplier } from '@/lib/domains'
import { buildFormulaPdf, type ProfissionalReceita } from '@/lib/formulaPdf'
import { createSharedDocument, enviarDocumentoFornecedor } from '@/lib/sharedDocs'
import { formatDateBR } from '@/lib/format'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
  pacienteNome?: string
  pacienteWhatsapp?: string | null
}

export default function FormulationsPanel({ patientId, clinicId, professionalId, pacienteNome, pacienteWhatsapp }: Props) {
  const { profile } = useAuth()
  const prof = profile?.professional
  const profissional: ProfissionalReceita | null = prof
    ? { nome: prof.nome, conselho: [prof.conselho_tipo, prof.conselho_numero].filter(Boolean).join(' ') || null }
    : null
  const [presc, setPresc] = useState<FormulationPrescription[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [receita, setReceita] = useState<FormulationPrescription[] | null>(null)

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
        <div className="flex gap-2">
          {presc.length > 0 && (
            <button onClick={() => setReceita(presc)} className="rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5">Gerar receita (PDF)</button>
          )}
          <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Designar fórmula</button>
        </div>
      </div>
      {modal && (
        <DesignarModal
          clinicId={clinicId}
          patientId={patientId}
          professionalId={professionalId}
          onClose={() => setModal(false)}
          onSaved={(libs) => {
            setModal(false)
            recarregar()
            // Abre a receita já com as fórmulas recém-designadas
            setReceita(libs.map(libToPresc))
          }}
        />
      )}
      {receita && (
        <ReceitaModal
          clinicId={clinicId}
          patientId={patientId}
          professionalId={professionalId}
          pacienteNome={pacienteNome ?? 'Paciente'}
          pacienteWhatsapp={pacienteWhatsapp}
          formulas={receita}
          profissional={profissional}
          onClose={() => setReceita(null)}
        />
      )}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : presc.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma fórmula designada. Use "Designar fórmula" para escolher da biblioteca.</p>
      ) : (
        <div className="space-y-2">
          {presc.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-texto">{p.nome ?? p.formulations?.nome ?? 'Fórmula manipulada'}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
                  <button onClick={() => setReceita([p])} className="text-xs text-primaria hover:underline">Receita</button>
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

function libToPresc(f: FormulationLib): FormulationPrescription {
  return {
    id: f.id,
    patient_id: '',
    formulation_id: f.id,
    nome: f.nome,
    composicao: f.composicao,
    posologia: f.posologia,
    data: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    formulations: { nome: f.nome },
  }
}

function DesignarModal({ clinicId, patientId, professionalId, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onSaved: (libs: FormulationLib[]) => void }) {
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
      const escolhidas = biblioteca.filter((x) => sel.has(x.id))
      for (const f of escolhidas) {
        await prescribeFormula({ clinicId, patientId, professionalId, formula: f })
      }
      onSaved(escolhidas)
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

function ReceitaModal(props: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  pacienteNome: string
  pacienteWhatsapp?: string | null
  formulas: FormulationPrescription[]
  profissional?: ProfissionalReceita | null
  onClose: () => void
}) {
  const { clinicId, patientId, professionalId, pacienteNome, pacienteWhatsapp, formulas, profissional, onClose } = props
  const clinic = useClinic()
  const [fornecedores, setFornecedores] = useState<Supplier[]>([])
  const [fornId, setFornId] = useState('')
  const [docId, setDocId] = useState<string | null>(null)
  const [enviadoPac, setEnviadoPac] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { listSuppliers().then(setFornecedores).catch(() => {}) }, [])

  function montarPdf() {
    return buildFormulaPdf({ clinic, pacienteNome, pacienteWhatsapp, formulas, profissional })
  }

  function baixar() {
    const { blob, filename } = montarPdf()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  /** Garante que existe um shared_document (faz upload uma única vez). */
  async function garantirDoc(enviarPaciente: boolean): Promise<string> {
    if (docId) return docId
    const { blob, filename } = montarPdf()
    const doc = await createSharedDocument({
      clinicId, patientId, professionalId,
      titulo: filename.replace(/\.pdf$/, ''),
      categoria: 'manipulacao',
      blob,
      enviarPaciente,
    })
    setDocId(doc.id)
    if (enviarPaciente) setEnviadoPac(true)
    return doc.id
  }

  async function enviarPaciente() {
    setBusy(true); setMsg(null)
    try {
      await garantirDoc(true)
      setEnviadoPac(true)
      setMsg('Documento enviado ao paciente (aba Documentos).')
    } catch (e) { setMsg((e as Error).message ?? 'Erro ao enviar.') } finally { setBusy(false) }
  }

  async function enviarFornecedor() {
    const forn = fornecedores.find((f) => f.id === fornId)
    if (!forn) { setMsg('Selecione um fornecedor.'); return }
    if (!forn.telefone) { setMsg('Fornecedor sem telefone/WhatsApp cadastrado.'); return }
    setBusy(true); setMsg(null)
    try {
      const id = await garantirDoc(false)
      const r = await enviarDocumentoFornecedor({ docId: id, fornecedorNome: forn.nome, fornecedorWhatsapp: forn.telefone })
      setMsg(r.mensagem)
    } catch (e) { setMsg((e as Error).message ?? 'Erro ao enviar.') } finally { setBusy(false) }
  }

  return (
    <Shell titulo="Receita de manipulação" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-black/[0.02] p-3 text-sm">
          <div className="font-medium text-texto">{pacienteNome}{pacienteWhatsapp ? ` — ${pacienteWhatsapp}` : ''}</div>
          <ul className="mt-2 space-y-1 text-texto/70">
            {formulas.map((f, i) => (
              <li key={i}><span className="font-medium text-texto/80">{f.nome ?? f.formulations?.nome ?? 'Fórmula'}</span>
                {(f.composicao ?? []).length > 0 && <span className="block text-xs text-texto/50">{(f.composicao ?? []).map((a) => `${a.ativo} ${a.quantidade}${a.unidade}`).join('; ')}</span>}
              </li>
            ))}
          </ul>
        </div>

        <button onClick={baixar} className="text-sm font-medium text-primaria hover:underline">Baixar / visualizar PDF</button>

        <div className="border-t border-black/5 pt-3">
          <p className="mb-2 text-sm font-medium text-texto">Enviar ao paciente</p>
          <button onClick={enviarPaciente} disabled={busy || enviadoPac}
            className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviadoPac ? 'Enviado ✓' : busy ? 'Enviando…' : 'Enviar para o paciente'}
          </button>
        </div>

        <div className="border-t border-black/5 pt-3">
          <p className="mb-2 text-sm font-medium text-texto">Enviar ao fornecedor (WhatsApp)</p>
          <div className="flex gap-2">
            <select className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={fornId} onChange={(e) => setFornId(e.target.value)}>
              <option value="">Selecione o fornecedor…</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.telefone ? ` — ${f.telefone}` : ' (sem WhatsApp)'}</option>)}
            </select>
            <button onClick={enviarFornecedor} disabled={busy || !fornId}
              className="shrink-0 rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50">
              Enviar
            </button>
          </div>
          <p className="mt-1 text-xs text-texto/50">Cadastre fornecedores e telefones em Configurações → Fornecedores. A ativação do provedor de WhatsApp é feita em Configurações → Integrações.</p>
        </div>

        {msg && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{msg}</p>}
      </div>
    </Shell>
  )
}
