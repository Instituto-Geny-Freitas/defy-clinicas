import { useEffect, useState } from 'react'
import { createMeasurement, listMeasurements, type BodyMeasurement, type MeasurementInput } from '@/lib/measurements'
import { Shell, Footer } from './TreatmentPlansPanel'
import LineChart from '@/components/LineChart'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function MeasurementsPanel({ patientId, clinicId, professionalId }: Props) {
  const [itens, setItens] = useState<BodyMeasurement[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    listMeasurements(patientId).then(setItens).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  const pontosPeso = itens.filter((m) => m.peso_kg != null).map((m) => ({ rotulo: `${m.sessao ?? ''}`, valor: Number(m.peso_kg) }))
  const pontosGordura = itens.filter((m) => m.gordura_corporal_pct != null).map((m) => ({ rotulo: `${m.sessao ?? ''}`, valor: Number(m.gordura_corporal_pct) }))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Medidas corporais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova medição</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} proximaSessao={itens.length + 1} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}

      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma medição registrada.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pontosPeso.length > 1 && <LineChart titulo="Peso (kg) por sessão" pontos={pontosPeso} sufixo="" />}
            {pontosGordura.length > 1 && <LineChart titulo="Gordura corporal (%) por sessão" pontos={pontosGordura} sufixo="%" />}
          </div>
          <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-left text-texto/60">
                <tr>
                  <th className="px-3 py-2 font-medium">Sessão</th><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Peso</th><th className="px-3 py-2 font-medium">IMC</th>
                  <th className="px-3 py-2 font-medium">Gord.%</th><th className="px-3 py-2 font-medium">Músc.%</th><th className="px-3 py-2 font-medium">Visceral</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((m) => (
                  <tr key={m.id} className="border-t border-black/5">
                    <td className="px-3 py-2 text-texto">{m.sessao ?? '—'}</td>
                    <td className="px-3 py-2 text-texto/60">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-2 text-texto/70">{m.peso_kg ?? '—'}</td>
                    <td className="px-3 py-2 text-texto/70">{m.imc ?? '—'}</td>
                    <td className="px-3 py-2 text-texto/70">{m.gordura_corporal_pct ?? '—'}</td>
                    <td className="px-3 py-2 text-texto/70">{m.musculo_pct ?? '—'}</td>
                    <td className="px-3 py-2 text-texto/70">{m.gordura_visceral ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, proximaSessao, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; proximaSessao: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<MeasurementInput>({ data: new Date().toISOString().slice(0, 10), sessao: proximaSessao })
  const [salvando, setSalvando] = useState(false)
  const num = (k: keyof MeasurementInput) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value === '' ? null : Number(e.target.value) }))

  async function salvar() {
    setSalvando(true)
    try { await createMeasurement(clinicId, patientId, professionalId, f); onSaved() } catch { setSalvando(false) }
  }

  return (
    <Shell titulo="Nova medição" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><label className="mb-1 block text-sm text-texto/70">Sessão</label><input type="number" className={field} value={f.sessao ?? ''} onChange={num('sessao')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={f.data} onChange={(e) => setF((s) => ({ ...s, data: e.target.value }))} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Peso (kg)</label><input type="number" step="0.1" className={field} value={f.peso_kg ?? ''} onChange={num('peso_kg')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">IMC</label><input type="number" step="0.1" className={field} value={f.imc ?? ''} onChange={num('imc')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Gordura %</label><input type="number" step="0.1" className={field} value={f.gordura_corporal_pct ?? ''} onChange={num('gordura_corporal_pct')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Músculo %</label><input type="number" step="0.1" className={field} value={f.musculo_pct ?? ''} onChange={num('musculo_pct')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">RM</label><input type="number" step="0.1" className={field} value={f.rm ?? ''} onChange={num('rm')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Kcal</label><input type="number" className={field} value={f.kcal ?? ''} onChange={num('kcal')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Idade corporal</label><input type="number" className={field} value={f.idade_corporal ?? ''} onChange={num('idade_corporal')} /></div>
        <div><label className="mb-1 block text-sm text-texto/70">Gord. visceral</label><input type="number" step="0.1" className={field} value={f.gordura_visceral ?? ''} onChange={num('gordura_visceral')} /></div>
      </div>
      <div className="mt-4"><Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Salvar medição'} /></div>
    </Shell>
  )
}
