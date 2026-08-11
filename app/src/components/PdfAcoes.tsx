import { useState } from 'react'
import { createSharedDocument } from '@/lib/sharedDocs'

/**
 * Ações de um PDF gerado na hora: baixar, imprimir e enviar ao portal do
 * paciente (aba Documentos). O upload acontece uma única vez por registro.
 */
export default function PdfAcoes({ clinicId, patientId, professionalId, categoria, montar, compacto }: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  /** Categoria em shared_documents (ex.: 'procedimento' | 'suplementacao'). */
  categoria: string
  /** Gera o PDF sob demanda. */
  montar: () => { blob: Blob; filename: string }
  compacto?: boolean
}) {
  const [enviado, setEnviado] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function baixar() {
    const { blob, filename } = montar()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  function imprimir() {
    const { blob } = montar()
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) win.addEventListener('load', () => win.print())
    else baixar()   // popup bloqueado: cai para o download
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  async function enviarPortal() {
    setBusy(true); setMsg(null)
    try {
      const { blob, filename } = montar()
      await createSharedDocument({
        clinicId, patientId, professionalId,
        titulo: filename.replace(/\.pdf$/, ''),
        categoria, blob, enviarPaciente: true,
      })
      setEnviado(true)
      setMsg('Disponível no portal do paciente (aba Documentos).')
    } catch (e) { setMsg((e as Error)?.message || 'Não foi possível enviar.') } finally { setBusy(false) }
  }

  const cls = compacto ? 'text-xs font-medium text-texto/60 hover:underline' : 'text-sm font-medium text-primaria hover:underline'

  return (
    <>
      <button onClick={baixar} className={cls} title="Baixar PDF">PDF</button>
      <button onClick={imprimir} className={cls} title="Imprimir">Imprimir</button>
      <button onClick={enviarPortal} disabled={busy} className={`${cls} disabled:opacity-50`} title="Disponibilizar no portal do paciente">
        {busy ? 'Enviando…' : enviado ? '✓ No portal' : 'Enviar ao portal'}
      </button>
      {msg && <span className="text-[11px] text-texto/50">{msg}</span>}
    </>
  )
}
