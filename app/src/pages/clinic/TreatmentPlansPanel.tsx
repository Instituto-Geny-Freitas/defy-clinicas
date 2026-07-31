import { useEffect, useState } from 'react'
import {
  createTreatmentPlan,
  deleteTreatmentPlan,
  listPlanItems,
  listPlanItemsForPlans,
  listSnippets,
  listTreatmentPlans,
  markPlanConsentByStaff,
  planItemsRealizadas,
  savePlanItems,
  sendTreatmentPlan,
  suggestPlanIA,
  updateTreatmentPlan,
  type PlanItem,
  type PlanItemInput,
  type PlanStatus,
  type TextSnippet,
  type TreatmentPlan,
} from '@/lib/treatmentPlans'
import { brl, listQuotes, type Quote } from '@/lib/finance'
import { currentAtivoSalePrices, currentProcedurePrices, listActiveIngredients, listProcedureTypes } from '@/lib/domains'
import { formatDateBR } from '@/lib/format'
import { useAuth } from '@/auth/AuthProvider'
import { getClinic, type ClinicFull } from '@/lib/settings'
import { getPatient } from '@/lib/patients'
import type { Patient } from '@/lib/types'
import { buildPlanoPdf } from '@/lib/planoPdf'

interface CatalogoOpt { id: string; nome: string; preco: number }
interface ItemDraft { id?: string; tipo: 'procedimento' | 'suplementacao'; refId: string; nome: string; preco_unit: number; sessoes: number; frequencia: string }

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
// Opções de frequência dos itens do plano (texto livre armazenado; lista para facilitar a escolha).
const FREQ_OPCOES = ['Sessão única', 'Semanal', '2x por semana', 'Quinzenal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']

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
  const [itensPorPlano, setItensPorPlano] = useState<Record<string, PlanItem[]>>({})
  const [realizadas, setRealizadas] = useState<Record<string, number>>({})
  const { profile } = useAuth()
  const [clinic, setClinic] = useState<ClinicFull | null>(null)
  const [paciente, setPaciente] = useState<Patient | null>(null)

  useEffect(() => {
    getClinic().then(setClinic).catch(() => {})
    getPatient(patientId).then(setPaciente).catch(() => {})
  }, [patientId])

  function gerarPdf(p: TreatmentPlan, modo: 'download' | 'imprimir') {
    buildPlanoPdf({ clinic, paciente, profissional: profile?.professional, plano: p, itens: itensPorPlano[p.id] ?? [] }, modo)
  }

  function recarregar() {
    listTreatmentPlans(patientId).then((ps) => {
      setPlanos(ps)
      listPlanItemsForPlans(ps.map((p) => p.id)).then((its) => {
        const grp: Record<string, PlanItem[]> = {}
        for (const it of its) (grp[it.treatment_plan_id] ??= []).push(it)
        setItensPorPlano(grp)
        planItemsRealizadas(its.map((i) => i.id)).then(setRealizadas).catch(() => {})
      }).catch(() => {})
    }).catch(() => {}).finally(() => setCarregando(false))
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
                  <button onClick={() => gerarPdf(p, 'download')} className="text-xs font-medium text-texto/60 hover:underline">PDF</button>
                  <button onClick={() => gerarPdf(p, 'imprimir')} className="text-xs font-medium text-texto/60 hover:underline">Imprimir</button>
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
              {(itensPorPlano[p.id]?.length ?? 0) > 0 && (
                <div className="mt-2 rounded-lg bg-black/[0.02] p-2">
                  <div className="mb-1 text-[11px] font-medium text-texto/60">Itens do plano · total {brl((itensPorPlano[p.id] ?? []).reduce((s, it) => s + Number(it.preco_unit) * it.sessoes, 0))}</div>
                  <div className="space-y-0.5">
                    {(itensPorPlano[p.id] ?? []).map((it) => {
                      const feitas = realizadas[it.id] ?? 0
                      const done = feitas >= it.sessoes
                      return (
                        <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate text-texto/70">{it.nome}{it.frequencia ? ` · ${it.frequencia}` : ''}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{feitas}/{it.sessoes} sessões</span>
                          <span className="shrink-0 text-texto/50">{brl(Number(it.preco_unit) * it.sessoes)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
  const [snippets, setSnippets] = useState<TextSnippet[]>([])
  const [salvando, setSalvando] = useState(false)
  const [iaInstrucao, setIaInstrucao] = useState('')
  const [iaCarregando, setIaCarregando] = useState(false)
  const [iaErro, setIaErro] = useState<string | null>(null)
  const [procOpts, setProcOpts] = useState<CatalogoOpt[]>([])
  const [suplOpts, setSuplOpts] = useState<CatalogoOpt[]>([])
  const [items, setItems] = useState<ItemDraft[]>([])
  const [erroItens, setErroItens] = useState<string | null>(null)

  useEffect(() => { listSnippets('plano').then(setSnippets).catch(() => {}) }, [])
  useEffect(() => {
    Promise.all([listProcedureTypes(), currentProcedurePrices(), listActiveIngredients(), currentAtivoSalePrices()])
      .then(([tipos, precos, ativos, precosAtivo]) => {
        setProcOpts(tipos.map((t) => ({ id: t.id, nome: t.nome, preco: precos[t.id]?.valor ?? 0 })))
        setSuplOpts(ativos.map((a) => ({ id: a.id, nome: a.nome, preco: precosAtivo[a.id] || Number(a.preco_venda) || 0 })))
      }).catch(() => {})
    if (plano) listPlanItems(plano.id).then((its) => setItems(its.map((i) => ({
      id: i.id, tipo: i.tipo, refId: (i.tipo === 'procedimento' ? i.procedure_type_id : i.active_ingredient_id) ?? '',
      nome: i.nome, preco_unit: Number(i.preco_unit), sessoes: i.sessoes, frequencia: i.frequencia ?? '',
    })))).catch(() => {})
  }, [])

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

  function addProc() { setItems((a) => [...a, { tipo: 'procedimento', refId: '', nome: '', preco_unit: 0, sessoes: 1, frequencia: '' }]) }
  function addSupl() { setItems((a) => [...a, { tipo: 'suplementacao', refId: '', nome: '', preco_unit: 0, sessoes: 1, frequencia: '' }]) }
  function setItemField(i: number, patch: Partial<ItemDraft>) { setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it))) }
  function escolherRef(i: number, refId: string, tipo: 'procedimento' | 'suplementacao') {
    const opt = (tipo === 'procedimento' ? procOpts : suplOpts).find((o) => o.id === refId)
    setItemField(i, { refId, nome: opt?.nome ?? '', preco_unit: opt?.preco ?? 0 })
  }
  function removeItem(i: number) { setItems((arr) => arr.filter((_, idx) => idx !== i)) }
  const totalItens = items.reduce((s, it) => s + (it.preco_unit || 0) * (it.sessoes || 0), 0)

  async function salvar() {
    const itensValidos = items.filter((i) => i.refId)
    if (!texto.trim() && itensValidos.length === 0) { setErroItens('Preencha o Conteúdo do plano ou adicione ao menos um item.'); return }
    if (itensValidos.some((i) => !(i.sessoes > 0))) { setErroItens('Informe as sessões (maior que zero) de cada item.'); return }
    setSalvando(true); setErroItens(null)
    const dados = { titulo: titulo || null, texto }
    try {
      const planId = editando && plano
        ? (await updateTreatmentPlan(plano.id, dados), plano.id)
        : (await createTreatmentPlan({ clinicId, patientId, professionalId, ...dados, texto })).id
      await savePlanItems(clinicId, planId, itensValidos.map<PlanItemInput>((i) => ({
        id: i.id, tipo: i.tipo,
        procedure_type_id: i.tipo === 'procedimento' ? i.refId : null,
        active_ingredient_id: i.tipo === 'suplementacao' ? i.refId : null,
        nome: i.nome, preco_unit: i.preco_unit, sessoes: i.sessoes, frequencia: i.frequencia || null,
      })))
      onSaved()
    } catch (e) { setErroItens((e as Error)?.message ?? 'Não foi possível salvar.'); setSalvando(false) }
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
        <div><label className="mb-1 block text-sm text-texto/70">Conteúdo</label><textarea rows={6} className={field} value={texto} onChange={(e) => setTexto(e.target.value)} /><p className="mt-0.5 text-[11px] text-texto/40">Preencha o conteúdo do plano ou adicione ao menos um item abaixo.</p></div>

        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-texto/80">Itens do plano (procedimentos / suplementações)</label>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={addProc} className="font-medium text-primaria hover:underline">+ Procedimento</button>
              <button type="button" onClick={addSupl} className="font-medium text-primaria hover:underline">+ Suplementação</button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-texto/40">Opcional. Cada item tem preço (do cadastro), sessões e frequência próprias.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border border-black/5 bg-white p-2">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${it.tipo === 'procedimento' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>{it.tipo === 'procedimento' ? 'Proc.' : 'Supl.'}</span>
                    <select className="min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={it.refId} onChange={(e) => escolherRef(i, e.target.value, it.tipo)}>
                      <option value="">{it.tipo === 'procedimento' ? 'Selecione o procedimento…' : 'Selecione o ativo…'}</option>
                      {(it.tipo === 'procedimento' ? procOpts : suplOpts).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco > 0 ? ` · ${brl(o.preco)}` : ''}</option>)}
                    </select>
                    <button type="button" onClick={() => removeItem(i)} className="px-1 text-texto/40 hover:text-secundaria">✕</button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto/60">
                    <label className="flex items-center gap-1">Sessões <input type="number" min={1} className="w-16 rounded border border-black/10 px-1.5 py-1" value={it.sessoes} onChange={(e) => setItemField(i, { sessoes: Number(e.target.value) })} /></label>
                    <label className="flex items-center gap-1">Freq.
                      <select className="w-32 rounded border border-black/10 px-1.5 py-1" value={it.frequencia} onChange={(e) => setItemField(i, { frequencia: e.target.value })}>
                        <option value="">— Frequência —</option>
                        {FREQ_OPCOES.map((f) => <option key={f} value={f}>{f}</option>)}
                        {it.frequencia && !FREQ_OPCOES.includes(it.frequencia) && <option value={it.frequencia}>{it.frequencia}</option>}
                      </select>
                    </label>
                    <span className="ml-auto font-medium text-texto/70">{brl((it.preco_unit || 0) * (it.sessoes || 0))}</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm font-semibold text-texto">Total dos itens: {brl(totalItens)}</div>
            </div>
          )}
          {erroItens && <p className="mt-1 text-xs text-secundaria">{erroItens}</p>}
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
