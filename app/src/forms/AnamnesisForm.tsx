import { useEffect, useState } from 'react'
import DynamicForm from './DynamicForm'
import { anamnesisSchema } from './anamnesisSchema'
import type { FormValues } from './types'
import { getLatestAnamnesis, saveAnamnesis } from '@/lib/anamnesis'

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
  const [values, setValues] = useState<FormValues>(prefill ?? {})
  const [recordId, setRecordId] = useState<string | undefined>()
  const [consentir, setConsentir] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    getLatestAnamnesis(patientId)
      .then((rec) => {
        if (rec) {
          setRecordId(rec.id)
          setValues({ ...(prefill ?? {}), ...rec.dados })
          setConsentir(Boolean(rec.consentimento_em))
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

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
          <span>
            Declaro que todas as informações acima são verdadeiras e me comprometo a informar
            qualquer alteração no meu estado de saúde, gravidez ou uso de novas medicações durante o
            tratamento.
          </span>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando || (withConsent && !consentir)}
          className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar anamnese'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}
