import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createAppointment, listAppointments, type Appointment } from '@/lib/appointments'
import { estoqueBaixo, listInventory, validadeProxima, type InventoryItem } from '@/lib/inventory'
import { listActiveIngredients, listAtivoLotes } from '@/lib/domains'
import { listRecords } from '@/lib/admin'
import { advanceRecurrence, dismissRecurrence, listDueRecurrences, PERIOD_LABEL, type RecurrenceRec } from '@/lib/recurrence'
import { listOpenLeads, ETAPAS, type Lead } from '@/lib/crm'
import { brl } from '@/lib/finance'
import { formatDateBR, localDateToday } from '@/lib/format'
import ApptStatusBadge from '@/components/ApptStatusBadge'

interface AtivoAlerta { id: string; nome: string; total: number; minimo: number; baixo: boolean; venc: boolean }
interface ManutencaoAlerta { id: string; equipamento: string; quando: string; vencida: boolean; tipo: string }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const ymdSoma = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function Dashboard() {
  const [pacientes, setPacientes] = useState<number | null>(null)
  const [docsPendentes, setDocsPendentes] = useState<number | null>(null)
  const [aReceber, setAReceber] = useState<number | null>(null)
  const [hoje, setHoje] = useState<Appointment[]>([])
  const [alertasEstoque, setAlertasEstoque] = useState<InventoryItem[]>([])
  const [alertasAtivos, setAlertasAtivos] = useState<AtivoAlerta[]>([])
  const [alertasManutencao, setAlertasManutencao] = useState<ManutencaoAlerta[]>([])
  const [retornos, setRetornos] = useState<RecurrenceRec[]>([])
  const [leadsAbertos, setLeadsAbertos] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function load() {
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
      const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999)
      const hojeYmd = localDateToday()
      const limiteYmd = ymdSoma(30)

      const [pac, docs, appts, inv, saldos, ativos, ativoLotes, manut, calib, recs, leads] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('document_instances').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        listAppointments(inicioHoje.toISOString()),
        listInventory(),
        supabase.from('v_quote_balances').select('saldo_a_receber'),
        listActiveIngredients(),
        listAtivoLotes(),
        listRecords('manutencao_preventiva', { modo: 'faixa', de: '2000-01-01', ate: limiteYmd }),
        listRecords('calibracao', { modo: 'faixa', de: '2000-01-01', ate: limiteYmd }),
        listDueRecurrences(),
        listOpenLeads(),
      ])

      setPacientes(pac.count ?? 0)
      setDocsPendentes(docs.count ?? 0)
      setHoje(appts.filter((a) => new Date(a.inicio) <= fimHoje))
      setAlertasEstoque(inv.filter((i) => estoqueBaixo(i) || validadeProxima(i)))
      setAReceber((saldos.data ?? []).reduce((s, r) => s + Number(r.saldo_a_receber), 0))

      // Alertas de ativos: soma dos lotes vs. estoque mínimo + validade próxima.
      const porAtivo = new Map<string, { total: number; venc: boolean }>()
      for (const l of ativoLotes) {
        const cur = porAtivo.get(l.ativo_id) ?? { total: 0, venc: false }
        cur.total += Number(l.qtd_atual)
        if (Number(l.qtd_atual) > 0 && l.validade && (new Date(l.validade).getTime() - Date.now()) / 86400000 <= 30) cur.venc = true
        porAtivo.set(l.ativo_id, cur)
      }
      setAlertasAtivos(ativos.map((a) => {
        const info = porAtivo.get(a.id) ?? { total: 0, venc: false }
        const minimo = Number(a.estoque_minimo)
        return { id: a.id, nome: a.nome, total: info.total, minimo, baixo: minimo > 0 && info.total <= minimo, venc: info.venc }
      }).filter((x) => x.baixo || x.venc))

      // Alertas de manutenção/calibração: próxima data (ref_data) vencida ou <= 30 dias, exceto já efetuadas.
      const manutAlertas: ManutencaoAlerta[] = [
        ...manut.map((r) => ({ r, tipo: 'Manutenção', nomeKey: 'equipamento' })),
        ...calib.map((r) => ({ r, tipo: 'Calibração', nomeKey: 'equipamento' })),
      ]
        .filter(({ r }) => r.ref_data && !r.dados?.efetuado)
        .map(({ r, tipo, nomeKey }) => ({
          id: r.id,
          equipamento: String(r.dados?.[nomeKey] ?? '—'),
          quando: r.ref_data as string,
          vencida: (r.ref_data as string) < hojeYmd,
          tipo,
        }))
        .sort((a, b) => a.quando.localeCompare(b.quando))
      setAlertasManutencao(manutAlertas)
      setRetornos(recs)
      setLeadsAbertos(leads)
    }
    load().catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const hojeYmd2 = localDateToday()
  async function agendarRetorno(rec: RecurrenceRec) {
    if (!confirm(`Agendar retorno de ${rec.patients?.nome ?? 'paciente'} para "${rec.descricao}" em ${formatDateBR(rec.proxima_data)} às 09:00? Você poderá remarcar depois na Agenda.`)) return
    try {
      const inicio = new Date(`${rec.proxima_data}T09:00:00`).toISOString()
      await createAppointment({ clinicId: rec.clinic_id, patientId: rec.patient_id, professionalId: rec.professional_id, procedimento: rec.descricao, inicio })
      await advanceRecurrence(rec)
      setRetornos((rs) => rs.filter((r) => r.id !== rec.id))
    } catch { alert('Não foi possível agendar o retorno.') }
  }
  async function dispensarRetorno(rec: RecurrenceRec) {
    if (!confirm('Encerrar esta recomendação de retorno? Ela deixará de gerar alertas.')) return
    await dismissRecurrence(rec.id).catch(() => {})
    setRetornos((rs) => rs.filter((r) => r.id !== rec.id))
  }

  const cards = [
    { label: 'Pacientes', valor: pacientes ?? '—', to: '/clinica/pacientes' },
    { label: 'Consultas hoje', valor: carregando ? '—' : hoje.length, to: '/clinica/agenda?data=hoje' },
    { label: 'Documentos pendentes', valor: docsPendentes ?? '—', to: '/clinica/pacientes' },
    { label: 'A receber', valor: aReceber == null ? '—' : brl(aReceber), to: '/clinica/financeiro' },
  ]

  // Follow-ups comerciais: com data vencida/hoje, e leads sem próximo passo (>3 dias).
  const labelEtapa = (e: string) => ETAPAS.find((x) => x.key === e)?.label ?? e
  const followVencidos = leadsAbertos.filter((l) => l.proxima_acao && l.proxima_acao <= hojeYmd2)
  const semProximo = leadsAbertos.filter((l) => !l.proxima_acao && (Date.now() - new Date(l.created_at).getTime()) / 86400000 > 3)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Dashboard</h1>
      <p className="mt-1 text-sm text-texto/60">Visão geral do dia</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-xl border border-black/5 bg-white p-5 transition hover:border-primaria/30">
            <div className="text-2xl font-semibold text-primaria">{c.valor}</div>
            <div className="mt-1 text-sm text-texto/70">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Consultas de hoje */}
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="mb-3 font-semibold text-texto">Consultas de hoje</h2>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : hoje.length === 0 ? (
            <p className="text-sm text-texto/50">Nenhuma consulta hoje.</p>
          ) : (
            <ul className="space-y-2">
              {hoje.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-primaria">{hora(a.inicio)}</span>
                  <span className="flex-1 truncate text-texto">{a.patients?.nome ?? 'Paciente'}</span>
                  <ApptStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Alertas de estoque */}
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="mb-3 font-semibold text-texto">Alertas de estoque</h2>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : alertasEstoque.length === 0 ? (
            <p className="text-sm text-texto/50">Estoque sob controle.</p>
          ) : (
            <ul className="space-y-2">
              {alertasEstoque.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-texto">{i.produto}</span>
                  <span className="flex gap-2">
                    {estoqueBaixo(i) && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">baixo ({i.qtd_atual})</span>}
                    {validadeProxima(i) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">validade</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/clinica/estoque" className="mt-3 inline-block text-sm font-medium text-primaria hover:underline">
            Ver estoque →
          </Link>
        </section>

        {/* Alertas de ativos */}
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="mb-3 font-semibold text-texto">Alertas de ativos</h2>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : alertasAtivos.length === 0 ? (
            <p className="text-sm text-texto/50">Ativos sob controle.</p>
          ) : (
            <ul className="space-y-2">
              {alertasAtivos.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-texto">{a.nome}</span>
                  <span className="flex gap-2">
                    {a.baixo && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">baixo ({a.total}/{a.minimo})</span>}
                    {a.venc && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">validade</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/clinica/configuracoes" className="mt-3 inline-block text-sm font-medium text-primaria hover:underline">
            Ver ativos →
          </Link>
        </section>

        {/* Manutenções / calibrações previstas */}
        <section className="rounded-xl border border-black/5 bg-white p-5">
          <h2 className="mb-3 font-semibold text-texto">Manutenções previstas</h2>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : alertasManutencao.length === 0 ? (
            <p className="text-sm text-texto/50">Nenhuma manutenção/calibração próxima.</p>
          ) : (
            <ul className="space-y-2">
              {alertasManutencao.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-texto">{m.equipamento} <span className="text-texto/40">· {m.tipo}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${m.vencida ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.vencida ? 'vencida' : 'em breve'} · {formatDateBR(m.quando)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/clinica/administrativo" className="mt-3 inline-block text-sm font-medium text-primaria hover:underline">
            Ver administrativo →
          </Link>
        </section>

        {/* Retornos recomendados (recorrência de procedimentos/suplementações) */}
        <section className="rounded-xl border border-black/5 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-texto">Retornos recomendados</h2>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : retornos.length === 0 ? (
            <p className="text-sm text-texto/50">Nenhum retorno recomendado no momento.</p>
          ) : (
            <ul className="space-y-2">
              {retornos.map((r) => {
                const vencido = r.proxima_data < hojeYmd2
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 text-sm last:border-0 last:pb-0">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-texto">{r.patients?.nome ?? 'Paciente'}</span>
                      <span className="text-texto/60"> · {r.descricao}</span>
                      <span className="text-texto/40"> · {PERIOD_LABEL[r.periodicidade]}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${vencido ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {vencido ? 'atrasado' : 'em breve'} · {formatDateBR(r.proxima_data)}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button onClick={() => agendarRetorno(r)} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Agendar</button>
                      <button onClick={() => dispensarRetorno(r)} className="rounded-md px-2 py-1 text-xs font-medium text-texto/50 hover:bg-black/5">Dispensar</button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-texto/40">“Agendar” cria a consulta na data recomendada (09:00) e adianta a próxima recorrência. Você pode remarcar na Agenda.</p>
        </section>

        {/* Follow-ups comerciais (CRM) */}
        <section className="rounded-xl border border-black/5 bg-white p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-texto">Follow-ups (Comercial)</h2>
            <Link to="/clinica/crm" className="text-sm font-medium text-primaria hover:underline">Ver funil →</Link>
          </div>
          {carregando ? (
            <p className="text-sm text-texto/50">Carregando…</p>
          ) : followVencidos.length === 0 && semProximo.length === 0 ? (
            <p className="text-sm text-texto/50">Nenhum follow-up pendente. 👍</p>
          ) : (
            <>
              {followVencidos.length > 0 && (
                <ul className="space-y-2">
                  {followVencidos.map((l) => {
                    const atrasado = !!l.proxima_acao && l.proxima_acao < hojeYmd2
                    return (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 text-sm last:border-0 last:pb-0">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-texto">{l.nome}</span>
                          <span className="text-texto/50"> · {labelEtapa(l.etapa)}</span>
                          {l.professionals?.nome && <span className="text-texto/40"> · {l.professionals.nome}</span>}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${atrasado ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {atrasado ? 'atrasado' : 'hoje'} · {formatDateBR(l.proxima_acao)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {semProximo.length > 0 && (
                <p className="mt-3 text-sm text-texto/60">
                  <span className="font-medium text-amber-700">{semProximo.length}</span> lead(s) em aberto <strong>sem próximo follow-up</strong> definido — defina uma ação no funil para não esfriar.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
