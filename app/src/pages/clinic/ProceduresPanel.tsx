import { useEffect, useState } from 'react'
import { localDateToday } from '@/lib/format'
import { createProcedure, deleteProcedure, listProcedures, updateProcedure, VINCULO_HELP, type ProcedureRecord, type UsedProduct } from '@/lib/procedures'
import { listInventory, listInventoryLots, type InventoryItem, type InventoryLot } from '@/lib/inventory'
import { listQuotes, listPaymentsByPatient, totalLiquidado, createQuote, brl, type Quote, type Payment, type QuoteItem } from '@/lib/finance'
import { supabase } from '@/lib/supabase'
import { listTreatmentPlans, listPlanItemsComSaldo, getPlanItem, type TreatmentPlan, type PlanItem } from '@/lib/treatmentPlans'
import { listPackages, listPackageItemsComSaldo, getPackageItem, type TreatmentPackage, type PackageItem } from '@/lib/packages'
import { PacoteModal } from './PackagesPanel'
import { getClinic, listProfessionals, type ClinicFull } from '@/lib/settings'
import type { Professional } from '@/lib/types'
import { getPatient } from '@/lib/patients'
import { buildProcedimentoPdf, profissionalPdf } from '@/lib/atendimentoPdf'
import PdfAcoes from '@/components/PdfAcoes'
import { listProcedureTypes, currentProcedurePrices, type ProcedureType } from '@/lib/domains'
import { listPhotos, type ClinicalPhoto } from '@/lib/photos'
import SnippetPicker from '@/components/SnippetPicker'
import { createRecurrence, listRecurrences, PERIOD_LABEL, type Periodicidade, type RecurrenceRec } from '@/lib/recurrence'
import RecurrenceEditModal from '@/components/RecurrenceEditModal'
import { formatDateBR, parseMoneyBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
}

export default function ProceduresPanel({ patientId, clinicId, professionalId }: Props) {
  const [procs, setProcs] = useState<ProcedureRecord[]>([])
  const [pagas, setPagas] = useState<Set<string>>(new Set())
  const [fotosPorProc, setFotosPorProc] = useState<Map<string, ClinicalPhoto[]>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<ProcedureRecord | null>(null)
  const [recorrencias, setRecorrencias] = useState<RecurrenceRec[]>([])
  // Dados do cabeçalho/assinatura dos PDFs de atendimento.
  const [clinicFull, setClinicFull] = useState<ClinicFull | null>(null)
  const [profs, setProfs] = useState<Professional[]>([])
  const [paciente, setPaciente] = useState<Awaited<ReturnType<typeof getPatient>>>(null)
  const [editRec, setEditRec] = useState<RecurrenceRec | null>(null)

  function recarregar() {
    listProcedures(patientId).then(setProcs).catch(() => {}).finally(() => setCarregando(false))
    listRecurrences(patientId).then(setRecorrencias).catch(() => {})
    getClinic().then(setClinicFull).catch(() => {})
    listProfessionals().then(setProfs).catch(() => {})
    getPatient(patientId).then(setPaciente).catch(() => {})
    // Orçamentos quitados do paciente → marca os procedimentos vinculados como pagos.
    supabase.from('v_quote_balances').select('quote_id, saldo_a_receber').eq('patient_id', patientId)
      .then(({ data }) => setPagas(new Set((data ?? []).filter((b) => Number(b.saldo_a_receber) <= 0.005).map((b) => b.quote_id as string))))
    // Fotos ligadas a cada procedimento (evolução por procedimento).
    listPhotos(patientId).then((fotos) => {
      const map = new Map<string, ClinicalPhoto[]>()
      for (const f of fotos) if (f.procedure_id) { const arr = map.get(f.procedure_id) ?? []; arr.push(f); map.set(f.procedure_id, arr) }
      setFotosPorProc(map)
    }).catch(() => {})
  }
  useEffect(recarregar, [patientId])

  async function excluir(p: ProcedureRecord) {
    if (!confirm(`Excluir o procedimento "${p.procedimento}"? Os produtos utilizados retornam ao estoque.`)) return
    await deleteProcedure(clinicId, p)
    recarregar()
  }

  const recPorProc = new Map(
    recorrencias.filter((r) => r.tipo === 'procedimento' && r.status === 'ativa' && r.procedure_id).map((r) => [r.procedure_id as string, r]),
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Procedimentos realizados</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Registrar procedimento
        </button>
      </div>

      {modal && (
        <RegistrarModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} proc={null}
          onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}
      {editando && (
        <RegistrarModal clinicId={clinicId} patientId={patientId} professionalId={professionalId} proc={editando}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />
      )}
      {editRec && <RecurrenceEditModal rec={editRec} onClose={() => setEditRec(null)} onSaved={() => { setEditRec(null); recarregar() }} />}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : procs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum procedimento registrado.</p>
      ) : (
        <div className="space-y-2">
          {procs.map((p) => {
            const pago = !!p.quote_id && pagas.has(p.quote_id)
            return (
            <div key={p.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-texto">{p.procedimento}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
                  <PdfAcoes
                    clinicId={clinicId} patientId={patientId} professionalId={p.professional_id ?? professionalId}
                    categoria="procedimento" compacto
                    montar={() => buildProcedimentoPdf({
                      clinic: clinicFull, paciente,
                      profissional: profissionalPdf(profs.find((x) => x.id === (p.professional_id ?? professionalId)) ?? null),
                      proc: p,
                    })}
                  />
                  <button onClick={() => setEditando(p)} className="text-xs font-medium text-primaria hover:underline">Editar</button>
                  <button onClick={() => excluir(p)} className="text-xs font-medium text-secundaria hover:underline">Excluir</button>
                </div>
              </div>
              {p.regiao && <div className="text-sm text-texto/60">Região: {p.regiao}</div>}
              {p.observacoes && <div className="mt-1 text-sm text-texto/70">{p.observacoes}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {!p.quote_id && Number(p.valor_cobrado) > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Avulso · {brl(Number(p.valor_cobrado))}</span>
                )}
                {p.quote_id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Vinculado a orçamento</span>}
                {pago && <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-medium text-white">✓ Pago</span>}
              </div>
              {(() => { const r = recPorProc.get(p.id); return r ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">🔁 {PERIOD_LABEL[r.periodicidade]}{r.data_limite ? ` até ${formatDateBR(r.data_limite)}` : ''}</span>
                  <button onClick={() => setEditRec(r)} className="font-medium text-primaria hover:underline">Editar recorrência</button>
                </div>
              ) : null })()}
              {p.produtos_usados?.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-xs font-medium text-texto/60">Produtos utilizados (baixa de estoque){pago && <span className="ml-1 text-emerald-600">· pagos</span>}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.produtos_usados.map((u, i) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${pago ? 'bg-emerald-50 text-emerald-700' : 'bg-black/5 text-texto/70'}`}>
                        {u.produto} ×{u.qtd}
                        {u.lote && <span className="opacity-70"> · lote {u.lote}</span>}
                        {u.validade && <span className="opacity-70"> · val {formatDateBR(u.validade)}</span>}
                        {Number(u.preco_venda) > 0 && ` · ${brl(Number(u.preco_venda) * u.qtd)}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(fotosPorProc.get(p.id)?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-xs font-medium text-texto/60">Fotos ({fotosPorProc.get(p.id)!.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {fotosPorProc.get(p.id)!.map((f) => (
                      f.signedUrl && (
                        <a key={f.id} href={f.signedUrl} target="_blank" rel="noreferrer" title={`${f.categoria}${f.regiao ? ` · ${f.regiao}` : ''} · ${formatDateBR(f.capturada_em)}`}>
                          <img src={f.signedUrl} alt={f.categoria} className="h-16 w-16 rounded-lg border border-black/5 object-cover" />
                        </a>
                      )
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-texto/40">Vincule fotos a este procedimento na aba Fotos.</p>
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

function RegistrarModal({
  clinicId, patientId, professionalId, proc, onClose, onSaved,
}: {
  clinicId: string
  patientId: string
  professionalId?: string | null
  proc: ProcedureRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const editar = !!proc
  const [estoque, setEstoque] = useState<InventoryItem[]>([])
  const [lotes, setLotes] = useState<InventoryLot[]>([])
  const [orcamentos, setOrcamentos] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [tipos, setTipos] = useState<ProcedureType[]>([])
  const [precos, setPrecos] = useState<Record<string, { valor: number; vigencia_inicio: string }>>({})
  const [planoId, setPlanoId] = useState('')
  const [quoteId, setQuoteId] = useState(proc?.quote_id ?? '')
  const [planItens, setPlanItens] = useState<(PlanItem & { saldo: number; realizadas: number })[]>([])
  const [planItemId, setPlanItemId] = useState(proc?.treatment_plan_item_id ?? '')
  const [pacotes, setPacotes] = useState<TreatmentPackage[]>([])
  const [pacoteId, setPacoteId] = useState('')
  const [pkgItens, setPkgItens] = useState<(PackageItem & { saldo: number; realizadas: number })[]>([])
  const [packageItemId, setPackageItemId] = useState(proc?.treatment_package_item_id ?? '')
  const [procSelect, setProcSelect] = useState('')
  const [procedimento, setProcedimento] = useState(proc?.procedimento ?? '')
  const [data, setData] = useState(proc?.data ? proc.data.slice(0, 10) : localDateToday())
  const [regiao, setRegiao] = useState(proc?.regiao ?? '')
  const [obs, setObs] = useState(proc?.observacoes ?? '')
  const [valorCobrado, setValorCobrado] = useState(proc && Number(proc.valor_cobrado) > 0 ? String(Number(proc.valor_cobrado).toFixed(2)).replace('.', ',') : '')
  const [produtos, setProdutos] = useState<UsedProduct[]>(proc?.produtos_usados ?? [])
  const [filtroLote, setFiltroLote] = useState('')
  const [recPeriodo, setRecPeriodo] = useState<'' | Periodicidade>('')
  const [recAntecedencia, setRecAntecedencia] = useState('7')
  const [recLimite, setRecLimite] = useState('')
  const [novoPacote, setNovoPacote] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Fase 7: produtos usados x orçamento/pacote pago → propor orçamento complementar (rascunho).
  const [produtosPrevistos, setProdutosPrevistos] = useState(true)
  const [proporProdutos, setProporProdutos] = useState<UsedProduct[] | null>(null)
  const [criandoComplementar, setCriandoComplementar] = useState(false)

  useEffect(() => {
    listInventory().then(setEstoque).catch(() => {})
    listInventoryLots().then(setLotes).catch(() => {})
    listProcedureTypes().then(setTipos).catch(() => {})
    currentProcedurePrices().then(setPrecos).catch(() => {})
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {})
    listQuotes(patientId).then(setOrcamentos).catch(() => {})
    listPaymentsByPatient(patientId).then(setPagamentos).catch(() => {})
    listPackages(patientId).then((ps) => setPacotes(ps.filter((p) => p.tipo === 'procedimento'))).catch(() => {})
  }, [patientId])

  // Ao editar um procedimento já vinculado, mostra o plano do orçamento vinculado (quando os orçamentos carregam).
  useEffect(() => {
    if (quoteId && !planoId) {
      const q = orcamentos.find((x) => x.id === quoteId)
      if (q?.treatment_plan_id) setPlanoId(q.treatment_plan_id)
    }
  }, [orcamentos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao editar um procedimento que consome item de plano/pacote, pré-seleciona o plano/pacote do item.
  useEffect(() => {
    if (proc?.treatment_plan_item_id) getPlanItem(proc.treatment_plan_item_id).then((it) => { if (it) setPlanoId(it.treatment_plan_id) }).catch(() => {})
    if (proc?.treatment_package_item_id) getPackageItem(proc.treatment_package_item_id).then((it) => { if (it) setPacoteId(it.package_id) }).catch(() => {})
  }, [])

  // Itens (procedimento) do plano selecionado, com saldo de sessões.
  useEffect(() => {
    if (!planoId) { setPlanItens([]); return }
    listPlanItemsComSaldo(planoId).then((its) => {
      const procItems = its.filter((i) => i.tipo === 'procedimento')
      setPlanItens(procItems)
      setPlanItemId((cur) => (cur && procItems.some((i) => i.id === cur) ? cur : ''))
    }).catch(() => {})
  }, [planoId])

  // Itens do pacote selecionado, com saldo (sessoes_compradas − realizadas).
  useEffect(() => {
    if (!pacoteId) { setPkgItens([]); return }
    const pkg = pacotes.find((p) => p.id === pacoteId)
    if (!pkg) return
    listPackageItemsComSaldo(pacoteId, pkg.sessoes_compradas).then((its) => {
      setPkgItens(its)
      setPackageItemId((cur) => (cur && its.some((i) => i.id === cur) ? cur : ''))
    }).catch(() => {})
  }, [pacoteId, pacotes])

  const orcamentosDoPlano = planoId ? orcamentos.filter((q) => q.treatment_plan_id === planoId) : orcamentos
  // Avulso = sem nenhum vínculo (orçamento, item de plano ou item de pacote). Só então há valor a cobrar e recorrência.
  const avulso = !quoteId && !planItemId && !packageItemId

  // Preço vigente (Fase 1) do tipo de procedimento pelo nome selecionado.
  const precoVigenteDoNome = (nome: string): number => {
    const tipo = tipos.find((t) => t.nome === nome)
    return tipo ? Number(precos[tipo.id]?.valor ?? 0) : 0
  }
  const fmtMoedaBR = (v: number) => String(v.toFixed(2)).replace('.', ',')

  // Fase 7: orçamento vinculado (direto ou via pacote) e se já está pago (liquidado pelo paciente).
  const pacoteVinc = pacotes.find((p) => p.id === pacoteId) ?? null
  const orcVinculadoId = quoteId || pacoteVinc?.quote_id || ''
  const orcVinculado = orcamentos.find((q) => q.id === orcVinculadoId) ?? null
  const orcPago = !!orcVinculado && totalLiquidado(pagamentos, orcVinculado.id) >= Number(orcVinculado.valor_total) - 0.005
  const produtosComValor = produtos.filter((p) => p.inventory_id && Number(p.preco_venda) > 0)
  const totalProdutosComValor = produtosComValor.reduce((s, p) => s + Number(p.preco_venda) * p.qtd, 0)
  // Só perguntamos/propomos quando há produtos cobráveis e o orçamento vinculado já está pago.
  const podeProporComplementar = orcPago && produtosComValor.length > 0

  const nomeProduto = (invId: string) => estoque.find((i) => i.id === invId)?.produto ?? ''
  const lotesComSaldo = lotes.filter((l) => Number(l.qtd_atual) > 0)
  const rotuloLote = (l: InventoryLot) =>
    `${nomeProduto(l.inventory_id)} · ${l.lote || 's/ lote'}${l.validade ? ` · val ${formatDateBR(l.validade)}` : ''} · ${l.qtd_atual} un${Number(l.preco_venda) > 0 ? ` · ${brl(Number(l.preco_venda))}` : ''}`
  // Filtro textual por nome do produto, lote ou validade (facilita achar em listas grandes).
  const matchFiltro = (l: InventoryLot) => {
    const t = filtroLote.trim().toLowerCase()
    if (!t) return true
    return `${nomeProduto(l.inventory_id)} ${l.lote ?? ''} ${l.validade ? formatDateBR(l.validade) : ''}`.toLowerCase().includes(t)
  }
  const saldoLote = (lotId?: string | null) => (lotId ? Number(lotes.find((l) => l.id === lotId)?.qtd_atual ?? 0) : 0)
  const totalProdutos = produtos.reduce((s, p) => s + Number(p.preco_venda || 0) * p.qtd, 0)

  function addProduto() { setProdutos((p) => [...p, { inventory_id: '', produto: '', qtd: 1 }]) }
  function setProdutoLote(idx: number, lot: InventoryLot | null, qtd: number) {
    setProdutos((arr) => arr.map((p, i) => i === idx
      ? (lot
        ? { inventory_id: lot.inventory_id, produto: nomeProduto(lot.inventory_id), lot_id: lot.id, marca: lot.marca, lote: lot.lote, validade: lot.validade, qtd, preco_venda: lot.preco_venda }
        : { inventory_id: '', produto: '', qtd })
      : p))
  }
  function removeProduto(idx: number) { setProdutos((arr) => arr.filter((_, i) => i !== idx)) }

  async function salvar() {
    setErro(null)
    if (!procedimento.trim()) { setErro('Informe o procedimento.'); return }
    if (!data) { setErro('Informe a data.'); return }
    const prods = produtos.filter((p) => p.inventory_id)
    // Bloqueia registrar baixa acima do saldo do lote (procedimento novo).
    if (!editar) {
      const semSaldo = prods.find((p) => p.lot_id && p.qtd > saldoLote(p.lot_id))
      if (semSaldo) { setErro(`"${semSaldo.produto}" tem quantidade (${semSaldo.qtd}) acima do saldo do lote (${saldoLote(semSaldo.lot_id)}).`); return }
    }
    if (planItemId && !editar) {
      const it = planItens.find((i) => i.id === planItemId)
      if (it && it.saldo <= 0) { setErro(`O item "${it.nome}" do plano está esgotado (${it.realizadas}/${it.sessoes} sessões). Crie um novo orçamento (avulso) para este procedimento.`); return }
    }
    if (packageItemId && !editar) {
      const it = pkgItens.find((i) => i.id === packageItemId)
      if (it && it.saldo <= 0) { setErro(`O item "${it.nome}" do pacote está esgotado. Crie um novo orçamento (avulso) para este procedimento.`); return }
    }
    setSalvando(true)
    try {
      const valor = avulso ? parseMoneyBR(valorCobrado) : 0
      if (proc) {
        await updateProcedure({
          clinicId, anterior: proc, procedimento, data,
          regiao, observacoes: obs, valorCobrado: valor, produtos: prods, quoteId: quoteId || null, treatmentPlanItemId: planItemId || null, treatmentPackageItemId: packageItemId || null,
        })
      } else {
        const novo = await createProcedure({
          clinicId, patientId, professionalId, quoteId: quoteId || null, treatmentPlanItemId: planItemId || null, treatmentPackageItemId: packageItemId || null, procedimento,
          data, regiao, observacoes: obs,
          valorCobrado: valor, produtos: prods,
        })
        if (recPeriodo && avulso) {
          await createRecurrence({
            clinicId, patientId, professionalId, tipo: 'procedimento', procedureId: novo.id,
            descricao: procedimento, periodicidade: recPeriodo, diasAntecedencia: Number(recAntecedencia) || 7, dataBase: data, dataLimite: recLimite || null,
          }).catch(() => {})
        }
      }
      // Fase 7: produtos não previstos em orçamento/pacote já pago → propõe orçamento complementar (rascunho).
      if (podeProporComplementar && !produtosPrevistos) {
        setProporProdutos(produtosComValor)
        setSalvando(false)
        return
      }
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar o procedimento.'); setSalvando(false) }
  }

  // Fase 7: cria o orçamento complementar (rascunho) com os produtos não previstos, para a equipe revisar/enviar.
  async function criarComplementar() {
    if (!proporProdutos) return
    setCriandoComplementar(true)
    try {
      const itensComplementar: QuoteItem[] = proporProdutos.map((u) => {
        const qtd = Number(u.qtd) || 1
        const pv = Number(u.preco_venda) || 0
        const det = [u.lote ? `lote ${u.lote}` : '', u.validade ? `val ${formatDateBR(u.validade)}` : ''].filter(Boolean).join(' · ')
        return { descricao: `Produto: ${u.produto}${det ? ` (${det})` : ''}`, qtd, valor_unit: pv, total: pv * qtd, origem: 'produto' as const, ref_id: '' }
      })
      await createQuote({
        clinicId, patientId, professionalId,
        treatmentPlanId: (orcVinculado?.treatment_plan_id ?? planoId) || null,
        itens: itensComplementar, desconto: 0, status: 'rascunho',
      })
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível criar o orçamento complementar.'); setCriandoComplementar(false) }
  }

  const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar procedimento' : 'Registrar procedimento'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Procedimento *</label>
            <select className={field} value={procSelect}
              onChange={(e) => {
                const v = e.target.value
                setProcSelect(v)
                if (v && v !== '__outro__') {
                  setProcedimento(v)
                  // Fase 6: pré-preenche o valor avulso com o preço vigente do procedimento (editável).
                  const preco = precoVigenteDoNome(v)
                  if (preco > 0) setValorCobrado(fmtMoedaBR(preco))
                }
              }}>
              <option value="">{editar ? procedimento || 'Selecione…' : 'Selecione…'}</option>
              {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              <option value="__outro__">Outro (digitar)…</option>
            </select>
            {(procSelect === '__outro__' || editar) && (
              <input className={`${field} mt-2`} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Descreva o procedimento" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Data</label><input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Região</label><input className={field} value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
          </div>

          {/* Vínculo: Plano -> Orçamento (opcional). Sem orçamento = avulso com valor a cobrar. */}
          <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-texto/70">Plano de tratamento</label>
                <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                  <option value="">— Sem plano —</option>
                  {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-texto/70">Orçamento</label>
                <select className={field} value={quoteId} onChange={(e) => { const v = e.target.value; setQuoteId(v); setPlanoId(orcamentos.find((x) => x.id === v)?.treatment_plan_id ?? '') }}>
                  <option value="">— Sem orçamento (avulso) —</option>
                  {orcamentosDoPlano.map((q) => (
                    <option key={q.id} value={q.id}>{new Date(q.created_at).toLocaleDateString('pt-BR')} · {brl(q.valor_total)}</option>
                  ))}
                </select>
              </div>
            </div>
            {planoId && planItens.length > 0 && (
              <div className="mt-2">
                <label className="mb-1 block text-sm text-texto/70">Item do plano (consome uma sessão)</label>
                <select className={field} value={planItemId} onChange={(e) => { setPlanItemId(e.target.value); if (e.target.value) setPackageItemId('') }}>
                  <option value="">— Não consumir sessão —</option>
                  {planItens.map((it) => {
                    const esgotado = it.saldo <= 0 && it.id !== (proc?.treatment_plan_item_id ?? '')
                    return <option key={it.id} value={it.id} disabled={esgotado}>{it.nome} · {it.realizadas}/{it.sessoes}{esgotado ? ' (esgotado)' : ''}</option>
                  })}
                </select>
                <p className="mt-1 text-[11px] text-texto/50">Baixa uma sessão do item ao salvar. Itens esgotados não podem ser vinculados — crie um novo orçamento (avulso).</p>
              </div>
            )}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-texto/70">Pacote (consome sessão)</label>
                <button type="button" onClick={() => setNovoPacote(true)} className="text-xs font-medium text-primaria hover:underline">+ Novo pacote</button>
              </div>
              {pacotes.length > 0 ? (
                <>
                  <select className={field} value={pacoteId} onChange={(e) => setPacoteId(e.target.value)}>
                    <option value="">— Sem pacote —</option>
                    {pacotes.map((p) => <option key={p.id} value={p.id}>{p.procedimento} · {p.sessoes_compradas} sessões</option>)}
                  </select>
                  {pacoteId && pkgItens.length > 0 && (
                    <select className={`${field} mt-2`} value={packageItemId} onChange={(e) => { setPackageItemId(e.target.value); if (e.target.value) setPlanItemId('') }}>
                      <option value="">— Não consumir sessão —</option>
                      {pkgItens.map((it) => {
                        const esgotado = it.saldo <= 0 && it.id !== (proc?.treatment_package_item_id ?? '')
                        return <option key={it.id} value={it.id} disabled={esgotado}>{it.nome} · {it.realizadas}/{it.realizadas + it.saldo}{esgotado ? ' (esgotado)' : ''}</option>
                      })}
                    </select>
                  )}
                  {pacoteId && pkgItens.length > 0 && <p className="mt-1 text-[11px] text-texto/50">Baixa uma sessão do item do pacote. Esgotados não podem ser vinculados — crie um novo orçamento (avulso).</p>}
                </>
              ) : (
                <p className="text-[11px] text-texto/50">Nenhum pacote de procedimento ainda. Use “+ Novo pacote” acima ou crie na aba “Pacotes”.</p>
              )}
            </div>
            {avulso && (
              <div className="mt-2">
                <label className="mb-1 block text-sm text-texto/70">Valor a cobrar (procedimento avulso)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-texto/50">R$</span>
                  <input className={field} inputMode="decimal" value={valorCobrado} onChange={(e) => setValorCobrado(e.target.value)} placeholder="0,00" />
                </div>
                <p className="mt-1 text-xs text-texto/60">Sem orçamento: informe o valor (use vírgula para centavos). Ele poderá ser importado depois em “Novo orçamento”. {parseMoneyBR(valorCobrado) > 0 && <strong>{brl(parseMoneyBR(valorCobrado))}</strong>}</p>
                {precoVigenteDoNome(procedimento) > 0 && (
                  <p className="mt-1 text-xs text-texto/60">
                    Preço vigente do procedimento: <strong>{brl(precoVigenteDoNome(procedimento))}</strong>
                    {Math.abs(parseMoneyBR(valorCobrado) - precoVigenteDoNome(procedimento)) > 0.001 && (
                      <button type="button" onClick={() => setValorCobrado(fmtMoedaBR(precoVigenteDoNome(procedimento)))} className="ml-2 font-medium text-primaria hover:underline">usar preço vigente</button>
                    )}
                  </p>
                )}
                {totalProdutos > 0 && (
                  <p className="mt-1 text-xs text-texto/60">
                    Total dos produtos utilizados: <strong>{brl(totalProdutos)}</strong>
                    <button type="button" onClick={() => setValorCobrado(String(totalProdutos.toFixed(2)).replace('.', ','))} className="ml-2 font-medium text-primaria hover:underline">usar como valor a cobrar</button>
                  </p>
                )}
              </div>
            )}
            {!avulso && (
              <p className="mt-2 text-xs text-texto/70">
                {VINCULO_HELP}
                {parseMoneyBR(valorCobrado) > 0 && (
                  <span className="mt-1 block text-amber-700">Atenção: o “valor a cobrar” avulso ({brl(parseMoneyBR(valorCobrado))}) não será usado enquanto houver orçamento vinculado.</span>
                )}
              </p>
            )}
          </div>

          {!editar && avulso && (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
              <label className="mb-1 block text-sm font-medium text-texto/80">Recorrência recomendada (opcional)</label>
              <p className="mb-2 text-xs text-texto/50">Só para procedimento avulso (sem orçamento/plano/pacote). Deixa registrado que você recomenda repetir e gera alerta de retorno para a equipe e o paciente.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className={field} value={recPeriodo} onChange={(e) => setRecPeriodo(e.target.value as '' | Periodicidade)}>
                  <option value="">— Sem recorrência —</option>
                  {(Object.keys(PERIOD_LABEL) as Periodicidade[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
                </select>
                {recPeriodo && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={365} className={field} value={recAntecedencia} onChange={(e) => setRecAntecedencia(e.target.value)} />
                    <span className="whitespace-nowrap text-xs text-texto/60">dias de antecedência</span>
                  </div>
                )}
                {recPeriodo && (
                  <div>
                    <input type="date" className={field} value={recLimite} onChange={(e) => setRecLimite(e.target.value)} />
                    <span className="mt-0.5 block text-[11px] text-texto/50">Alertar até (opcional — em branco = permanente)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-texto/70">Observações</label>
            <textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} />
            <SnippetPicker categorias={['orientacao', 'outro']} onInsert={(t) => setObs((v) => (v ? v + '\n' : '') + t)} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-texto/70">Produtos utilizados (baixa de estoque)</label>
              <button onClick={addProduto} className="text-xs font-medium text-primaria hover:underline">+ Adicionar</button>
            </div>
            {produtos.length === 0 && <p className="text-xs text-texto/40">Nenhum produto. (Opcional)</p>}
            {produtos.length > 0 && lotesComSaldo.length > 0 && (
              <input className={`${field} mb-2`} placeholder="🔍 Filtrar por produto, lote ou validade…" value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)} />
            )}
            {lotesComSaldo.length === 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Nenhum lote com saldo em estoque. Registre uma entrada (Financeiro → Nova Despesa, Estoque → +Entrada ou Editar Produto — admin) antes de usar produtos.</p>
            )}
            <div className="space-y-2">
              {produtos.map((p, idx) => {
                // Lotes disponíveis: com saldo > 0 (e o já escolhido), aplicando o filtro textual.
                const opcoes = lotesComSaldo.filter((l) => l.id === p.lot_id || (Number(l.qtd_atual) > 0 && matchFiltro(l)))
                const semSaldo = !!p.lot_id && !editar && p.qtd > saldoLote(p.lot_id)
                return (
                  <div key={idx}>
                    <div className="flex gap-2">
                      <select className={field} value={p.lot_id ?? ''}
                        onChange={(e) => setProdutoLote(idx, lotes.find((l) => l.id === e.target.value) ?? null, p.qtd)}>
                        <option value="">{p.lot_id ? '' : (p.produto ? `${p.produto} (lote antigo)` : 'Selecione o lote…')}</option>
                        {opcoes.map((l) => <option key={l.id} value={l.id}>{rotuloLote(l)}</option>)}
                      </select>
                      <input type="number" min={1} className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm outline-none focus:border-primaria"
                        value={p.qtd} onChange={(e) => setProdutos((arr) => arr.map((x, i) => i === idx ? { ...x, qtd: Number(e.target.value) } : x))} />
                      <button onClick={() => removeProduto(idx)} className="px-2 text-texto/40 hover:text-secundaria">✕</button>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                      {(p.lote || p.validade) && <span className="text-texto/50">Lote {p.lote || 's/ nº'}{p.validade ? ` · val ${formatDateBR(p.validade)}` : ''}</span>}
                      {Number(p.preco_venda) > 0 && <span className="text-texto/50">Venda: {brl(Number(p.preco_venda))} × {p.qtd} = <strong className="text-texto/70">{brl(Number(p.preco_venda) * p.qtd)}</strong></span>}
                      {semSaldo && <span className="font-medium text-secundaria">Quantidade acima do saldo do lote ({saldoLote(p.lot_id)}).</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {produtos.some((p) => Number(p.preco_venda) > 0) && (
              <p className="mt-1 text-right text-xs text-texto/60">Total dos produtos (venda): <strong>{brl(produtos.reduce((s, p) => s + Number(p.preco_venda || 0) * p.qtd, 0))}</strong></p>
            )}
            {editar && produtos.length > 0 && <p className="mt-1 text-xs text-texto/40">Ao salvar, o estoque é reconciliado (devolve os antigos e baixa os novos).</p>}
          </div>

          {podeProporComplementar && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-start gap-2 text-sm text-amber-800">
                <input type="checkbox" className="mt-0.5" checked={produtosPrevistos} onChange={(e) => setProdutosPrevistos(e.target.checked)} />
                <span>Os produtos utilizados já estavam previstos no orçamento/pacote pago ({brl(totalProdutosComValor)}).</span>
              </label>
              {!produtosPrevistos && (
                <p className="mt-1 pl-6 text-xs text-amber-700">Ao salvar, será proposto um <strong>orçamento complementar (rascunho)</strong> com estes produtos para a equipe revisar e enviar. Nada é cobrado automaticamente.</p>
              )}
            </div>
          )}

          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : editar ? 'Salvar' : 'Registrar'}
            </button>
          </div>

          {proporProdutos && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
              <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
                <h3 className="text-base font-semibold text-texto">Propor orçamento complementar</h3>
                <p className="mt-1 text-sm text-texto/70">O orçamento/pacote vinculado já está pago e estes produtos não estavam previstos. Deseja criar um <strong>orçamento complementar (rascunho)</strong> para a equipe revisar e enviar? Nada é cobrado automaticamente.</p>
                <ul className="mt-3 space-y-1 rounded-lg bg-black/[0.02] p-3 text-sm">
                  {proporProdutos.map((u, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate text-texto/70">{u.produto}{u.lote ? ` · lote ${u.lote}` : ''}</span>
                      <span className="shrink-0 text-texto/60">{u.qtd} × {brl(Number(u.preco_venda))} = <strong className="text-texto">{brl(Number(u.preco_venda) * u.qtd)}</strong></span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-2 border-t border-black/10 pt-1 font-semibold text-texto"><span>Total</span><span>{brl(totalProdutosComValor)}</span></li>
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => { setProporProdutos(null); onSaved() }} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Agora não</button>
                  <button onClick={criarComplementar} disabled={criandoComplementar} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {criandoComplementar ? 'Criando…' : 'Criar rascunho'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {novoPacote && (
            <PacoteModal
              clinicId={clinicId} patientId={patientId} professionalId={professionalId} pacote={null} tipoInicial="procedimento"
              onClose={() => setNovoPacote(false)}
              onSaved={(id) => {
                setNovoPacote(false)
                listPackages(patientId).then((ps) => {
                  const procs = ps.filter((p) => p.tipo === 'procedimento')
                  setPacotes(procs)
                  if (id && procs.some((p) => p.id === id)) setPacoteId(id)
                }).catch(() => {})
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
