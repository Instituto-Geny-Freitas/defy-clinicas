import { useEffect, useState } from 'react'
import {
  createTreatmentPlan,
  deleteTreatmentPlan,
  listSnippets,
  listTreatmentPlans,
  markPlanConsentByStaff,
  sendTreatmentPlan,
  suggestPlanIA,
  updateTreatmentPlan,
  type PlanStatus,
  type TextSnippet,
  type TreatmentPlan,
} from '@/lib/treatmentPlans'
import { brl, listQuotes, type Quote } from '@/lib/finance'
import { formatDateBR } from '@/lib/format'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

const PLAN_STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-black/10 text-texto/60' },
  pendente: { label: 'Aguardando ciência', cls: 'bg-amber-100 text-amber-700' },
  consentido: { label: 'Consentido', cls: 'bg-emerald-100 text-emerald-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' },
}
function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const s = PLAN_STATUS[status] ?? PLAN_STATUS.rascunho
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export default function TreatmentPlansPanel({ patientId, clinicId, professionalId }: Props) {
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<TreatmentPlan | 'novo' | null>(null)

  function recarregar() {
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {}).finally(() => setCarregando(false))
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
  }
  useEffect(recarregar, [patientId])

  // Valor do plano = soma dos orçamentos vinculados a ele.
  const valorDoPlano = (planId: string) =>
    orcamentos.filter((q) => q.treatment_plan_id === planId).reduce((s, q) => s + Number(q.valor_total), 0)

  async function enviar(p: TreatmentPlan) {
    if (!confirm('Enviar este plano ao paciente para dar ciência no portal?')) return
    await sendTreatmentPlan(p.id); recarregar()
  }
  async function consentirManual(p: TreatmentPlan) {
    if (!confirm('Registrar que o paciente consentiu este plano (ex.: presencialmente)? Fica marcado como consentido pela equipe.')) return
    await markPlanConsentByStaff(p.id); recarregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Planos de tratamento</h3>
        <button onClick={() => setEditando('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo plano</button>
      </div>
      {editando && (
        <Modal
          clinicId={clinicId} patientId={patientId} professionalId={professionalId}
          plano={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar() }}
        />
      )}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : planos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum plano de tratamento.</p>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-texto">{p.titulo || 'Plano de tratamento'}</span>
                  <PlanStatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
                  <button onClick={() => setEditando(p)} className="text-xs font-medium text-primaria hover:underline">Editar</button>
                  <button onClick={async () => { if (confirm('Excluir este plano?')) { await deleteTreatmentPlan(p.id); recarregar() } }} className="text-xs text-secundaria hover:underline">Excluir</button>
                </div>
              </div>
              {p.texto && <p className="mt-1 whitespace-pre-wrap text-sm text-texto/70">{p.texto}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-texto/50">
                {p.num_sessoes != null && <span>{p.num_sessoes} sessões</span>}
                {p.frequencia && <span>{p.frequencia}</span>}
                {valorDoPlano(p.id) > 0
                  ? <span className="font-medium text-texto/70">Orçamento: {brl(valorDoPlano(p.id))}</span>
                  : <span className="text-texto/40">Aguardando orçamento</span>}
              </div>
              {/* Envio ao paciente e ciência (espelha os Documentos) */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/5 pt-2 text-xs">
                {p.status === 'rascunho' && (
                  <button onClick={() => enviar(p)} className="rounded-lg bg-primaria px-3 py-1.5 font-semibold text-white hover:opacity-90">Enviar ao paciente</button>
                )}
                {p.status === 'pendente' && (
                  <>
                    <span className="text-amber-700">Enviado{p.enviado_em ? ` em ${new Date(p.enviado_em).toLocaleDateString('pt-BR')}` : ''} · aguardando ciência no portal</span>
                    <button onClick={() => consentirManual(p)} className="rounded-lg border border-primaria px-3 py-1.5 font-semibold text-primaria hover:bg-primaria/5">Registrar consentimento</button>
                    <button onClick={() => enviar(p)} className="text-texto/50 hover:underline">Reenviar</button>
                  </>
                )}
                {p.status === 'consentido' && (
                  <span className="text-emerald-700">
                    Consentido{p.consentido_em ? ` em ${new Date(p.consentido_em).toLocaleString('pt-BR')}` : ''}
                    {p.consentido_via === 'staff' ? ' (registrado pela equipe)' : p.consentido_via === 'portal' ? ' (pelo paciente no portal)' : ''}
                    {p.assinatura_hash && <span className="ml-1 break-all text-[10px] text-emerald-700/70">· autenticação {p.assinatura_hash.slice(0, 16)}…</span>}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, plano, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; plano?: TreatmentPlan | null; onClose: () => void; onSaved: () => void }) {
  const editando = !!plano
  const [titulo, setTitulo] = useState(plano?.titulo ?? '')
  const [texto, setTexto] = useState(plano?.texto ?? '')
  const [sessoes, setSessoes] = useState(plano?.num_sessoes != null ? String(plano.num_sessoes) : '')
  const [freq, setFreq] = useState(plano?.frequencia ?? '')
  const [snippets, setSnippets] = useState<TextSnippet[]>([])
  const [salvando, setSalvando] = useState(false)
  const [iaInstrucao, setIaInstrucao] = useState('')
  const [iaCarregando, setIaCarregando] = useState(false)
  const [iaErro, setIaErro] = useState<string | null>(null)

  useEffect(() => { listSnippets('plano').then(setSnippets).catch(() => {}) }, [])

  function inserirSnippet(id: string) {
    const s = snippets.find((x) => x.id === id)
    if (s) setTexto((t) => (t ? t + '\n' : '') + s.conteudo)
  }

  async function sugerirIA() {
    setIaCarregando(true)
    setIaErro(null)
    try {
      const sugestao = await suggestPlanIA(patientId, iaInstrucao || undefined)
      setTexto((t) => (t ? t + '\n\n' : '') + sugestao)
    } catch (e) {
      setIaErro(e instanceof Error ? e.message : 'Não foi possível gerar a sugestão.')
    } finally {
      setIaCarregando(false)
    }
  }

  async function salvar() {
    if (!texto.trim()) return
    setSalvando(true)
    const dados = {
      titulo: titulo || null, texto,
      num_sessoes: sessoes ? Number(sessoes) : null, frequencia: freq || null,
    }
    try {
      if (editando && plano) await updateTreatmentPlan(plano.id, dados)
      else await createTreatmentPlan({ clinicId, patientId, professionalId, ...dados, texto })
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo={editando ? 'Editar plano de tratamento' : 'Novo plano de tratamento'} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="mb-1 block text-sm text-texto/70">Título</label><input className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        {snippets.length > 0 && (
          <div>
            <label className="mb-1 block text-sm text-texto/70">Inserir texto-padrão</label>
            <select className={field} value="" onChange={(e) => { inserirSnippet(e.target.value); e.target.value = '' }}>
              <option value="">Selecione um modelo…</option>
              {snippets.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
          </div>
        )}
        <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
          <label className="mb-1 block text-sm font-medium text-texto/80">✨ Sugerir com IA</label>
          <div className="flex gap-2">
            <input className={field} placeholder="Instrução opcional (ex.: foco em flacidez abdominal)" value={iaInstrucao} onChange={(e) => setIaInstrucao(e.target.value)} />
            <button type="button" onClick={sugerirIA} disabled={iaCarregando} className="shrink-0 rounded-lg bg-primaria px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {iaCarregando ? 'Gerando…' : 'Sugerir'}
            </button>
          </div>
          {iaErro && <p className="mt-1 text-xs text-secundaria">{iaErro}</p>}
          <p className="mt-1 text-xs text-texto/50">Usa anamnese e última avaliação do paciente. Revise antes de salvar.</p>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Conteúdo *</label><textarea rows={6} className={field} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="mb-1 block text-sm text-texto/70">Sessões</label><input type="number" className={field} value={sessoes} onChange={(e) => setSessoes(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Frequência</label><input className={field} value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
        </div>
        <p className="text-xs text-texto/50">O valor é definido depois, pela geração do orçamento vinculado a este plano (aba Financeiro).</p>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Salvar plano'} />
      </div>
    </Shell>
  )
}

export function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Footer({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{label}</button>
    </div>
  )
}
