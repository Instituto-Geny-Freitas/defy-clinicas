import { useState } from 'react'
import { dismissRecurrence, updateRecurrence, PERIOD_LABEL, type Periodicidade, type RecurrenceRec } from '@/lib/recurrence'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

/** Edita uma recorrência já registrada: periodicidade, antecedência, data-limite; encerrar/reativar. */
export default function RecurrenceEditModal({ rec, onClose, onSaved }: { rec: RecurrenceRec; onClose: () => void; onSaved: () => void }) {
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(rec.periodicidade)
  const [antecedencia, setAntecedencia] = useState(String(rec.dias_antecedencia))
  const [dataLimite, setDataLimite] = useState(rec.data_limite ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await updateRecurrence(rec.id, {
        periodicidade,
        diasAntecedencia: Number(antecedencia) || 0,
        dataLimite: dataLimite || null,
        dataBase: rec.data_base,
        status: 'ativa',
      })
      onSaved()
    } catch { setSalvando(false) }
  }
  async function encerrar() {
    if (!confirm('Encerrar esta recorrência? Ela deixa de gerar alertas.')) return
    setSalvando(true)
    try { await dismissRecurrence(rec.id); onSaved() } catch { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-[56] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-texto">Recorrência · {rec.descricao}</h3>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Periodicidade</label>
            <select className={field} value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
              {(Object.keys(PERIOD_LABEL) as Periodicidade[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Alertar com antecedência (dias)</label>
            <input type="number" min={0} max={365} className={field} value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Alertar até (data-limite)</label>
            <input type="date" className={field} value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
            <p className="mt-0.5 text-[11px] text-texto/40">Em branco = sem limite (permanente). Após esta data o sistema para de alertar.</p>
          </div>
          {rec.status === 'encerrada' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Esta recorrência está encerrada — salvar irá reativá-la.</p>}
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={encerrar} disabled={salvando || rec.status === 'encerrada'} className="rounded-lg px-3 py-2 text-sm font-medium text-secundaria hover:bg-secundaria/5 disabled:opacity-40">Encerrar</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
