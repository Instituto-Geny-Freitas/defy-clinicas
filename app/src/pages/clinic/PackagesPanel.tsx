import { useEffect, useState } from 'react'
import {
  addPackageSession, createPackage, deletePackage, deletePackageSession,
  listPackageSessions, listPackages, updatePackage,
  type PackageSession, type TreatmentPackage,
} from '@/lib/packages'
import { listProcedureTypes, type ProcedureType } from '@/lib/domains'
import { listQuotes, brl, type Quote } from '@/lib/finance'
import { formatDateBR, localDateToday } from '@/lib/format'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function PackagesPanel({ patientId, clinicId, professionalId }: Props) {
  const [pacotes, setPacotes] = useState<TreatmentPackage[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<TreatmentPackage | null>(null)
  const [verSessoes, setVerSessoes] = useState<TreatmentPackage | null>(null)

  function recarregar() {
    listPackages(patientId).then(setPacotes).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function registrarSessao(p: TreatmentPackage) {
    const restantes = p.sessoes_compradas - (p.realizadas ?? 0)
    if (restantes <= 0 && !confirm('Este pacote já teve todas as sessões realizadas. Registrar assim mesmo (sessão extra)?')) return
    await addPackageSession({ clinicId, packageId: p.id, professionalId, data: localDateToday() })
    recarregar()
  }
  async function excluir(p: TreatmentPackage) {
    if (!confirm(`Remover o pacote "${p.procedimento}"? O histórico de sessões é preservado.`)) return
    await deletePackage(p.id)
    recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Pacotes de sessões</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo pacote</button>
      </div>

      {modal && <PacoteModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} pacote={null} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {editando && <PacoteModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} pacote={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />}
      {verSessoes && <SessoesModal pacote={verSessoes} onClose={() => setVerSessoes(null)} onChanged={recarregar} />}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : pacotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum pacote cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {pacotes.map((p) => {
            const feitas = p.realizadas ?? 0
            const restantes = Math.max(0, p.sessoes_compradas - feitas)
            const pct = p.sessoes_compradas > 0 ? Math.min(100, Math.round((feitas / p.sessoes_compradas) * 100)) : 0
            const concluido = restantes === 0
            return (
              <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-texto">{p.procedimento}</div>
                    <div className="text-xs text-texto/50">{formatDateBR(p.data)}{Number(p.valor_total) > 0 && ` · ${brl(Number(p.valor_total))}`}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button onClick={() => setEditando(p)} className="font-medium text-texto/60 hover:underline">Editar</button>
                    <button onClick={() => excluir(p)} className="font-medium text-secundaria hover:underline">Excluir</button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={concluido ? 'font-medium text-emerald-600' : 'text-texto/70'}>
                      {feitas} de {p.sessoes_compradas} sessões realizadas · <strong>{restantes} restante{restantes === 1 ? '' : 's'}</strong>
                    </span>
                    <button onClick={() => setVerSessoes(p)} className="text-xs font-medium text-primaria hover:underline">Ver sessões</button>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5">
                    <div className={`h-full rounded-full ${concluido ? 'bg-emerald-500' : 'bg-primaria'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {p.observacoes && <div className="mt-2 text-sm text-texto/70">{p.observacoes}</div>}

                <div className="mt-3 flex justify-end">
                  <button onClick={() => registrarSessao(p)} className="rounded-lg bg-primaria px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    + Registrar sessão
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PacoteModal({ clinicId, patientId, professionalId, pacote, onClose, onSaved }: {
  clinicId: string; patientId: string; professionalId?: string | null; pacote: TreatmentPackage | null; onClose: () => void; onSaved: () => void
}) {
  const editar = !!pacote
  const [tipos, setTipos] = useState<ProcedureType[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [tipoId, setTipoId] = useState(pacote?.procedure_type_id ?? '')
  const [procedimento, setProcedimento] = useState(pacote?.procedimento ?? '')
  const [outro, setOutro] = useState(false)
  const [sessoes, setSessoes] = useState(String(pacote?.sessoes_compradas ?? 10))
  const [valor, setValor] = useState(pacote && Number(pacote.valor_total) > 0 ? String(Number(pacote.valor_total).toFixed(2)).replace('.', ',') : '')
  const [quoteId, setQuoteId] = useState(pacote?.quote_id ?? '')
  const [obs, setObs] = useState(pacote?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listProcedureTypes().then(setTipos).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
  }, [patientId])

  function escolherTipo(v: string) {
    if (v === '__outro__') { setOutro(true); setTipoId(''); setProcedimento(''); return }
    setOutro(false); setTipoId(v)
    const t = tipos.find((x) => x.id === v)
    if (t) setProcedimento(t.nome)
  }

  const n = Number(sessoes.replace(',', '.')) || 0
  const podeSalvar = procedimento.trim().length > 0 && n > 0

  async function salvar() {
    if (!podeSalvar) return
    setSalvando(true)
    try {
      const valorTotal = Number(valor.replace(/\./g, '').replace(',', '.')) || 0
      if (pacote) {
        await updatePackage(pacote.id, { procedimento, procedure_type_id: tipoId || null, sessoes_compradas: n, valor_total: valorTotal, quote_id: quoteId || null, observacoes: obs || null })
      } else {
        await createPackage({ clinicId, patientId, professionalId, procedureTypeId: tipoId || null, procedimento, sessoesCompradas: n, valorTotal, quoteId: quoteId || null, observacoes: obs || null, data: localDateToday() })
      }
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo={editar ? 'Editar pacote' : 'Novo pacote de sessões'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Procedimento *</label>
          <select className={field} value={outro ? '__outro__' : tipoId} onChange={(e) => escolherTipo(e.target.value)}>
            <option value="">{editar ? procedimento || 'Selecione…' : 'Selecione…'}</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            <option value="__outro__">Outro (digitar)…</option>
          </select>
          {(outro || editar) && (
            <input className={`${field} mt-2`} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Descreva o procedimento" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Sessões compradas *</label><input type="number" min={1} className={field} value={sessoes} onChange={(e) => setSessoes(e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Valor total (R$)</label>
            <input className={field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Vincular a orçamento (opcional)</label>
          <select className={field} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
            <option value="">— Sem vínculo —</option>
            {orcamentos.map((q) => <option key={q.id} value={q.id}>{q.numero ?? new Date(q.created_at).toLocaleDateString('pt-BR')} · {brl(Number(q.valor_total))}</option>)}
          </select>
          <p className="mt-1 text-xs text-texto/50">A cobrança é feita no Financeiro (orçamento). Aqui é só o registro do pacote.</p>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || !podeSalvar} label={salvando ? 'Salvando…' : 'Salvar'} />
      </div>
    </Shell>
  )
}

function SessoesModal({ pacote, onClose, onChanged }: { pacote: TreatmentPackage; onClose: () => void; onChanged: () => void }) {
  const [sessoes, setSessoes] = useState<PackageSession[]>([])
  const [carregando, setCarregando] = useState(true)

  function recarregar() { listPackageSessions(pacote.id).then(setSessoes).catch(() => {}).finally(() => setCarregando(false)) }
  useEffect(recarregar, [pacote.id])

  async function excluir(s: PackageSession) {
    if (!confirm('Excluir esta sessão realizada? A contagem será ajustada.')) return
    await deletePackageSession(s.id)
    recarregar(); onChanged()
  }

  return (
    <Shell titulo={`Sessões · ${pacote.procedimento}`} onClose={onClose}>
      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : sessoes.length === 0 ? (
        <p className="text-sm text-texto/50">Nenhuma sessão registrada ainda.</p>
      ) : (
        <div className="space-y-1">
          {sessoes.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm">
              <span className="text-texto/80">Sessão {i + 1} · {formatDateBR(s.data)}{s.observacoes ? ` · ${s.observacoes}` : ''}</span>
              <button onClick={() => excluir(s)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
