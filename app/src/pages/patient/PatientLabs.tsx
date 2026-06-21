import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  deleteLabResult,
  listLabOrders,
  listLabResults,
  uploadLabResult,
  type LabOrder,
  type LabResult,
} from '@/lib/labs'
import { formatDateBR } from '@/lib/format'

export default function PatientLabs() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const clinicId = profile?.patient?.clinic_id
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function recarregar() {
    if (!patientId) return
    Promise.all([listLabOrders(patientId), listLabResults(patientId)])
      .then(([o, r]) => { setOrders(o); setResults(r) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !patientId || !clinicId) return
    setEnviando(true)
    try {
      await uploadLabResult({ patientId, clinicId, file })
      recarregar()
    } catch (err) { alert('Não foi possível enviar o resultado: ' + ((err as Error)?.message ?? 'erro')) } finally {
      setEnviando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remover(r: LabResult) {
    if (!confirm('Remover este resultado?')) return
    await deleteLabResult(r)
    recarregar()
  }

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Meus Exames</h1>
        <p className="mt-1 text-sm text-texto/60">Veja os exames solicitados e envie os resultados.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-texto/70">Solicitados pela clínica</h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-4 text-center text-sm text-texto/50">Nenhuma requisição.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="mb-1 text-xs text-texto/50">{formatDateBR(o.data)} · {o.exames.length} exames</div>
                <div className="flex flex-wrap gap-1.5">
                  {o.exames.map((e, i) => <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/70">{e}</span>)}
                </div>
                {o.observacoes && <p className="mt-2 text-xs text-texto/50">Obs.: {o.observacoes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-texto/70">Resultados</h2>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={onArquivo} />
          <button onClick={() => fileRef.current?.click()} disabled={enviando}
            className="rounded-lg border border-primaria px-3 py-1.5 text-xs font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50">
            {enviando ? 'Enviando…' : '+ Enviar resultado'}
          </button>
        </div>
        {results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-4 text-center text-sm text-texto/50">Nenhum resultado anexado ainda.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
                <span className="text-sm text-texto/70">Resultado · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                <div className="flex items-center gap-3">
                  {r.signedUrl && <a href={r.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primaria hover:underline">Abrir</a>}
                  <button onClick={() => remover(r)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
