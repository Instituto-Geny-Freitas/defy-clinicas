import { useEffect, useMemo, useState } from 'react'
import { useClinic } from '@/theme/ThemeProvider'
import { comArtigo, formatDateBR, localDateToday } from '@/lib/format'
import type { Patient } from '@/lib/types'
import {
  calcNps, getNpsConfig, listNpsPeriodo, npsCsv, npsPorMes, NPS_DEFAULT,
  type NpsConfig, type NpsResponse,
} from '@/lib/nps'
import { buildNpsPdf } from '@/lib/npsPdf'

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]
function linkWhatsApp(numero: string | null | undefined, msg: string): string | null {
  const d = (numero ?? '').replace(/\D/g, '')
  return d ? `https://wa.me/55${d}?text=${encodeURIComponent(msg)}` : null
}
const ymdMenos = (dias: number) => {
  const d = new Date(); d.setDate(d.getDate() - dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Painel consolidado de NPS (equipe): indicadores do período, evolução mensal,
 * respostas (com as perguntas adicionais), exportação CSV/PDF e o convite
 * ativo por WhatsApp para quem já foi atendido e ainda não respondeu.
 */
export default function NpsPanel({ patients, ultimaVisita, nomeClinica }: {
  patients: Patient[]
  /** patient_id -> data do último atendimento realizado (ISO). */
  ultimaVisita: Map<string, string>
  nomeClinica: string
}) {
  const clinic = useClinic()
  const [cfg, setCfg] = useState<NpsConfig>({ ...NPS_DEFAULT })
  const [de, setDe] = useState(ymdMenos(90))
  const [ate, setAte] = useState(localDateToday())
  const [rs, setRs] = useState<NpsResponse[]>([])
  const [carregando, setCarregando] = useState(true)
  const [verConvites, setVerConvites] = useState(false)

  useEffect(() => { getNpsConfig().then(setCfg).catch(() => {}) }, [])
  useEffect(() => {
    setCarregando(true)
    listNpsPeriodo(de || null, ate || null).then(setRs).catch(() => {}).finally(() => setCarregando(false))
  }, [de, ate])

  const c = calcNps(rs)
  const meses = useMemo(() => npsPorMes(rs), [rs])
  const pct = (n: number) => (c.total > 0 ? Math.round((n / c.total) * 100) : 0)
  const npsCor = c.nps >= 50 ? 'text-emerald-600' : c.nps >= 0 ? 'text-amber-600' : 'text-secundaria'
  const periodoLabel = `${formatDateBR(de)} a ${formatDateBR(ate)}`

  // Elegíveis ao convite: já atendidos e sem resposta dentro da periodicidade.
  const respondeuRecente = useMemo(() => {
    const limite = Date.now() - cfg.periodicidadeDias * 86400000
    const s = new Set<string>()
    for (const r of rs) if (new Date(r.created_at).getTime() >= limite) s.add(r.patient_id)
    return s
  }, [rs, cfg.periodicidadeDias])
  const elegiveis = patients.filter((p) => ultimaVisita.has(p.id) && !respondeuRecente.has(p.id))

  function baixarCsv() {
    // BOM para o Excel abrir os acentos corretamente.
    const blob = new Blob(['﻿' + npsCsv(rs, cfg.perguntas)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `NPS ${de} a ${ate}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const atalho = (dias: number | null, label: string) => (
    <button key={label} onClick={() => { setDe(dias == null ? '2000-01-01' : ymdMenos(dias)); setAte(localDateToday()) }}
      className="rounded-md bg-black/5 px-2.5 py-1 text-xs font-semibold text-texto/70 hover:bg-black/10">{label}</button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="mb-1 block text-xs text-texto/60">De</label><input type="date" className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs text-texto/60">Até</label><input type="date" className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="flex gap-1 pb-2">{atalho(30, '30 dias')}{atalho(90, '90 dias')}{atalho(365, '12 meses')}{atalho(null, 'Tudo')}</div>
        <div className="ml-auto flex gap-2 pb-1">
          <button onClick={baixarCsv} disabled={rs.length === 0} className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40">Exportar CSV</button>
          <button onClick={() => buildNpsPdf({ clinic, respostas: rs, perguntas: cfg.perguntas, periodoLabel })} disabled={rs.length === 0}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40">PDF</button>
        </div>
      </div>

      {!cfg.ativo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          A pesquisa está <strong>desativada</strong> — os pacientes não a veem no portal. Ative em <strong>Configurações → NPS</strong>.
        </p>
      )}

      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : c.total === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma resposta neste período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ['NPS', String(c.nps), npsCor],
              ['Respostas', String(c.total), 'text-texto'],
              ['Promotores (9-10)', `${c.promotores} · ${pct(c.promotores)}%`, 'text-emerald-600'],
              ['Passivos (7-8)', `${c.passivos} · ${pct(c.passivos)}%`, 'text-amber-600'],
              ['Detratores (0-6)', `${c.detratores} · ${pct(c.detratores)}%`, c.detratores > 0 ? 'text-secundaria' : 'text-primaria'],
            ] as [string, string, string][]).map(([l, v, cor]) => (
              <div key={l} className="rounded-xl border border-black/5 bg-white p-4">
                <div className="text-xs text-texto/50">{l}</div>
                <div className={`mt-1 text-xl font-semibold ${cor}`}>{v}</div>
              </div>
            ))}
          </div>

          {meses.length > 1 && (
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-texto/70">Evolução mensal</h3>
              <div className="space-y-1">
                {meses.map((m) => {
                  const [ano, mes] = m.mes.split('-')
                  return (
                    <div key={m.mes} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-texto/60">{mes}/{ano}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/5">
                        <div className={`h-full rounded-full ${m.nps >= 0 ? 'bg-emerald-500' : 'bg-secundaria'}`} style={{ width: `${Math.min(100, Math.abs(m.nps))}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right font-medium text-texto/70">{m.nps}</span>
                      <span className="w-16 shrink-0 text-right text-texto/40">{m.total} resp.</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
                <th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Nota</th><th className="px-3 py-2 font-medium">Comentário</th>
                {cfg.perguntas.map((q) => <th key={q.id} className="px-3 py-2 font-medium">{q.label}</th>)}
              </tr></thead>
              <tbody>
                {rs.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="whitespace-nowrap px-3 py-1.5 text-texto/60">{formatDateBR(r.created_at.slice(0, 10))}</td>
                    <td className="px-3 py-1.5 text-texto/80">{r.patients?.nome ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${r.score >= 9 ? 'bg-emerald-100 text-emerald-700' : r.score >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{r.score}</span>
                    </td>
                    <td className="px-3 py-1.5 text-texto/70">{r.comentario ?? '—'}</td>
                    {cfg.perguntas.map((q) => <td key={q.id} className="px-3 py-1.5 text-texto/70">{String(r.respostas?.[q.id] ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Convite ativo por WhatsApp (a pesquisa é respondida no portal) */}
      <div className="rounded-xl border border-black/5 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-texto/70">Convidar para a pesquisa</h3>
            <p className="text-xs text-texto/50">
              {elegiveis.length} paciente(s) já atendidos e sem resposta nos últimos {cfg.periodicidadeDias} dias.
              O convite abre o WhatsApp com a mensagem pronta; a resposta é dada no portal.
            </p>
          </div>
          <button onClick={() => setVerConvites((v) => !v)} className="rounded-lg border border-primaria px-3 py-1.5 text-sm font-semibold text-primaria hover:bg-primaria/5">
            {verConvites ? 'Ocultar' : 'Ver lista'}
          </button>
        </div>
        {verConvites && (
          <div className="mt-3 divide-y divide-black/5">
            {elegiveis.length === 0 && <p className="text-xs text-texto/40">Ninguém pendente por agora.</p>}
            {elegiveis.map((p) => {
              const msg = `Olá, ${primeiroNome(p.nome)}! Sua opinião é muito importante ${comArtigo(nomeClinica, 'de')}. Pode responder nossa pesquisa rápida (leva 1 minuto) no portal do paciente? 💚`
              const link = linkWhatsApp(p.whatsapp ?? p.telefone, msg)
              const visita = ultimaVisita.get(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate text-texto/80">
                    {p.nome}
                    {visita && <span className="ml-2 text-xs text-texto/40">último atendimento {formatDateBR(visita.slice(0, 10))}</span>}
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Convidar</a>
                  ) : (
                    <span className="shrink-0 text-xs text-texto/40">sem WhatsApp</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
