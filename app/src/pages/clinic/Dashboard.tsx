import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { listAppointments, type Appointment } from '@/lib/appointments'
import { estoqueBaixo, listInventory, validadeProxima, type InventoryItem } from '@/lib/inventory'
import { listActiveIngredients, listAtivoLotes } from '@/lib/domains'
import { listRecords } from '@/lib/admin'
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
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function load() {
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
      const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999)
      const hojeYmd = localDateToday()
      const limiteYmd = ymdSoma(30)

      const [pac, docs, appts, inv, saldos, ativos, ativoLotes, manut, calib] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('document_instances').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        listAppointments(inicioHoje.toISOString()),
        listInventory(),
        supabase.from('v_quote_balances').select('saldo_a_receber'),
        listActiveIngredients(),
        listAtivoLotes(),
        listRecords('manutencao_preventiva', { modo: 'faixa', de: '2000-01-01', ate: limiteYmd }),
        listRecords('calibracao', { modo: 'faixa', de: '2000-01-01', ate: limiteYmd }),
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
    }
    load().catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const cards = [
    { label: 'Pacientes', valor: pacientes ?? '—', to: '/clinica/pacientes' },
    { label: 'Consultas hoje', valor: carregando ? '—' : hoje.length, to: '/clinica/agenda' },
    { label: 'Documentos pendentes', valor: docsPendentes ?? '—', to: '/clinica/pacientes' },
    { label: 'A receber', valor: aReceber == null ? '—' : brl(aReceber), to: '/clinica/financeiro' },
  ]

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
      </div>
    </div>
  )
}
