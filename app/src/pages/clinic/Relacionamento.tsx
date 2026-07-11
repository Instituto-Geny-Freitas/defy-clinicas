import { useEffect, useMemo, useState } from 'react'
import { useClinic } from '@/theme/ThemeProvider'
import { listPatients } from '@/lib/patients'
import { listAppointments } from '@/lib/appointments'
import { formatDateBR, localDateToday } from '@/lib/format'
import type { Patient } from '@/lib/types'

type Tab = 'aniversariantes' | 'inativos'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]
const zap = (whatsapp: string | null | undefined) => (whatsapp ? whatsapp.replace(/\D/g, '') : '')

function linkWhatsApp(whatsapp: string | null | undefined, msg: string): string | null {
  const d = zap(whatsapp)
  if (!d) return null
  return `https://wa.me/55${d}?text=${encodeURIComponent(msg)}`
}

export default function Relacionamento() {
  const clinic = useClinic()
  const nomeClinica = clinic?.nome ?? 'nossa clínica'
  const [tab, setTab] = useState<Tab>('aniversariantes')
  const [patients, setPatients] = useState<Patient[]>([])
  const [ultimaVisita, setUltimaVisita] = useState<Map<string, string>>(new Map())
  const [temFutura, setTemFutura] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function load() {
      const [ps, appts] = await Promise.all([listPatients(), listAppointments()])
      setPatients(ps)
      const agoraIso = new Date().toISOString()
      const ultima = new Map<string, string>()
      const futura = new Set<string>()
      for (const a of appts) {
        if (!a.patient_id) continue
        if (a.status === 'realizado') {
          const cur = ultima.get(a.patient_id)
          if (!cur || a.inicio > cur) ultima.set(a.patient_id, a.inicio)
        }
        if ((a.status === 'agendado' || a.status === 'confirmado') && a.inicio >= agoraIso) futura.add(a.patient_id)
      }
      setUltimaVisita(ultima)
      setTemFutura(futura)
    }
    load().catch(() => {}).finally(() => setCarregando(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Relacionamento</h1>
      <p className="mt-1 text-sm text-texto/60">Aniversariantes e reativação de pacientes inativos</p>

      <div className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-black/5">
        {([['aniversariantes', 'Aniversariantes'], ['inativos', 'Inativos']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-primaria text-primaria' : 'text-texto/60 hover:text-texto'}`}>
            {l}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="p-6 text-sm text-texto/50">Carregando…</p>
      ) : tab === 'aniversariantes' ? (
        <Aniversariantes patients={patients} nomeClinica={nomeClinica} />
      ) : (
        <Inativos patients={patients} ultimaVisita={ultimaVisita} temFutura={temFutura} nomeClinica={nomeClinica} />
      )}
    </div>
  )
}

function Aniversariantes({ patients, nomeClinica }: { patients: Patient[]; nomeClinica: string }) {
  const hoje = localDateToday()
  const mesAtual = Number(hoje.slice(5, 7)) - 1
  const diaAtual = hoje.slice(5, 10) // MM-DD
  const anoAtual = Number(hoje.slice(0, 4))
  const [mes, setMes] = useState(mesAtual)

  const lista = useMemo(() => {
    const mm = String(mes + 1).padStart(2, '0')
    return patients
      .filter((p) => p.nascimento && p.nascimento.slice(5, 7) === mm)
      .map((p) => ({
        p,
        dia: p.nascimento!.slice(8, 10),
        mmdd: p.nascimento!.slice(5, 10),
        faz: anoAtual - Number(p.nascimento!.slice(0, 4)),
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia))
  }, [patients, mes, anoAtual])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <span className="text-sm text-texto/60">{lista.length} aniversariante{lista.length === 1 ? '' : 's'}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                <th className="px-4 py-2 font-medium">Dia</th>
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-4 py-2 font-medium">Faz</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ p, mmdd, faz }) => {
                const ehHoje = mmdd === diaAtual
                const msg = `Feliz aniversário, ${primeiroNome(p.nome)}! 🎉 Toda a equipe da ${nomeClinica} deseja um dia maravilhoso. 💚`
                const link = linkWhatsApp(p.whatsapp, msg)
                return (
                  <tr key={p.id} className={`border-t border-black/5 ${ehHoje ? 'bg-primaria/5' : ''}`}>
                    <td className="px-4 py-2 text-texto/70">
                      {formatDateBR(p.nascimento)?.slice(0, 5)}
                      {ehHoje && <span className="ml-2 rounded-full bg-primaria px-2 py-0.5 text-[10px] font-semibold text-white">hoje</span>}
                    </td>
                    <td className="px-4 py-2 text-texto">{p.nome}</td>
                    <td className="px-4 py-2 text-texto/70">{faz > 0 && faz < 130 ? `${faz} anos` : '—'}</td>
                    <td className="px-4 py-2 text-texto/60">{p.whatsapp ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {link ? (
                        <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90">Parabenizar</a>
                      ) : <span className="text-xs text-texto/40">sem WhatsApp</span>}
                    </td>
                  </tr>
                )
              })}
              {lista.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-texto/50">Nenhum aniversariante em {MESES[mes]}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Inativos({ patients, ultimaVisita, temFutura, nomeClinica }: {
  patients: Patient[]
  ultimaVisita: Map<string, string>
  temFutura: Set<string>
  nomeClinica: string
}) {
  const [meses, setMeses] = useState(6)
  const [busca, setBusca] = useState('')

  const lista = useMemo(() => {
    const corte = new Date(); corte.setMonth(corte.getMonth() - meses)
    const corteIso = corte.toISOString()
    const termo = busca.trim().toLowerCase()
    return patients
      .filter((p) => {
        if (temFutura.has(p.id)) return false // tem consulta futura marcada → não é inativo
        const ult = ultimaVisita.get(p.id)
        return !ult || ult < corteIso
      })
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
      .map((p) => ({ p, ult: ultimaVisita.get(p.id) ?? null }))
      .sort((a, b) => {
        // Nunca atendidos por último; entre os com visita, mais antigos primeiro.
        if (!a.ult && !b.ult) return a.p.nome.localeCompare(b.p.nome)
        if (!a.ult) return 1
        if (!b.ult) return -1
        return a.ult.localeCompare(b.ult)
      })
  }, [patients, ultimaVisita, temFutura, meses, busca])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-texto/60">Sem atendimento há</label>
        <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
          <option value={24}>24 meses</option>
        </select>
        <input className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" placeholder="Buscar paciente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-sm text-texto/60">{lista.length} paciente{lista.length === 1 ? '' : 's'}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-4 py-2 font-medium">Última visita</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ p, ult }) => {
                const msg = `Olá, ${primeiroNome(p.nome)}! Sentimos sua falta na ${nomeClinica}. Que tal agendar um horário? Estamos com novidades para você. 💚`
                const link = linkWhatsApp(p.whatsapp, msg)
                return (
                  <tr key={p.id} className="border-t border-black/5">
                    <td className="px-4 py-2 text-texto">{p.nome}</td>
                    <td className="px-4 py-2 text-texto/70">{ult ? formatDateBR(ult.slice(0, 10)) : <span className="text-texto/40">nunca atendido</span>}</td>
                    <td className="px-4 py-2 text-texto/60">{p.whatsapp ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {link ? (
                        <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90">Reativar</a>
                      ) : <span className="text-xs text-texto/40">sem WhatsApp</span>}
                    </td>
                  </tr>
                )
              })}
              {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-texto/50">Nenhum paciente inativo neste período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-texto/50">Considera como inativo quem não tem atendimento <strong>realizado</strong> no período e não possui consulta futura agendada.</p>
    </div>
  )
}
