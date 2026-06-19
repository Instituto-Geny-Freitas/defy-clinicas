import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  camposDe,
  confirmPatientDocument,
  getTemplate,
  listPatientDocuments,
  renderCorpo,
  resolveAuto,
  type DocInstance,
  type DocTemplate,
} from '@/lib/documents'
import type { FormValues } from '@/forms/types'
import DynamicForm from '@/forms/DynamicForm'
import DocStatusBadge from '@/components/DocStatusBadge'
import { printDocument } from '@/lib/printDoc'
import { useClinic } from '@/theme/ThemeProvider'
import { listSharedForPatient, type SharedDocument } from '@/lib/sharedDocs'

export default function PatientDocuments() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const [docs, setDocs] = useState<DocInstance[]>([])
  const [arquivos, setArquivos] = useState<SharedDocument[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<DocInstance | null>(null)

  function recarregar() {
    if (!patientId) return
    Promise.all([listPatientDocuments(patientId), listSharedForPatient(patientId)])
      .then(([d, a]) => { setDocs(d); setArquivos(a) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Meus Documentos</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Termos a assinar, orientações e receitas enviadas pela clínica.</p>

      {arquivos.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-texto/70">Receitas, orçamentos e arquivos</h2>
          <div className="space-y-2">
            {arquivos.map((a) => (
              <a key={a.id} href={a.signedUrl} target="_blank" rel="noopener noreferrer"
                className={`flex w-full items-center justify-between rounded-xl border border-black/5 bg-white p-4 ${a.signedUrl ? 'hover:bg-black/[0.02]' : 'pointer-events-none opacity-60'}`}>
                <div>
                  <div className="text-sm font-medium text-texto">{a.titulo}</div>
                  <div className="text-xs text-texto/50">{new Date(a.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <span className="text-sm font-medium text-primaria">Abrir PDF</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {arquivos.length > 0 && <h2 className="mb-2 text-sm font-semibold text-texto/70">Termos e orientações</h2>}

      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhum documento no momento.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setAberto(d)}
              className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white p-4 text-left hover:bg-black/[0.02]"
            >
              <div>
                <div className="text-sm font-medium text-texto">{d.document_templates?.nome}</div>
                <div className="text-xs text-texto/50">
                  {d.document_templates?.tipo === 'termo' ? 'Termo de consentimento' : 'Orientação'}
                </div>
              </div>
              <DocStatusBadge status={d.status} />
            </button>
          ))}
        </div>
      )}

      {aberto && (
        <DocumentViewer
          inst={aberto}
          onClose={() => setAberto(null)}
          onAccepted={() => {
            setAberto(null)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function DocumentViewer({
  inst,
  onClose,
  onAccepted,
}: {
  inst: DocInstance
  onClose: () => void
  onAccepted: () => void
}) {
  const clinic = useClinic()
  const { profile } = useAuth()
  const requerAssinatura = inst.document_templates?.requer_assinatura ?? false
  const jaConcluido = inst.status === 'assinado' || inst.status === 'lido'
  const [template, setTemplate] = useState<DocTemplate | null>(null)
  const [valores, setValores] = useState<FormValues>({})
  const [aceito, setAceito] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (!jaConcluido) getTemplate(inst.template_id).then(setTemplate).catch(() => {}) }, [inst.template_id, jaConcluido])

  const camposPaciente = template ? camposDe(template.schema, 'paciente') : []

  // Pré-visualização ao vivo: dados emitidos + o que o paciente preenche + data da ciência.
  const corpoPreview = (() => {
    if (!template) return inst.corpo_final ?? ''
    const dados: FormValues = { ...(inst.dados ?? {}), ...valores }
    for (const f of template.schema ?? []) {
      if (f.preenchidoPor === 'sistema' && f.auto === 'data_ciencia' && dados[f.key] === undefined) dados[f.key] = resolveAuto(f.auto, {})
    }
    return renderCorpo(template.corpo, dados)
  })()

  async function confirmar() {
    const faltando = camposPaciente.filter((f) => f.required && (valores[f.key] === undefined || valores[f.key] === '' || valores[f.key] === null))
    if (faltando.length > 0) { setErro(`Preencha: ${faltando.map((f) => f.label).join(', ')}.`); return }
    if (!template) return
    setSalvando(true); setErro(null)
    try {
      await confirmPatientDocument({
        inst, template, valoresPaciente: valores, requerAssinatura,
        paciente: { nome: profile?.patient?.nome, cpf: profile?.patient?.cpf, nascimento: profile?.patient?.nascimento },
      })
      onAccepted()
    } catch { setErro('Não foi possível registrar.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-texto">{inst.document_templates?.nome}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <p className="whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm text-texto/80">
          {jaConcluido ? inst.corpo_final : corpoPreview}
        </p>

        {jaConcluido && (
          <button
            onClick={() =>
              printDocument(
                { nome: inst.document_templates?.nome ?? 'Documento', corpo_final: inst.corpo_final, status: inst.status, assinado_em: inst.assinado_em, lido_em: inst.lido_em, content_hash: inst.assinatura_hash ?? inst.content_hash, uso_imagem_autorizado: inst.uso_imagem_autorizado },
                clinic,
                { patient: profile?.patient ? { nome: profile.patient.nome, cpf: profile.patient.cpf, nascimento: profile.patient.nascimento } : null },
              )
            }
            className="mt-3 text-sm font-medium text-primaria hover:underline"
          >
            Gerar PDF
          </button>
        )}

        {jaConcluido ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {requerAssinatura ? 'Documento assinado' : 'Leitura confirmada'}
            {inst.assinado_em && ` em ${new Date(inst.assinado_em).toLocaleString('pt-BR')}`}
            {!inst.assinado_em && inst.lido_em && ` em ${new Date(inst.lido_em).toLocaleString('pt-BR')}`}.
            {inst.assinatura_hash && <div className="mt-1 break-all text-[10px] text-emerald-700/70">Autenticação: {inst.assinatura_hash.slice(0, 24)}…</div>}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {camposPaciente.length > 0 && (
              <DynamicForm
                schema={{ sections: [{ title: 'Confirme as informações', fields: camposPaciente }] }}
                values={valores}
                onChange={(k, v) => setValores((s) => ({ ...s, [k]: v }))}
              />
            )}

            <label className="flex items-start gap-2 text-sm text-texto/80">
              <input type="checkbox" className="mt-0.5" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              <span>
                {requerAssinatura
                  ? 'Li e concordo com o documento acima, e assino eletronicamente.'
                  : 'Li e estou ciente das orientações acima.'}
              </span>
            </label>

            {erro && <p className="text-sm text-secundaria">{erro}</p>}

            <button
              onClick={confirmar}
              disabled={!aceito || salvando || !template}
              className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Registrando…' : requerAssinatura ? 'Assinar' : 'Confirmar leitura'}
            </button>
            <p className="text-center text-[11px] text-texto/40">Ao confirmar, registramos data, hora e um código de autenticidade do seu aceite.</p>
          </div>
        )}
      </div>
    </div>
  )
}
