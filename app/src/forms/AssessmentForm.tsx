import { useEffect, useState } from 'react'
import DynamicForm from './DynamicForm'
import { assessmentSchemas } from './assessmentSchemas'
import type { FormValues } from './types'
import {
  getLatestAssessment,
  saveAssessment,
  type AssessmentType,
} from '@/lib/assessments'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
  tipo: AssessmentType
}

export default function AssessmentForm({ patientId, clinicId, professionalId, tipo }: Props) {
  const [values, setValues] = useState<FormValues>({})
  const [recordId, setRecordId] = useState<string | undefined>()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setCarregando(true)
    getLatestAssessment(patientId, tipo)
      .then((rec) => {
        setRecordId(rec?.id)
        setValues(rec?.dados ?? {})
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [patientId, tipo])

  function onChange(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const rec = await saveAssessment({ id: recordId, patientId, clinicId, professionalId, tipo, values })
      setRecordId(rec.id)
      setMsg('Avaliação salva.')
    } catch {
      setMsg('Não foi possível salvar. Verifique a conexão.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="text-sm text-texto/50">Carregando avaliação…</p>

  return (
    <div className="space-y-5">
      <DynamicForm schema={assessmentSchemas[tipo]} values={values} onChange={onChange} />
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar avaliação'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}
