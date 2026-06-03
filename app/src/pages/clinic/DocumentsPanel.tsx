import { useEffect, useState } from 'react'
import {
  getTemplate,
  issueDocument,
  listActiveTemplates,
  listPatientDocuments,
  renderCorpo,
  templateToFormSchema,
  updateDocumentInstance,
  type DocInstance,
  type DocTemplate,
} from '@/lib/documents'
import type { FormValues } from '@/forms/types'
import type { Patient } from '@/lib/types'
import DynamicForm from '@/forms/DynamicForm'
import DocStatusBadge from '@/components/DocStatusBadge'
import { printDocument } from '@/lib/printDoc'
import { useClinic } from '@/theme/ThemeProvider'
import { useAuth } from '@/auth/AuthProvider'

interface Props {
  patient: Patient
  clinicId: string
  professionalId?: string | null
}

export default function DocumentsPanel({ patient, clinicId, professionalId }: Props) {
  const clinic = useClinic()
  const { profile } = useAuth()
  const [docs, setDocs] = useState<DocInstance[]>([])
  const [carregando, setCarregando] = useState(true)
  const [emitindo, setEmitindo] = useState(false)
  const [editando, setEditando] = useState<DocInstance | null>(null)

  const prof = profile?.professional
    ? { nome: profile.professional.nome, conselho_tipo: profile.professional.conselho_tipo, conselho_numero: profile.professional.conselho_numero }
    : null

  function recarregar() {
    listPatientDocuments(patient.id)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patient.id])

  function gerarPdf(d: DocInstance) {
    printDocument(
      { nome: d.document_templates?.nome ?? 'Documento', corpo_final: d.corpo_final, status: d.status, assinado_em: d.assinado_em, lido_em: d.lido_em, content_hash: d.content_hash, uso_imagem_autorizado: d.uso_imagem_autorizado },
      clinic,
      { patient: { nome: patient.nome, cpf: patient.cpf, nascimento: patient.nascimento }, professional: prof },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Documentos do paciente</h3>
        <button onClick={() => setEmitindo(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Emitir documento
        </button>
      </div>

      {emitindo && (
        <IssueModal
          clinicId={clinicId}
          patientId={patient.id}
          professionalId={professionalId}
          onClose={() => setEmitindo(false)}
          onIssued={() => { setEmitindo(false); recarregar() }}
        />
      )}
      {editando && (
        <EditModal
          inst={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar() }}
        />
      )}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum documento emitido.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const editavel = d.status !== 'assinado' && d.status !== 'lido'
            return (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-4">
                <div>
                  <div className="text-sm font-medium text-texto">{d.document_templates?.nome}</div>
                  <div className="text-xs text-texto/50">
                    {d.document_templates?.tipo === 'termo' ? 'Termo' : 'Orientação'}
                    {d.assinado_em && ` · assinado em ${new Date(d.assinado_em).toLocaleDateString('pt-BR')}`}
                    {!d.assinado_em && d.lido_em && ` · lido em ${new Date(d.lido_em).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {editavel && (
                    <button onClick={() => setEditando(d)} className="text-xs font-medium text-texto/60 hover:underline">
                      Editar
                    </button>
                  )}
                  <button onClick={() => gerarPdf(d)} className="text-xs font-medium text-primaria hover:underline">
                    Gerar PDF
                  </button>
                  <DocStatusBadge status={d.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IssueModal({ clinicId, patientId, professionalId, onClose, onIssued }: {
  clinicId: string; patientId: string; professionalId?: string | null; onClose: () => void; onIssued: () => void
}) {
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [selecionado, setSelecionado] = useState<DocTemplate | null>(null)
  const [valores, setValores] = useState<FormValues>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { listActiveTemplates().then(setTemplates).catch(() => {}) }, [])

  async function emitir() {
    if (!selecionado) return
    setSalvando(true); setErro(null)
    try {
      await issueDocument({ template: selecionado, clinicId, patientId, professionalId, dados: valores })
      onIssued()
    } catch { setErro('Não foi possível emitir o documento.'); setSalvando(false) }
  }

  return (
    <ModalShell titulo="Emitir documento" onClose={onClose}>
      <label className="mb-1 block text-sm text-texto/70">Modelo</label>
      <select
        className="mb-4 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
        value={selecionado?.id ?? ''}
        onChange={(e) => { setSelecionado(templates.find((t) => t.id === e.target.value) ?? null); setValores({}) }}
      >
        <option value="">Selecione…</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.tipo === 'termo' ? '[Termo] ' : '[Orientação] '}{t.nome}</option>)}
      </select>

      {selecionado && (
        <>
          {selecionado.schema?.length > 0 && (
            <DynamicForm schema={templateToFormSchema(selecionado.schema)} values={valores} onChange={(k, v) => setValores((s) => ({ ...s, [k]: v }))} />
          )}
          <Preview corpo={renderCorpo(selecionado.corpo, valores)} />
        </>
      )}
      {erro && <p className="mt-3 text-sm text-secundaria">{erro}</p>}
      <ModalFooter onClose={onClose} onSave={emitir} disabled={!selecionado || salvando} label={salvando ? 'Emitindo…' : 'Emitir para o paciente'} />
    </ModalShell>
  )
}

function EditModal({ inst, onClose, onSaved }: { inst: DocInstance; onClose: () => void; onSaved: () => void }) {
  const [template, setTemplate] = useState<DocTemplate | null>(null)
  const [valores, setValores] = useState<FormValues>(inst.dados ?? {})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { getTemplate(inst.template_id).then(setTemplate).catch(() => {}) }, [inst.template_id])

  async function salvar() {
    if (!template) return
    setSalvando(true); setErro(null)
    try {
      await updateDocumentInstance(inst.id, template, valores)
      onSaved()
    } catch { setErro('Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <ModalShell titulo={`Editar: ${inst.document_templates?.nome ?? 'documento'}`} onClose={onClose}>
      {!template ? (
        <p className="text-sm text-texto/50">Carregando modelo…</p>
      ) : (
        <>
          {template.schema?.length > 0 ? (
            <DynamicForm schema={templateToFormSchema(template.schema)} values={valores} onChange={(k, v) => setValores((s) => ({ ...s, [k]: v }))} />
          ) : (
            <p className="text-sm text-texto/50">Este modelo não possui campos editáveis.</p>
          )}
          <Preview corpo={renderCorpo(template.corpo, valores)} />
        </>
      )}
      {erro && <p className="mt-3 text-sm text-secundaria">{erro}</p>}
      <ModalFooter onClose={onClose} onSave={salvar} disabled={!template || salvando} label={salvando ? 'Salvando…' : 'Salvar alterações'} />
    </ModalShell>
  )
}

// --- componentes auxiliares de modal --------------------------------------
function ModalShell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Preview({ corpo }: { corpo: string }) {
  return (
    <div className="mt-4 rounded-xl border border-black/5 bg-black/[0.02] p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-texto/40">Pré-visualização</div>
      <p className="whitespace-pre-wrap text-sm text-texto/80">{corpo}</p>
    </div>
  )
}

function ModalFooter({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{label}</button>
    </div>
  )
}
