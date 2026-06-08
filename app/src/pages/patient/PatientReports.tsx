import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listProcedures } from '@/lib/procedures'
import { listPrescriptions } from '@/lib/formulations'
import { listMeasurements } from '@/lib/measurements'
import { listSupplementations } from '@/lib/supplementations'
import { buildPatientReportPdf, type ReportData } from '@/lib/reportPdf'
import {
  deletePatientReport,
  getReportUsage,
  listPatientReports,
  savePatientReport,
  type PatientReport,
} from '@/lib/patientReports'

const SECOES = [
  { key: 'procedimentos', label: 'Procedimentos' },
  { key: 'manipulacoes', label: 'Manipulações' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'suplementacoes', label: 'Suplementações' },
] as const

const noPeriodo = (data: string | null, ini?: string, fim?: string) => {
  if (!data) return true
  const dia = data.slice(0, 10)
  if (ini && dia < ini) return false
  if (fim && dia > fim) return false
  return true
}

export default function PatientReports() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const patient = profile?.patient
  const [sel, setSel] = useState<Set<string>>(new Set(['procedimentos', 'medidas']))
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [gerando, setGerando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [reports, setReports] = useState<PatientReport[]>([])
  const [uso, setUso] = useState<{ count: number; limite: number }>({ count: 0, limite: 10 })

  function recarregar() {
    if (!patient) return
    listPatientReports(patient.id).then(setReports).catch(() => {})
    getReportUsage(patient.id).then(setUso).catch(() => {})
  }
  useEffect(recarregar, [patient?.id])

  function toggle(k: string) {
    setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  async function gerar() {
    if (!patient || sel.size === 0) { setMsg('Selecione ao menos uma seção.'); return }
    if (uso.count >= uso.limite) { setMsg(`Limite de relatórios atingido (${uso.limite}). Exclua um antigo ou peça ampliação à clínica.`); return }
    setGerando(true); setMsg(null)
    try {
      const [procs, presc, med, supl] = await Promise.all([
        sel.has('procedimentos') ? listProcedures(patient.id) : Promise.resolve([]),
        sel.has('manipulacoes') ? listPrescriptions(patient.id) : Promise.resolve([]),
        sel.has('medidas') ? listMeasurements(patient.id) : Promise.resolve([]),
        sel.has('suplementacoes') ? listSupplementations(patient.id) : Promise.resolve([]),
      ])
      const data: ReportData = {
        procedimentos: procs.filter((p) => noPeriodo(p.data, ini, fim)),
        manipulacoes: presc.filter((p) => noPeriodo(p.data, ini, fim)),
        medidas: med.filter((m) => noPeriodo(m.data, ini, fim)),
        suplementacoes: supl.filter((s) => noPeriodo(s.data, ini, fim)),
      }
      const { blob, filename } = buildPatientReportPdf({
        clinic, pacienteNome: patient.nome, periodoInicio: ini || null, periodoFim: fim || null, data,
      })
      // download imediato
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
      // armazena no perfil (limite imposto por trigger)
      await savePatientReport({
        clinicId: patient.clinic_id, patientId: patient.id,
        titulo: `Relatório ${SECOES.filter((s) => sel.has(s.key)).map((s) => s.label).join(', ')}`,
        secoes: [...sel], periodoInicio: ini || null, periodoFim: fim || null, blob,
      })
      setMsg('Relatório gerado e salvo no seu perfil.')
      recarregar()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
    } finally {
      setGerando(false)
    }
  }

  async function remover(r: PatientReport) {
    if (!confirm('Excluir este relatório?')) return
    await deletePatientReport(r)
    recarregar()
  }

  const atingiu = uso.count >= uso.limite

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Meus Relatórios</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Selecione o que incluir e gere um PDF da sua jornada.</p>

      <div className="rounded-xl border border-black/5 bg-white p-4">
        <div className="mb-2 text-sm font-medium text-texto/80">Seções</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {SECOES.map((s) => (
            <label key={s.key} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={sel.has(s.key)} onChange={() => toggle(s.key)} /> {s.label}
            </label>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">De</label><input type="date" className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Até</label><input type="date" className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={`text-xs ${atingiu ? 'text-secundaria' : 'text-texto/50'}`}>Usados {uso.count} de {uso.limite}</span>
          <button onClick={gerar} disabled={gerando || atingiu} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {gerando ? 'Gerando…' : 'Gerar PDF'}
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-texto/70">{msg}</p>}
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-texto/70">Relatórios gerados</h2>
      {reports.length === 0 ? (
        <p className="text-sm text-texto/40">Nenhum relatório ainda.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
              <div>
                <div className="text-sm text-texto">{r.titulo ?? 'Relatório'}</div>
                <div className="text-xs text-texto/50">{new Date(r.created_at).toLocaleString('pt-BR')}</div>
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
