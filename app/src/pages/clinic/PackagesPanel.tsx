import { useEffect, useState } from 'react'
import {
  addPackageSession, createPackage, deletePackage, deletePackageSession,
  listPackageItems, listPackageItemsForPackages, listPackageSessions, listPackages,
  listPackageRealizacoes, packageItemsRealizadas, savePackageItems, updatePackage,
  type PackageItem, type PackageItemInput, type PackageRealizacao, type PackageSession, type TreatmentPackage,
} from '@/lib/packages'
import { currentProcedurePrices, listActiveIngredients, listProcedureTypes } from '@/lib/domains'
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
  const [itensPorPacote, setItensPorPacote] = useState<Record<string, PackageItem[]>>({})
  const [realizadas, setRealizadas] = useState<Record<string, number>>({})
  const [realizPorPacote, setRealizPorPacote] = useState<Record<string, PackageRealizacao[]>>({})

  function recarregar() {
    listPackages(patientId).then((ps) => {
      setPacotes(ps)
      listPackageItemsForPackages(ps.map((p) => p.id)).then((its) => {
        const grp: Record<string, PackageItem[]> = {}
        for (const it of its) (grp[it.package_id] ??= []).push(it)
        setItensPorPacote(grp)
        packageItemsRealizadas(its.map((i) => i.id)).then(setRealizadas).catch(() => {})
      }).catch(() => {})
      // Realizados (com data) por pacote — para listar no card.
      Promise.all(ps.map((p) => listPackageRealizacoes(p.id).then((rs) => [p.id, rs] as const).catch(() => [p.id, []] as const)))
        .then((pairs) => setRealizPorPacote(Object.fromEntries(pairs)))
        .catch(() => {})
    }).catch(() => {}).finally(() => setCarregando(false))
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
            const valorTotal = Number(p.valor_total)
            const valorUtilizado = p.sessoes_compradas > 0 ? Math.round((valorTotal * feitas / p.sessoes_compradas) * 100) / 100 : 0
            const valorRestante = Math.max(0, valorTotal - valorUtilizado)
            const items = itensPorPacote[p.id] ?? []
            const temItens = items.length > 0
            return (
              <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-medium text-texto">
                      {p.procedimento}
                      {temItens && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-texto/50">{p.tipo === 'suplementacao' ? 'Suplementações' : 'Procedimentos'}</span>}
                    </div>
                    <div className="text-xs text-texto/50">{formatDateBR(p.data)}{Number(p.valor_total) > 0 && ` · ${brl(Number(p.valor_total))}`}{Number(p.desconto) > 0 && ` · desc. ${brl(Number(p.desconto))}`}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button onClick={() => setEditando(p)} className="font-medium text-texto/60 hover:underline">Editar</button>
                    <button onClick={() => excluir(p)} className="font-medium text-secundaria hover:underline">Excluir</button>
                  </div>
                </div>

                {temItens ? (
                  <div className="mt-3">
                    <div className="mb-1 text-sm text-texto/70">{p.sessoes_compradas} sessões por item</div>
                    <div className="space-y-1">
                      {items.map((it) => {
                        const f = realizadas[it.id] ?? 0
                        const done = f >= p.sessoes_compradas
                        return (
                          <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-texto/70">{it.nome}</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{f}/{p.sessoes_compradas}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-texto/40">As sessões são baixadas ao registrar {p.tipo === 'suplementacao' ? 'suplementações' : 'procedimentos'} vinculados a este pacote.</p>
                    {(realizPorPacote[p.id] ?? []).length > 0 && (
                      <div className="mt-2 border-t border-black/5 pt-2">
                        <div className="mb-1 text-[11px] font-medium text-texto/50">Sessões realizadas</div>
                        <ul className="space-y-0.5">
                          {(realizPorPacote[p.id] ?? []).map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-x-2 text-xs text-texto/70">
                              <span>{formatDateBR(r.data)}</span>
                              <span className="text-texto/40">·</span>
                              <span className="text-texto/80">{r.item_nome || r.nome}</span>
                              {r.profissional && <><span className="text-texto/40">·</span><span>{r.profissional}</span></>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
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
                      {valorTotal > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto/60">
                          <span>Total: <strong className="text-texto">{brl(valorTotal)}</strong></span>
                          <span>Utilizado: <strong className="text-texto/80">{brl(valorUtilizado)}</strong> ({feitas}×)</span>
                          <span>Restante: <strong className={concluido ? 'text-emerald-600' : 'text-primaria'}>{brl(valorRestante)}</strong></span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => registrarSessao(p)} className="rounded-lg bg-primaria px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">+ Registrar sessão</button>
                    </div>
                  </>
                )}

                {p.observacoes && <div className="mt-2 text-sm text-texto/70">{p.observacoes}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface CatOpt { id: string; nome: string; preco: number }
interface PkgItemDraft { id?: string; refId: string; nome: string; preco_unit: number }

function PacoteModal({ clinicId, patientId, professionalId, pacote, onClose, onSaved }: {
  clinicId: string; patientId: string; professionalId?: string | null; pacote: TreatmentPackage | null; onClose: () => void; onSaved: () => void
}) {
  const editar = !!pacote
  const [tipo, setTipo] = useState<'procedimento' | 'suplementacao'>(pacote?.tipo ?? 'procedimento')
  const [procOpts, setProcOpts] = useState<CatOpt[]>([])
  const [suplOpts, setSuplOpts] = useState<CatOpt[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [items, setItems] = useState<PkgItemDraft[]>([])
  const [sessoes, setSessoes] = useState(String(pacote?.sessoes_compradas ?? 10))
  const [descTipo, setDescTipo] = useState<'valor' | 'pct'>('valor')
  const [descInput, setDescInput] = useState(pacote && Number(pacote.desconto) > 0 ? String(Number(pacote.desconto).toFixed(2)).replace('.', ',') : '')
  const [quoteId, setQuoteId] = useState(pacote?.quote_id ?? '')
  const [obs, setObs] = useState(pacote?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([listProcedureTypes(), currentProcedurePrices(), listActiveIngredients()]).then(([tipos, precos, ativos]) => {
      setProcOpts(tipos.map((t) => ({ id: t.id, nome: t.nome, preco: precos[t.id]?.valor ?? 0 })))
      setSuplOpts(ativos.map((a) => ({ id: a.id, nome: a.nome, preco: Number(a.preco_venda) || 0 })))
    }).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
    if (pacote) listPackageItems(pacote.id).then((its) => {
      if (its.length > 0) setItems(its.map((i) => ({ id: i.id, refId: (pacote.tipo === 'procedimento' ? i.procedure_type_id : i.active_ingredient_id) ?? '', nome: i.nome, preco_unit: Number(i.preco_unit) })))
      else if (pacote.procedimento) { // legado (mono): pré-carrega 1 item
        const nn = pacote.sessoes_compradas || 1
        setItems([{ refId: pacote.procedure_type_id ?? '', nome: pacote.procedimento, preco_unit: nn > 0 ? Math.round((Number(pacote.valor_total) / nn) * 100) / 100 : Number(pacote.valor_total) }])
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const n = Number(sessoes.replace(',', '.')) || 0
  const opts = tipo === 'procedimento' ? procOpts : suplOpts
  const subtotal = items.reduce((s, it) => s + (it.preco_unit || 0), 0) * n
  const descValor = descTipo === 'pct'
    ? Math.round(subtotal * (Number(descInput.replace(',', '.')) || 0) / 100 * 100) / 100
    : (Number(descInput.replace(',', '.')) || 0)
  const total = Math.max(0, subtotal - descValor)
  const itensValidos = items.filter((i) => i.refId && i.nome)
  const podeSalvar = itensValidos.length > 0 && n > 0

  function mudarTipo(t: 'procedimento' | 'suplementacao') { setTipo(t); setItems([]) }
  function addItem() { setItems((a) => [...a, { refId: '', nome: '', preco_unit: 0 }]) }
  function escolherRef(i: number, refId: string) { const o = opts.find((x) => x.id === refId); setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, refId, nome: o?.nome ?? '', preco_unit: o?.preco ?? 0 } : it))) }
  function removeItem(i: number) { setItems((arr) => arr.filter((_, idx) => idx !== i)) }

  async function salvar() {
    if (!podeSalvar) { setErro('Escolha o tipo, ao menos um item e as sessões.'); return }
    setErro(''); setSalvando(true)
    try {
      const nome0 = itensValidos[0].nome + (itensValidos.length > 1 ? ` +${itensValidos.length - 1}` : '')
      const pkgId = pacote
        ? (await updatePackage(pacote.id, { procedimento: nome0, tipo, procedure_type_id: null, sessoes_compradas: n, valor_total: total, desconto: descValor, quote_id: quoteId || null, observacoes: obs || null }), pacote.id)
        : await createPackage({ clinicId, patientId, professionalId, procedimento: nome0, tipo, sessoesCompradas: n, valorTotal: total, desconto: descValor, quoteId: quoteId || null, observacoes: obs || null, data: localDateToday() })
      await savePackageItems(clinicId, pkgId, itensValidos.map<PackageItemInput>((i) => ({
        id: i.id,
        procedure_type_id: tipo === 'procedimento' ? i.refId : null,
        active_ingredient_id: tipo === 'suplementacao' ? i.refId : null,
        nome: i.nome, preco_unit: i.preco_unit,
      })))
      onSaved()
    } catch (e) { setErro((e as Error)?.message ?? 'Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <Shell titulo={editar ? 'Editar pacote' : 'Novo pacote de sessões'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Tipo do pacote *</label>
          <div className="flex gap-2">
            {(['procedimento', 'suplementacao'] as const).map((t) => (
              <button key={t} type="button" onClick={() => mudarTipo(t)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${tipo === t ? 'border-primaria bg-primaria/10 text-primaria' : 'border-black/10 text-texto/60'}`}>
                {t === 'procedimento' ? 'Procedimentos' : 'Suplementações'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-texto/40">Um pacote é só de procedimentos OU só de suplementações.</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-texto/70">Itens do pacote *</label>
            <button type="button" onClick={addItem} className="text-xs font-medium text-primaria hover:underline">+ Adicionar item</button>
          </div>
          {items.length === 0 && <p className="text-xs text-texto/40">Adicione {tipo === 'procedimento' ? 'procedimentos' : 'suplementações (ativos)'} — o preço vem do cadastro.</p>}
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className={field} value={it.refId} onChange={(e) => escolherRef(i, e.target.value)}>
                  <option value="">{tipo === 'procedimento' ? 'Procedimento…' : 'Ativo…'}</option>
                  {opts.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco > 0 ? ` · ${brl(o.preco)}` : ''}</option>)}
                </select>
                <button type="button" onClick={() => removeItem(i)} className="px-1 text-texto/40 hover:text-secundaria">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Sessões compradas *</label>
            <input type="number" min={1} className={field} value={sessoes} onChange={(e) => setSessoes(e.target.value)} />
            <p className="mt-0.5 text-[11px] text-texto/40">Cada item é realizado esta qtde de vezes.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Desconto</label>
            <div className="flex gap-1">
              <input className={field} inputMode="decimal" value={descInput} onChange={(e) => setDescInput(e.target.value)} placeholder="0" />
              <select className="rounded-lg border border-black/10 px-2 text-sm" value={descTipo} onChange={(e) => setDescTipo(e.target.value as 'valor' | 'pct')}>
                <option value="valor">R$</option>
                <option value="pct">%</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm">
          <div className="flex justify-between text-texto/60"><span>Subtotal ({itensValidos.length} item(ns) × {n} sessões)</span><span>{brl(subtotal)}</span></div>
          {descValor > 0 && <div className="flex justify-between text-texto/60"><span>Desconto</span><span>− {brl(descValor)}</span></div>}
          <div className="mt-1 flex justify-between text-base font-semibold text-texto"><span>Total do pacote</span><span>{brl(total)}</span></div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-texto/70">Vincular a orçamento (opcional)</label>
          <select className={field} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
            <option value="">— Sem vínculo —</option>
            {orcamentos.map((q) => <option key={q.id} value={q.id}>{q.numero ?? new Date(q.created_at).toLocaleDateString('pt-BR')} · {brl(Number(q.valor_total))}</option>)}
          </select>
          <p className="mt-1 text-xs text-texto/50">A cobrança é feita no Financeiro (orçamento). Aqui é o registro do pacote.</p>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        {erro && <p className="text-sm text-secundaria">{erro}</p>}
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
