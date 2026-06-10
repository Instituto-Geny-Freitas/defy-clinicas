import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  acceptDocument,
  listPatientDocuments,
  type DocInstance,
} from '@/lib/documents'
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
          <h2 className="mb-2 text-sm font-semibold text-texto/70">Receitas e arquivos</h2>
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
  const [aceito, setAceito] = useState(false)
  const [usoImagem, setUsoImagem] = useState<boolean | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    setSalvando(true)
    try {
      await acceptDocument(inst, requerAssinatura, { usoImagem })
      onAccepted()
    } catch {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-texto">{inst.document_templates?.nome}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <p className="whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm text-texto/80">
          {inst.corpo_final}
        </p>

        {jaConcluido && (
          <button
            onClick={() =>
              printDocument(
                { nome: inst.document_templates?.nome ?? 'Documento', corpo_final: inst.corpo_final, status: inst.status, assinado_em: inst.assinado_em, lido_em: inst.lido_em, content_hash: inst.content_hash, uso_imagem_autorizado: inst.uso_imagem_autorizado },
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
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requerAssinatura && (
              <div className="text-sm">
                <span className="text-texto/70">Autoriza uso de imagem (redes sociais, sem identidade)?</span>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={usoImagem === true} onChange={() => setUsoImagem(true)} /> Sim
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={usoImagem === false} onChange={() => setUsoImagem(false)} /> Não
                  </label>
                </div>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-texto/80">
              <input type="checkbox" className="mt-0.5" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              <span>
                {requerAssinatura
                  ? 'Li e concordo com o termo acima, e assino eletronicamente.'
                  : 'Li e estou ciente das orientações acima.'}
              </span>
            </label>

            <button
              onClick={confirmar}
              disabled={!aceito || salvando}
              className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Registrando…' : requerAssinatura ? 'Assinar' : 'Confirmar leitura'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
