import { useEffect, useRef, useState } from 'react'
import {
  EXAMES_PADRAO,
  createLabOrder,
  deleteLabResult,
  listLabOrders,
  listLabResults,
  uploadLabResult,
  type LabOrder,
  type LabResult,
} from '@/lib/labs'
import { buildExamesPdf } from '@/lib/examesPdf'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { Shell, Footer } from './TreatmentPlansPanel'
import { formatDateBR } from '@/lib/format'
import type { Patient } from '@/lib/types'

interface Props { patientId: string; clinicId: string; professionalId?: string | null; paciente?: Patient }

/** Abre o PDF em nova aba (permite imprimir e salvar). */
function abrirPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export default function LabsPanel({ patientId, clinicId, professionalId, paciente }: Props) {
  const { profile } = useAuth()
  const clinic = useClinic()
  const prof = profile?.professional
  const profissional = prof
    ? { nome: prof.nome, conselho: [prof.conselho_tipo, prof.conselho_numero].filter(Boolean).join(' ') + (prof.conselho_uf ? `-${prof.conselho_uf}` : '') || null }
    : null
  const pacienteHdr = { nome: paciente?.nome ?? 'Paciente', nascimento: paciente?.nascimento, cpf: paciente?.cpf, whatsapp: paciente?.whatsapp }

  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function recarregar() {
    Promise.all([listLabOrders(patientId), listLabResults(patientId)])
      .then(([o, r]) => { setOrders(o); setResults(r) })
      .catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  function gerarPdfDeOrdem(o: LabOrder) {
    const { blob } = buildExamesPdf({
      clinic, paciente: pacienteHdr, exames: o.exames, observacoes: o.observacoes, profissional, data: o.data,
    })
    abrirPdf(blob)
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      await uploadLabResult({ patientId, clinicId, file })
      recarregar()
    } catch { /* noop */ } finally {
      setEnviando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removerResultado(r: LabResult) {
    if (!confirm('Remover este resultado do dossiê?')) return
    await deleteLabResult(r)
    recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Exames laboratoriais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Requisitar exames</button>
      </div>
      {modal && (
        <Modal
          clinicId={clinicId} patientId={patientId} professionalId={professionalId}
          clinic={clinic} paciente={pacienteHdr} profissional={profissional}
          onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }}
        />
      )}

      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-medium text-texto/70">Requisições</h4>
            {orders.length === 0 ? <p className="text-sm text-texto/40">Nenhuma requisição.</p> : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-xl border border-black/5 bg-white p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-xs text-texto/50">{formatDateBR(o.data)} · {o.exames.length} exames</div>
                      <button onClick={() => gerarPdfDeOrdem(o)} className="text-xs font-medium text-primaria hover:underline">Gerar PDF / Imprimir</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {o.exames.map((e, i) => <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">{e}</span>)}
                    </div>
                    {o.observacoes && <p className="mt-2 text-xs text-texto/50">Obs.: {o.observacoes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-texto/70">Resultados anexados</h4>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={onArquivo} />
              <button onClick={() => fileRef.current?.click()} disabled={enviando}
                className="rounded-lg border border-primaria px-3 py-1.5 text-xs font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50">
                {enviando ? 'Enviando…' : '+ Anexar resultado'}
              </button>
            </div>
            {results.length === 0 ? <p className="text-sm text-texto/40">Nenhum resultado anexado. O profissional pode anexar PDF/imagem; o paciente também pode enviar pelo portal.</p> : (
              <div className="space-y-2">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
                    <span className="text-sm text-texto/70">Resultado · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                    <div className="flex items-center gap-3">
                      {r.signedUrl && <a href={r.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primaria hover:underline">Abrir</a>}
                      <button onClick={() => removerResultado(r)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
                    </div>
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

function Modal(props: {
  clinicId: string; patientId: string; professionalId?: string | null
  clinic: ReturnType<typeof useClinic>
  paciente: { nome: string; nascimento?: string | null; cpf?: string | null; whatsapp?: string | null }
  profissional: { nome: string; conselho: string | null } | null
  onClose: () => void; onSaved: () => void
}) {
  const { clinicId, patientId, professionalId, clinic, paciente, profissional, onClose, onSaved } = props
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  function toggle(e: string) {
    setSel((s) => { const n = new Set(s); n.has(e) ? n.delete(e) : n.add(e); return n })
  }

  const extraList = () => extra.split(',').map((x) => x.trim()).filter(Boolean)

  async function salvar() {
    const exames = [...sel, ...extraList()]
    if (exames.length === 0) return
    setSalvando(true)
    try {
      await createLabOrder({ clinicId, patientId, professionalId, exames, observacoes: obs || null })
      onSaved()
    } catch { setSalvando(false) }
  }

  function gerarPdf() {
    if (sel.size === 0 && extraList().length === 0) return
    const { blob } = buildExamesPdf({
      clinic, paciente, exames: [...sel], outrosExames: extra || null, observacoes: obs || null, profissional,
    })
    abrirPdf(blob)
  }

  const totalSel = sel.size + extraList().length

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
        <div className="flex items-center justify-between">
          <button onClick={gerarPdf} disabled={totalSel === 0} className="rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-40">
            Gerar PDF / Imprimir
          </button>
        </div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : `Requisitar (${totalSel})`} />
      </div>
    </Shell>
  )
}
