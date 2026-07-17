import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { listProfessionals } from '@/lib/settings'
import {
  convertLeadToPatient, createLead, deleteLead, listLeads, moveLeadEtapa, updateLead,
  ETAPAS, FUNIL, ORIGENS, type Lead, type LeadEtapa, type LeadInput,
} from '@/lib/crm'
import { brl } from '@/lib/finance'
import { formatDateBR, localDateToday } from '@/lib/format'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const labelDe = (e: LeadEtapa) => ETAPAS.find((x) => x.key === e)?.label ?? e

export default function CRM() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id ?? ''
  const [leads, setLeads] = useState<Lead[]>([])
  const [profs, setProfs] = useState<{ id: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<Lead | 'novo' | null>(null)
  const [busca, setBusca] = useState('')

  function recarregar() { listLeads().then(setLeads).catch(() => {}).finally(() => setCarregando(false)) }
  useEffect(recarregar, [])
  useEffect(() => { listProfessionals().then((ps) => setProfs(ps.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome })))).catch(() => {}) }, [])

  const hoje = localDateToday()
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? leads.filter((l) => `${l.nome} ${l.interesse ?? ''} ${l.origem ?? ''}`.toLowerCase().includes(t)) : leads
  }, [leads, busca])

  const abertos = leads.filter((l) => l.etapa !== 'ganho' && l.etapa !== 'perdido')
  const ganhos = leads.filter((l) => l.etapa === 'ganho').length
  const perdidos = leads.filter((l) => l.etapa === 'perdido').length
  const pipeline = abertos.reduce((s, l) => s + Number(l.valor_estimado), 0)
  const conversao = ganhos + perdidos > 0 ? Math.round((ganhos / (ganhos + perdidos)) * 100) : 0

  async function avancar(l: Lead) {
    const i = FUNIL.indexOf(l.etapa)
    if (i < 0 || i >= FUNIL.length - 1) return
    await moveLeadEtapa(l.id, FUNIL[i + 1]).catch(() => {})
    recarregar()
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Comercial</h1>
          <p className="mt-1 text-sm text-texto/60">Funil de vendas — do lead ao fechamento</p>
        </div>
        <button onClick={() => setModal('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo lead</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Em aberto" valor={String(abertos.length)} />
        <Kpi label="Valor em pipeline" valor={brl(pipeline)} cor="text-primaria" />
        <Kpi label="Ganhos" valor={String(ganhos)} cor="text-emerald-600" />
        <Kpi label="Conversão" valor={`${conversao}%`} cor={conversao >= 50 ? 'text-emerald-600' : 'text-amber-600'} />
      </div>

      <div className="mt-4">
        <input className="w-64 max-w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" placeholder="🔍 Buscar lead…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-texto/50">Carregando…</p>
      ) : (
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {ETAPAS.map((et) => {
              const doEtapa = filtrados.filter((l) => l.etapa === et.key)
              const soma = doEtapa.reduce((s, l) => s + Number(l.valor_estimado), 0)
              return (
                <div key={et.key} className="w-64 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-sm font-semibold text-texto/70">{et.label}</span>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/60">{doEtapa.length}</span>
                  </div>
                  <div className="space-y-2">
                    {doEtapa.map((l) => {
                      const atrasado = l.proxima_acao && l.proxima_acao <= hoje
                      const podeAvancar = FUNIL.indexOf(l.etapa) >= 0 && FUNIL.indexOf(l.etapa) < FUNIL.length - 1
                      return (
                        <div key={l.id} className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
                          <button onClick={() => setModal(l)} className="block w-full text-left">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-texto">{l.nome}</span>
                              {Number(l.valor_estimado) > 0 && <span className="shrink-0 text-xs font-medium text-texto/60">{brl(Number(l.valor_estimado))}</span>}
                            </div>
                            {l.interesse && <div className="mt-0.5 text-xs text-texto/60">{l.interesse}</div>}
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                              {l.origem && <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-texto/60">{l.origem}</span>}
                              {l.professionals?.nome && <span className="text-texto/40">· {l.professionals.nome}</span>}
                              {l.proxima_acao && <span className={atrasado ? 'text-secundaria' : 'text-texto/40'}>· follow-up {formatDateBR(l.proxima_acao)}</span>}
                              {l.patient_id && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">paciente</span>}
                            </div>
                          </button>
                          {podeAvancar && (
                            <button onClick={() => avancar(l)} className="mt-2 w-full rounded-md bg-primaria/10 px-2 py-1 text-xs font-medium text-primaria hover:bg-primaria/20">
                              Avançar → {labelDe(FUNIL[FUNIL.indexOf(l.etapa) + 1])}
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {doEtapa.length === 0 && <p className="rounded-lg border border-dashed border-black/10 p-3 text-center text-[11px] text-texto/30">—</p>}
                    {soma > 0 && <p className="px-1 pt-1 text-[11px] text-texto/40">Σ {brl(soma)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal && (
        <LeadModal
          clinicId={clinicId}
          lead={modal === 'novo' ? null : modal}
          profs={profs}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); recarregar() }}
        />
      )}
    </div>
  )
}

function Kpi({ label, valor, cor = 'text-texto' }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className={`text-xl font-semibold ${cor}`}>{valor}</div>
      <div className="text-xs text-texto/60">{label}</div>
    </div>
  )
}

function LeadModal({ clinicId, lead, profs, onClose, onSaved }: {
  clinicId: string; lead: Lead | null; profs: { id: string; nome: string }[]; onClose: () => void; onSaved: () => void
}) {
  const editar = !!lead
  const navigate = useNavigate()
  const [f, setF] = useState<LeadInput>({
    nome: lead?.nome ?? '', whatsapp: lead?.whatsapp ?? '', email: lead?.email ?? '',
    origem: lead?.origem ?? '', interesse: lead?.interesse ?? '', etapa: lead?.etapa ?? 'novo',
    responsavel_id: lead?.responsavel_id ?? '', valor_estimado: lead?.valor_estimado ?? 0,
    proxima_acao: lead?.proxima_acao ?? '', observacoes: lead?.observacoes ?? '', motivo_perda: lead?.motivo_perda ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function salvar() {
    if (!f.nome?.trim()) { setErro('Informe o nome do lead.'); return }
    setErro(null); setSalvando(true)
    try {
      if (lead) await updateLead(lead.id, f)
      else await createLead(clinicId, f)
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar.'); setSalvando(false) }
  }
  async function converter() {
    if (!lead) return
    if (!confirm(`Converter "${lead.nome}" em paciente? Será criado o cadastro do paciente (sem login), e o lead marcado como Ganho.`)) return
    setSalvando(true)
    try {
      const pid = await convertLeadToPatient(clinicId, lead)
      navigate(`/clinica/pacientes/${pid}`)
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível converter (e-mail já cadastrado?).'); setSalvando(false) }
  }
  async function excluir() {
    if (!lead || !confirm('Excluir este lead?')) return
    await deleteLead(lead.id).catch(() => {})
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar lead' : 'Novo lead'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Nome *</label>
            <input className={field} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">WhatsApp</label><input className={field} value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">E-mail</label><input className={field} value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Origem</label>
            <select className={field} value={f.origem ?? ''} onChange={(e) => set('origem', e.target.value)}>
              <option value="">—</option>
              {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Interesse</label><input className={field} value={f.interesse ?? ''} onChange={(e) => set('interesse', e.target.value)} placeholder="Ex.: Botox, pacote…" /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Etapa</label>
            <select className={field} value={f.etapa} onChange={(e) => set('etapa', e.target.value as LeadEtapa)}>
              {ETAPAS.map((et) => <option key={et.key} value={et.key}>{et.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Responsável</label>
            <select className={field} value={f.responsavel_id ?? ''} onChange={(e) => set('responsavel_id', e.target.value)}>
              <option value="">—</option>
              {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Valor estimado (R$)</label><input type="number" step="0.01" min={0} className={field} value={f.valor_estimado ?? 0} onChange={(e) => set('valor_estimado', Number(e.target.value))} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Próximo follow-up</label><input type="date" className={field} value={f.proxima_acao ?? ''} onChange={(e) => set('proxima_acao', e.target.value)} /></div>
          {f.etapa === 'perdido' && (
            <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Motivo da perda</label><input className={field} value={f.motivo_perda ?? ''} onChange={(e) => set('motivo_perda', e.target.value)} placeholder="Ex.: preço, foi para concorrente…" /></div>
          )}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></div>
        </div>

        {lead?.patient_id && (
          <button onClick={() => navigate(`/clinica/pacientes/${lead.patient_id}`)} className="mt-3 text-sm font-medium text-primaria hover:underline">Ver paciente vinculado →</button>
        )}
        {erro && <p className="mt-3 text-sm text-secundaria">{erro}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {editar && !lead?.patient_id && (
              <button onClick={converter} disabled={salvando} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Converter em paciente</button>
            )}
            {editar && <button onClick={excluir} className="rounded-lg px-3 py-2 text-sm font-medium text-secundaria hover:bg-secundaria/10">Excluir</button>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
