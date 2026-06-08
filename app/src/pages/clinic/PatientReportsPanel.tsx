import { useEffect, useState } from 'react'
import {
  deletePatientReport,
  getReportUsage,
  listPatientReports,
  type PatientReport,
} from '@/lib/patientReports'

export default function PatientReportsPanel({ patientId }: { patientId: string }) {
  const [reports, setReports] = useState<PatientReport[]>([])
  const [uso, setUso] = useState<{ count: number; limite: number }>({ count: 0, limite: 10 })
  const [carregando, setCarregando] = useState(true)

  function recarregar() {
    Promise.all([listPatientReports(patientId), getReportUsage(patientId)])
      .then(([r, u]) => { setReports(r); setUso(u) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function remover(r: PatientReport) {
    if (!confirm('Excluir este relatório?')) return
    await deletePatientReport(r)
    recarregar()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Relatórios do paciente</h3>
        <span className="text-xs text-texto/50">Usados {uso.count} de {uso.limite} (limite em Editar)</span>
      </div>
      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhum relatório gerado pelo paciente.
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
              <div>
                <div className="text-sm text-texto">{r.titulo ?? 'Relatório'}</div>
                <div className="text-xs text-texto/50">
                  {new Date(r.created_at).toLocaleString('pt-BR')} · gerado por {r.gerado_por}
                  {(r.periodo_inicio || r.periodo_fim) && ` · período ${r.periodo_inicio ?? '…'}–${r.periodo_fim ?? '…'}`}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {r.signedUrl && <a href={r.signedUrl} target="_blank" rel="noreferrer" className="font-medium text-primaria hover:underline">Abrir</a>}
                <button onClick={() => remover(r)} className="text-secundaria hover:underline">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
