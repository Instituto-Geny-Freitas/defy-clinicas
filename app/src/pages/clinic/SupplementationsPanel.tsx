import { useEffect, useState } from 'react'
import { createSupplementation, deleteSupplementation, listSupplementations, setSupplementationPaid, updateSupplementation, type Supplementation } from '@/lib/supplementations'
import { listActiveIngredients, listAtivoLotes, listRoutes, type ActiveIngredient, type AtivoLote, type DomainItem } from '@/lib/domains'
import { listTreatmentPlans, listPlanItemsComSaldo, getPlanItem, type TreatmentPlan, type PlanItem } from '@/lib/treatmentPlans'
import { listPackages, listPackageItemsComSaldo, getPackageItem, type TreatmentPackage, type PackageItem } from '@/lib/packages'
import { brl, listQuotes, listPaymentsByPatient, totalLiquidado, type Quote, type Payment } from '@/lib/finance'
import { formatDateBR, localDateToday, parseMoneyBR } from '@/lib/format'
import { createRecurrence, listRecurrences, PERIOD_LABEL, type Periodicidade, type RecurrenceRec } from '@/lib/recurrence'
import RecurrenceEditModal from '@/components/RecurrenceEditModal'
import { Shell, Footer } from './TreatmentPlansPanel'

interface Props { patientId: string; clinicId: string; professionalId?: string | null }
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

/** Situação da suplementação frente aos orçamentos: em orçamento quitado, em orçamento aberto, ou avulsa. */
type Vinculo = 'quitado' | 'aberto' | 'nenhum'

export default function SupplementationsPanel({ patientId, clinicId, professionalId }: Props) {
  const [itens, setItens] = useState<Supplementation[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pagamentos, setPagamentos] = useState<Payment[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Supplementation | null>(null)
  const [recorrencias, setRecorrencias] = useState<RecurrenceRec[]>([])
  const [editRec, setEditRec] = useState<RecurrenceRec | null>(null)

  function recarregar() {
    Promise.all([listSupplementations(patientId), listQuotes(patientId), listPaymentsByPatient(patientId)])
      .then(([s, q, p]) => { setItens(s); setQuotes(q); setPagamentos(p) })
      .catch(() => {})
      .finally(() => setCarregando(false))
    listRecurrences(patientId).then(setRecorrencias).catch(() => {})
  }
  useEffect(recarregar, [patientId])

  /** Verifica se a suplementação está em algum orçamento e se ele está quitado. */
  function vinculoDe(id: string): Vinculo {
    let aberto = false
    for (const q of quotes) {
      const temItem = (q.itens ?? []).some((it) => it.origem === 'suplementacao' && it.ref_id === id)
      if (!temItem) continue
      const quitado = (Number(q.valor_total) - totalLiquidado(pagamentos, q.id)) <= 0.005
      if (quitado) return 'quitado'
      aberto = true
    }
    return aberto ? 'aberto' : 'nenhum'
  }

  async function marcarPago(s: Supplementation, pago: boolean) {
    await setSupplementationPaid(s.id, pago)
    recarregar()
  }

  /** Marca como pago validando o vínculo com orçamento pago (evita marcar indevidamente). */
  async function acionarPago(s: Supplementation) {
    const v = vinculoDe(s.id)
    if (v === 'aberto') {
      alert('Esta suplementação está em um orçamento ainda NÃO quitado. Para marcá-la como paga, receba o pagamento do orçamento (aba Financeiro). A marcação manual foi bloqueada para preservar a integridade financeira.')
      return
    }
    if (v === 'nenhum') {
      if (!confirm('Esta suplementação NÃO está vinculada a nenhum orçamento pago. Deseja marcá-la como paga manualmente mesmo assim?')) return
    }
    await marcarPago(s, true)
  }
  async function excluir(s: Supplementation) {
    if (!confirm(`Excluir a suplementação "${s.medicacao}"?`)) return
    await deleteSupplementation(s.id)
    recarregar()
  }

  const recPorSupl = new Map(
    recorrencias.filter((r) => r.tipo === 'suplementacao' && r.status === 'ativa' && r.supplementation_id).map((r) => [r.supplementation_id as string, r]),
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Suplementação</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova suplementação</button>
      </div>
      {modal && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} supl={null} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {editando && <Modal clinicId={clinicId} patientId={patientId} professionalId={professionalId} supl={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />}
      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma suplementação prescrita.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr><th className="px-4 py-2 font-medium">Medicação</th><th className="px-4 py-2 font-medium">Via/Local</th><th className="px-4 py-2 font-medium">Validade</th><th className="px-4 py-2 font-medium">Lote</th><th className="px-4 py-2 font-medium">Valor</th><th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Pagamento</th><th className="px-4 py-2 font-medium">Recorrência</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {itens.map((s) => (
                <tr key={s.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{s.medicacao}</td>
                  <td className="px-4 py-2 text-texto/70">{s.via_adm ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{s.validade ? formatDateBR(s.validade) : '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{s.lote ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{Number(s.valor_venda) > 0 ? brl(Number(s.valor_venda)) : '—'}</td>
                  <td className="px-4 py-2 text-texto/60">{formatDateBR(s.data)}</td>
                  <td className="px-4 py-2">
                    {(() => {
                      const v = vinculoDe(s.id)
                      if (s.pago) {
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Pago</span>
                            {v === 'quitado' && <span className="text-[10px] text-texto/40">via orçamento</span>}
                            {v === 'nenhum' && <button onClick={() => { if (confirm('Marcar esta suplementação avulsa como NÃO paga?')) marcarPago(s, false) }} className="text-[10px] text-texto/40 hover:underline">reverter</button>}
                          </span>
                        )
                      }
                      if (v === 'aberto') {
                        return <span title="Vinculada a um orçamento ainda não quitado — receba o pagamento na aba Financeiro" className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Aguardando orçamento</span>
                      }
                      return (
                        <button onClick={() => acionarPago(s)} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-emerald-100 hover:text-emerald-700" title={v === 'quitado' ? 'Vinculada a orçamento quitado — pode marcar como paga' : 'Sem orçamento vinculado — exige confirmação'}>
                          Marcar como pago
                        </button>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {(() => { const r = recPorSupl.get(s.id); return r ? (
                      <button onClick={() => setEditRec(r)} title="Editar recorrência" className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700 hover:bg-sky-200">
                        🔁 {PERIOD_LABEL[r.periodicidade]}{r.data_limite ? ` · até ${formatDateBR(r.data_limite)}` : ''}
                      </button>
                    ) : <span className="text-texto/30">—</span> })()}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(s)} className="text-xs font-medium text-primaria hover:underline">Editar</button>
                    <button onClick={() => excluir(s)} className="ml-3 text-xs font-medium text-secundaria hover:underline">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editRec && <RecurrenceEditModal rec={editRec} onClose={() => setEditRec(null)} onSaved={() => { setEditRec(null); recarregar() }} />}
    </div>
  )
}

function Modal({ clinicId, patientId, professionalId, supl, onClose, onSaved }: { clinicId: string; patientId: string; professionalId?: string | null; supl: Supplementation | null; onClose: () => void; onSaved: () => void }) {
  const editar = !!supl
  const [ativos, setAtivos] = useState<ActiveIngredient[]>([])
  const [ativoLotes, setAtivoLotes] = useState<AtivoLote[]>([])
  const [vias, setVias] = useState<DomainItem[]>([])
  const [ativoId, setAtivoId] = useState('')
  const [ativoLoteId, setAtivoLoteId] = useState(supl?.ativo_lote_id ?? '')
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [planoId, setPlanoId] = useState('')
  const [planItens, setPlanItens] = useState<(PlanItem & { saldo: number; realizadas: number })[]>([])
  const [planItemId, setPlanItemId] = useState(supl?.treatment_plan_item_id ?? '')
  const [pacotes, setPacotes] = useState<TreatmentPackage[]>([])
  const [pacoteId, setPacoteId] = useState('')
  const [pkgItens, setPkgItens] = useState<(PackageItem & { saldo: number; realizadas: number })[]>([])
  const [packageItemId, setPackageItemId] = useState(supl?.treatment_package_item_id ?? '')
  const [quantidade, setQuantidade] = useState(supl ? String(supl.quantidade) : '1')
  const [medicacao, setMedicacao] = useState(supl?.medicacao ?? '')
  const [via, setVia] = useState(supl?.via_adm ?? '')
  const [validade, setValidade] = useState(supl?.validade ?? '')
  const [lote, setLote] = useState(supl?.lote ?? '')
  const [fornecedor, setFornecedor] = useState(supl?.fornecedor ?? '')
  const [valorVenda, setValorVenda] = useState(supl && Number(supl.valor_venda) > 0 ? String(Number(supl.valor_venda).toFixed(2)).replace('.', ',') : '')
  const [obs, setObs] = useState(supl?.observacoes ?? '')
  const [recPeriodo, setRecPeriodo] = useState<'' | Periodicidade>('')
  const [recAntecedencia, setRecAntecedencia] = useState('7')
  const [recLimite, setRecLimite] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listActiveIngredients().then(setAtivos).catch(() => {})
    listAtivoLotes().then(setAtivoLotes).catch(() => {})
    listRoutes().then(setVias).catch(() => {})
    listTreatmentPlans(patientId).then(setPlanos).catch(() => {})
    listPackages(patientId).then((ps) => setPacotes(ps.filter((p) => p.tipo === 'suplementacao'))).catch(() => {})
    if (supl?.treatment_plan_item_id) getPlanItem(supl.treatment_plan_item_id).then((it) => { if (it) setPlanoId(it.treatment_plan_id) }).catch(() => {})
    if (supl?.treatment_package_item_id) getPackageItem(supl.treatment_package_item_id).then((it) => { if (it) setPacoteId(it.package_id) }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Itens (suplementação) do plano selecionado, com saldo de sessões.
  useEffect(() => {
    if (!planoId) { setPlanItens([]); return }
    listPlanItemsComSaldo(planoId).then((its) => {
      const suplItems = its.filter((i) => i.tipo === 'suplementacao')
      setPlanItens(suplItems)
      setPlanItemId((cur) => (cur && suplItems.some((i) => i.id === cur) ? cur : ''))
    }).catch(() => {})
  }, [planoId])

  // Itens do pacote (suplementação) selecionado, com saldo.
  useEffect(() => {
    if (!pacoteId) { setPkgItens([]); return }
    const pkg = pacotes.find((p) => p.id === pacoteId)
    if (!pkg) return
    listPackageItemsComSaldo(pacoteId, pkg.sessoes_compradas).then((its) => {
      setPkgItens(its)
      setPackageItemId((cur) => (cur && its.some((i) => i.id === cur) ? cur : ''))
    }).catch(() => {})
  }, [pacoteId, pacotes])

  const lotesDoAtivo = ativoLotes.filter((l) => l.ativo_id === ativoId && Number(l.qtd_atual) > 0)
  const saldoLote = (id: string) => Number(ativoLotes.find((l) => l.id === id)?.qtd_atual ?? 0)

  // Ao escolher um ativo: preenche nome/via e reseta o lote.
  function escolherAtivo(id: string) {
    setAtivoId(id)
    setAtivoLoteId('')
    const a = ativos.find((x) => x.id === id)
    if (!a) return
    setMedicacao(a.nome)
    setVia(a.via ?? '')
  }

  // Ao escolher um lote: snapshot de fornecedor/lote/validade/preço.
  function escolherLote(id: string) {
    setAtivoLoteId(id)
    const l = ativoLotes.find((x) => x.id === id)
    if (!l) return
    setLote(l.lote ?? '')
    setValidade(l.validade ?? '')
    setFornecedor(l.fornecedor ?? '')
    setValorVenda(Number(l.preco_venda) > 0 ? String(Number(l.preco_venda).toFixed(2)).replace('.', ',') : '')
  }

  const qtdNum = Number(quantidade.replace(',', '.')) || 0
  const podeSalvar = medicacao.trim().length > 0 && qtdNum > 0
  // Fase 6: recorrência só quando avulso (sem vínculo com item de plano/pacote).
  const vinculado = !!planItemId || !!packageItemId

  async function salvar() {
    if (!podeSalvar) return
    setErro('')
    // Bloqueia baixa acima do saldo do lote (só na criação, para não bloquear edições).
    if (!editar && ativoLoteId && qtdNum > saldoLote(ativoLoteId)) {
      setErro(`Quantidade (${qtdNum}) acima do saldo do lote (${saldoLote(ativoLoteId)}).`); return
    }
    if (planItemId && !editar) {
      const it = planItens.find((i) => i.id === planItemId)
      if (it && it.saldo <= 0) { setErro(`O item "${it.nome}" do plano está esgotado (${it.realizadas}/${it.sessoes} sessões). Crie um novo orçamento (avulso).`); return }
    }
    if (packageItemId && !editar) {
      const it = pkgItens.find((i) => i.id === packageItemId)
      if (it && it.saldo <= 0) { setErro(`O item "${it.nome}" do pacote está esgotado. Crie um novo orçamento (avulso).`); return }
    }
    setSalvando(true)
    try {
      const valor = parseMoneyBR(valorVenda)
      if (supl) {
        await updateSupplementation(supl.id, {
          medicacao, via_adm: via || null, validade: validade || null, lote: lote || null,
          fornecedor: fornecedor || null, valor_venda: valor, observacoes: obs || null,
          ativo_lote_id: ativoLoteId || null, quantidade: qtdNum, treatment_plan_item_id: planItemId || null, treatment_package_item_id: packageItemId || null,
        })
      } else {
        const novoId = await createSupplementation({
          clinicId, patientId, professionalId, medicacao,
          via_adm: via || null, validade: validade || null, lote: lote || null,
          fornecedor: fornecedor || null, valor_venda: valor, observacoes: obs || null,
          ativoLoteId: ativoLoteId || null, quantidade: qtdNum, treatmentPlanItemId: planItemId || null, treatmentPackageItemId: packageItemId || null,
        })
        if (recPeriodo && !vinculado) {
          await createRecurrence({
            clinicId, patientId, professionalId, tipo: 'suplementacao', supplementationId: novoId,
            descricao: medicacao, periodicidade: recPeriodo, diasAntecedencia: Number(recAntecedencia) || 7, dataBase: localDateToday(), dataLimite: recLimite || null,
          }).catch(() => {})
        }
      }
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo={editar ? 'Editar suplementação' : 'Nova suplementação'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Medicação (ativo) *</label>
          <select className={field} value={ativoId} onChange={(e) => escolherAtivo(e.target.value)}>
            <option value="">Selecione o ativo…</option>
            {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          {/* Campo de texto só quando não há ativo escolhido (edição de registro antigo ou nome manual). */}
          {!ativoId && (
            <input className={`${field} mt-2`} value={medicacao} onChange={(e) => setMedicacao(e.target.value)} placeholder="Ou digite a medicação (manual)" />
          )}
        </div>
        {ativoId && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-texto/70">Lote (com saldo)</label>
              <select className={field} value={ativoLoteId} onChange={(e) => escolherLote(e.target.value)}>
                <option value="">Selecione o lote…</option>
                {lotesDoAtivo.map((l) => (
                  <option key={l.id} value={l.id}>{l.lote || 's/ lote'}{l.validade ? ` · val ${formatDateBR(l.validade)}` : ''} · {l.qtd_atual} un</option>
                ))}
              </select>
              {lotesDoAtivo.length === 0 && <p className="mt-1 text-[11px] text-amber-700">Sem saldo. Registre entrada (Nova Despesa, Editar Ativo → +Entrada — admin).</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Quantidade (unidades)</label>
              <input inputMode="decimal" className={field} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              {ativoLoteId && <p className="mt-1 text-[11px] text-texto/50">Saldo do lote: {saldoLote(ativoLoteId)}</p>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Via Adm / local</label>
            <select className={field} value={via} onChange={(e) => setVia(e.target.value)}>
              <option value="">Selecione…</option>
              {vias.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
              {via && !vias.some((v) => v.nome === via) && <option value={via}>{via}</option>}
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Fornecedor</label><input className={field} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} disabled={!!ativoLoteId} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Lote</label><input className={field} value={lote} onChange={(e) => setLote(e.target.value)} disabled={!!ativoLoteId} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Validade</label><input type="date" className={field} value={validade} onChange={(e) => setValidade(e.target.value)} disabled={!!ativoLoteId} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Valor de Venda</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-texto/50">R$</span>
              <input className={field} inputMode="decimal" value={valorVenda} onChange={(e) => setValorVenda(e.target.value)} placeholder="0,00" />
            </div>
            <p className="mt-1 text-xs text-texto/50">{brl(parseMoneyBR(valorVenda))}</p>
          </div>
        </div>
        <div className="rounded-xl border border-primaria/20 bg-primaria/5 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-texto/70">Plano de tratamento (opcional)</label>
              <select className={field} value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                <option value="">— Sem plano —</option>
                {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo || 'Plano'} · {formatDateBR(p.data)}</option>)}
              </select>
            </div>
            {planoId && (
              <div>
                <label className="mb-1 block text-sm text-texto/70">Item do plano (consome sessão)</label>
                <select className={field} value={planItemId} onChange={(e) => { setPlanItemId(e.target.value); if (e.target.value) setPackageItemId('') }}>
                  <option value="">— Não consumir sessão —</option>
                  {planItens.map((it) => {
                    const esgotado = it.saldo <= 0 && it.id !== (supl?.treatment_plan_item_id ?? '')
                    return <option key={it.id} value={it.id} disabled={esgotado}>{it.nome} · {it.realizadas}/{it.sessoes}{esgotado ? ' (esgotado)' : ''}</option>
                  })}
                </select>
              </div>
            )}
          </div>
          {planoId && planItens.length === 0 && <p className="mt-1 text-[11px] text-texto/50">Este plano não tem itens de suplementação.</p>}
          {planoId && planItens.length > 0 && <p className="mt-1 text-[11px] text-texto/50">Baixa uma sessão do item ao salvar. Itens esgotados não podem ser vinculados — crie um novo orçamento (avulso).</p>}
          {pacotes.length > 0 && (
            <div className="mt-2 border-t border-primaria/20 pt-2">
              <label className="mb-1 block text-sm text-texto/70">Pacote (consome sessão)</label>
              <select className={field} value={pacoteId} onChange={(e) => setPacoteId(e.target.value)}>
                <option value="">— Sem pacote —</option>
                {pacotes.map((p) => <option key={p.id} value={p.id}>{p.procedimento} · {p.sessoes_compradas} sessões</option>)}
              </select>
              {pacoteId && pkgItens.length > 0 && (
                <select className={`${field} mt-2`} value={packageItemId} onChange={(e) => { setPackageItemId(e.target.value); if (e.target.value) setPlanItemId('') }}>
                  <option value="">— Não consumir sessão —</option>
                  {pkgItens.map((it) => {
                    const esgotado = it.saldo <= 0 && it.id !== (supl?.treatment_package_item_id ?? '')
                    return <option key={it.id} value={it.id} disabled={esgotado}>{it.nome} · {it.realizadas}/{it.realizadas + it.saldo}{esgotado ? ' (esgotado)' : ''}</option>
                  })}
                </select>
              )}
              {packageItemId && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">Pacote pré-pago: o valor desta suplementação já está coberto pelo pacote. Os valores são travados na criação do pacote — diferenças futuras de preço não são cobradas nem estornadas.</p>
              )}
            </div>
          )}
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        {!editar && !vinculado && (
          <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
            <label className="mb-1 block text-sm font-medium text-texto/80">Recorrência recomendada (opcional)</label>
            <p className="mb-2 text-xs text-texto/50">Só para suplementação avulsa (sem vínculo com plano/pacote). Registra a recomendação de repetir e gera alerta de retorno para a equipe e o paciente.</p>
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
        {erro && <p className="text-sm text-secundaria">{erro}</p>}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || !podeSalvar} label={salvando ? 'Salvando…' : 'Salvar'} />
      </div>
    </Shell>
  )
}
