import { useEffect, useState } from 'react'
import DynamicForm from './DynamicForm'
import { anamnesisSchema } from './anamnesisSchema'
import type { FormValues } from './types'
import { getLatestAnamnesis, getProfessionalNome, saveAnamnesis } from '@/lib/anamnesis'
import { buildAnamnesePdf, DECLARACAO_VERACIDADE } from '@/lib/anamnesePdf'
import { getPatient } from '@/lib/patients'
import { useClinic } from '@/theme/ThemeProvider'

interface AnamnesisFormProps {
  patientId: string
  clinicId: string
  professionalId?: string | null
  preenchidoPor: 'paciente' | 'profissional'
  /** Mostra o aceite do termo de veracidade (usado no portal do paciente). */
  withConsent?: boolean
  /** Valores iniciais pré-preenchidos a partir do cadastro. */
  prefill?: FormValues
}

export default function AnamnesisForm({
  patientId,
  clinicId,
  professionalId,
  preenchidoPor,
  withConsent,
  prefill,
}: AnamnesisFormProps) {
  const clinic = useClinic()
  const [values, setValues] = useState<FormValues>(prefill ?? {})
  const [recordId, setRecordId] = useState<string | undefined>()
  const [consentir, setConsentir] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // Retrato do que está salvo — o PDF sempre reflete a ficha gravada no banco.
  const [salvoSnapshot, setSalvoSnapshot] = useState<string>('')
  const alterado = JSON.stringify(values) !== salvoSnapshot

  useEffect(() => {
    getLatestAnamnesis(patientId)
      .then((rec) => {
        if (rec) {
          const v = { ...(prefill ?? {}), ...rec.dados }
          setRecordId(rec.id)
          setValues(v)
          setSalvoSnapshot(JSON.stringify(v))
          setConsentir(Boolean(rec.consentimento_em))
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  async function baixarPdf() {
    if (alterado) { setMsg('Há alterações não salvas. Salve a anamnese antes de gerar o PDF.'); return }
    setGerandoPdf(true)
    setMsg(null)
    try {
      const [registro, paciente] = await Promise.all([getLatestAnamnesis(patientId), getPatient(patientId)])
      if (!registro || !paciente) { setMsg('Salve a anamnese antes de gerar o PDF.'); return }
      const profissionalNome = registro.preenchido_por === 'profissional' ? await getProfessionalNome(registro.professional_id) : null
      const { blob, filename } = await buildAnamnesePdf({ clinic, paciente, registro, profissionalNome })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      setMsg('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerandoPdf(false)
    }
  }

  function onChange(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const rec = await saveAnamnesis({
        id: recordId,
        patientId,
        clinicId,
        professionalId,
        preenchidoPor,
        values,
        consentir: withConsent ? consentir : undefined,
      })
      setRecordId(rec.id)
      setSalvoSnapshot(JSON.stringify(values))
      setMsg('Anamnese salva com sucesso.')
    } catch (e) {
      setMsg('Não foi possível salvar: ' + ((e as Error)?.message || 'verifique a conexão e tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="text-sm text-texto/50">Carregando anamnese…</p>

  return (
    <div className="space-y-5">
      <DynamicForm schema={anamnesisSchema} values={values} onChange={onChange} />

      {withConsent && (
        <label className="flex items-start gap-2 rounded-xl border border-black/5 bg-white p-4 text-sm text-texto/80">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consentir}
            onChange={(e) => setConsentir(e.target.checked)}
          />
          <span>{DECLARACAO_VERACIDADE}</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando || (withConsent && !consentir)}
          className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar anamnese'}
        </button>
        <button
          onClick={baixarPdf}
          disabled={gerandoPdf || !recordId}
          title={!recordId ? 'Salve a anamnese para gerar o PDF' : alterado ? 'Salve as alterações antes de gerar o PDF' : 'Baixar a ficha de anamnese em PDF'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primaria/40 px-4 py-2.5 text-sm font-semibold text-primaria transition hover:bg-primaria/5 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          {gerandoPdf ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
      {!recordId && <p className="text-xs text-texto/45">O PDF fica disponível depois que a anamnese for salva.</p>}
    </div>
  )
}
