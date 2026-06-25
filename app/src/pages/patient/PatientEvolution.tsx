import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { listPhotos, type ClinicalPhoto } from '@/lib/photos'
import { listMeasurements, type BodyMeasurement } from '@/lib/measurements'
import { listLabOrders, listLabResults, uploadLabResult, type LabOrder, type LabResult } from '@/lib/labs'
import { formatDateBR } from '@/lib/format'
import LineChart from '@/components/LineChart'

export default function PatientEvolution() {
  const { profile } = useAuth()
  const patient = profile?.patient
  const patientId = patient?.id
  const [fotos, setFotos] = useState<ClinicalPhoto[]>([])
  const [medidas, setMedidas] = useState<BodyMeasurement[]>([])
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function recarregar() {
    if (!patientId) return
    Promise.all([listPhotos(patientId), listMeasurements(patientId), listLabOrders(patientId), listLabResults(patientId)])
      .then(([f, m, o, r]) => { setFotos(f.filter((x) => x.visivel_paciente)); setMedidas(m); setOrders(o); setResults(r) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !patient) return
    setEnviando(true)
    try {
      await uploadLabResult({ patientId: patient.id, clinicId: patient.clinic_id, file })
      recarregar()
    } catch { /* silencioso */ } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const pontosPeso = medidas.filter((m) => m.peso_kg != null).map((m) => ({ rotulo: `${m.sessao ?? ''}`, valor: Number(m.peso_kg) }))

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-texto">Minha Evolução</h1>

      {/* Medidas */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-texto/70">Medidas</h2>
        {pontosPeso.length > 1 ? <LineChart titulo="Peso (kg) por sessão" pontos={pontosPeso} /> : <p className="text-sm text-texto/40">Ainda sem medições suficientes para o gráfico.</p>}
      </section>

      {/* Exames */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-texto/70">Exames</h2>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
          <button onClick={() => inputRef.current?.click()} disabled={enviando} className="rounded-lg bg-primaria px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar resultado'}
          </button>
        </div>
        {orders.length > 0 && (
          <div className="mb-2 space-y-1">
            {orders.map((o) => (
              <div key={o.id} className="rounded-lg border border-black/5 bg-white p-3 text-xs text-texto/70">
                Requisição de {formatDateBR(o.data)}: {o.exames.slice(0, 6).join(', ')}{o.exames.length > 6 ? '…' : ''}
              </div>
            ))}
          </div>
        )}
        {results.length === 0 ? (
          <p className="text-sm text-texto/40">Nenhum resultado enviado.</p>
        ) : (
          <div className="space-y-1">
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/5 bg-white p-3 text-sm">
                <span className="text-texto/70">Resultado · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                {r.signedUrl && <a href={r.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primaria hover:underline">Abrir</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fotos */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-texto/70">Fotos</h2>
        {fotos.length === 0 ? (
          <p className="text-sm text-texto/40">Ainda não há fotos disponíveis.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {fotos.map((f) => (
              <div key={f.id} className="overflow-hidden rounded-xl border border-black/5 bg-white">
                {f.signedUrl && <img src={f.signedUrl} alt={f.categoria} className="aspect-square w-full object-cover" />}
                <div className="p-2 text-[11px] text-texto/60"><span className="font-medium capitalize text-texto">{f.categoria}</span>{' · '}{new Date(f.capturada_em).toLocaleDateString('pt-BR')}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
