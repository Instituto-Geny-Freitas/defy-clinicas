import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import {
  createAppointment,
  createRecurringAppointments,
  deleteAppointment,
  deleteAppointmentSeries,
  linkAppointmentsToPatient,
  linkByNomeAvulso,
  linkGroupToPatient,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentSeries,
  updateAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
  type ApptPeriodo,
} from '@/lib/appointments'
import { checkSlot, SLOT_MENSAGEM } from '@/lib/availability'
import { listPatients } from '@/lib/patients'
import { listProfessionals } from '@/lib/settings'
import { listResources, resourceConflict, type Resource } from '@/lib/resources'
import { addWaitlist, countWaitlist, deleteWaitlist, listWaitlist, updateWaitlistStatus, type WaitlistEntry } from '@/lib/waitlist'
import type { Patient, Professional } from '@/lib/types'
import ApptStatusBadge from '@/components/ApptStatusBadge'
import MonthCalendar from '@/components/MonthCalendar'

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

/** Combina data (YYYY-MM-DD) + hora (HH:MM) em ISO. */
function toISO(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString()
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Domingo da semana que contém a data (YYYY-MM-DD). */
function inicioSemanaYmd(baseYmd: string): string {
  const [y, m, d] = baseYmd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - dt.getDay())
  return ymd(dt)
}
function addDaysYmdLocal(baseYmd: string, n: number): string {
  const [y, m, d] = baseYmd.split('-').map(Number)
  return ymd(new Date(y, m - 1, d + n))
}
// Grade semanal: faixa de horas exibida e escala (px por minuto).
const HH_INI = 7, HH_FIM = 21, PX_MIN = 0.8
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Agenda() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const clinicId = profile?.professional?.clinic_id
  const [searchParams, setSearchParams] = useSearchParams()
  const [appts, setAppts] = useState<Appointment[]>([])
  const [profissionais, setProfissionais] = useState<Professional[]>([])
  const [pacientes, setPacientes] = useState<Patient[]>([])
  // Agenda individualizada: por padrão mostra a do profissional logado.
  const [filtroProf, setFiltroProf] = useState(profile?.professional?.id ?? '')
  const [filtroPac, setFiltroPac] = useState('')        // id do paciente selecionado
  const [buscaPac, setBuscaPac] = useState('')          // texto digitado na busca
  // Aceita atalho ?data=hoje | YYYY-MM-DD (ex.: card "Consultas hoje" do Dashboard).
  const [dataFiltro, setDataFiltro] = useState<string | null>(() => {
    const d = searchParams.get('data')
    if (d === 'hoje') return ymd(new Date())
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }) // YYYY-MM-DD
  const [mostrarCal, setMostrarCal] = useState(false)
  const [diasComAgenda, setDiasComAgenda] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [remarcando, setRemarcando] = useState<Appointment | null>(null)
  const [serieDe, setSerieDe] = useState<Appointment | null>(null)
  const [regularizando, setRegularizando] = useState<Appointment | null>(null)
  const [recursos, setRecursos] = useState<Resource[]>([])
  const [waitCount, setWaitCount] = useState(0)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [preAgendar, setPreAgendar] = useState<WaitlistEntry | null>(null)
  const [vista, setVista] = useState<'lista' | 'semana'>('lista')
  const [semanaBase, setSemanaBase] = useState<string>(() => ymd(new Date()))
  const [weekAppts, setWeekAppts] = useState<Appointment[]>([])
  const [acoesDe, setAcoesDe] = useState<Appointment | null>(null)
  const [novoSlot, setNovoSlot] = useState<{ data: string; horaInicio: string } | null>(null)

  function recarregar() {
    let desde: string | undefined, ate: string | undefined
    if (dataFiltro) {
      desde = new Date(`${dataFiltro}T00:00:00`).toISOString()
      ate = new Date(`${dataFiltro}T23:59:59`).toISOString()
    } else if (!filtroPac) {
      // Sem paciente selecionado, mostra de ontem em diante; com paciente, mostra todo o histórico.
      desde = new Date(Date.now() - 86400000).toISOString()
    }
    listAppointments(desde, filtroProf || undefined, ate, filtroPac || undefined).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [filtroProf, filtroPac, dataFiltro])
  // Limpa o ?data= da URL depois de aplicado (o valor inicial já foi lido no useState).
  useEffect(() => { if (searchParams.get('data')) setSearchParams({}, { replace: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listProfessionals().then((p) => setProfissionais(p.filter((x) => x.ativo))).catch(() => {}) }, [])
  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])
  useEffect(() => { listResources().then((rs) => setRecursos(rs.filter((r) => r.ativo))).catch(() => {}) }, [])
  function carregarWait() { countWaitlist().then(setWaitCount).catch(() => {}) }
  useEffect(carregarWait, [])

  // Resolve o texto digitado para o id do paciente (casamento exato pelo nome).
  function aplicarBuscaPac(texto: string) {
    setBuscaPac(texto)
    const achado = pacientes.find((p) => p.nome.toLowerCase() === texto.trim().toLowerCase())
    setFiltroPac(achado ? achado.id : '')
  }
  function limparPac() { setBuscaPac(''); setFiltroPac('') }
  const pacienteSel = pacientes.find((p) => p.id === filtroPac) ?? null

  // Marca no calendário os dias que têm agendamento (janela ampla, independe do filtro).
  function carregarMarcados() {
    const desde = new Date(Date.now() - 31 * 86400000).toISOString()
    listAppointments(desde, filtroProf || undefined)
      .then((all) => setDiasComAgenda(new Set(all.map((a) => a.inicio.slice(0, 10)))))
      .catch(() => {})
  }
  useEffect(carregarMarcados, [filtroProf])

  function carregarSemana() {
    const ini = inicioSemanaYmd(semanaBase)
    const desde = new Date(`${ini}T00:00:00`).toISOString()
    const ate = new Date(`${addDaysYmdLocal(ini, 7)}T00:00:00`).toISOString()
    listAppointments(desde, filtroProf || undefined, ate).then(setWeekAppts).catch(() => {})
  }
  useEffect(() => { if (vista === 'semana') carregarSemana() }, [vista, semanaBase, filtroProf]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remarcarArrasto(a: Appointment, novoInicioIso: string) {
    const dur = a.fim ? new Date(a.fim).getTime() - new Date(a.inicio).getTime() : 0
    const novoFim = dur > 0 ? new Date(new Date(novoInicioIso).getTime() + dur).toISOString() : null
    if (!confirm(`Remarcar ${a.patients?.nome ?? a.nome_avulso ?? 'agendamento'} para ${new Date(novoInicioIso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}?`)) return
    await rescheduleAppointment(a.id, novoInicioIso, novoFim)
    carregarSemana(); carregarMarcados()
  }

  async function mudarStatus(id: string, status: AppointmentStatus) {
    await updateAppointmentStatus(id, status)
    recarregar()
    carregarMarcados()
  }

  async function excluir(a: Appointment) {
    const quem = a.patients?.nome ?? a.nome_avulso ?? 'paciente'
    if (!confirm(`Excluir o agendamento de ${quem} em ${new Date(a.inicio).toLocaleString('pt-BR')}?`)) return
    await deleteAppointment(a.id)
    recarregar()
    carregarMarcados()
  }

  // Lembrete de confirmação por WhatsApp (mensagem pronta, 1 clique).
  function lembrarWhatsApp(a: Appointment) {
    const tel = (a.patients?.whatsapp ?? a.telefone_avulso ?? '').replace(/\D/g, '')
    if (!tel) return
    const nome = (a.patients?.nome ?? a.nome_avulso ?? '').trim().split(/\s+/)[0]
    const quando = new Date(a.inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    const msg = `Olá${nome ? ', ' + nome : ''}! Passando para lembrar do seu horário na ${clinic?.nome ?? 'clínica'} em ${quando}${a.procedimento ? ` (${a.procedimento})` : ''}. Podemos confirmar sua presença? 💚`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }
  const temTelefone = (a: Appointment) => !!(a.patients?.whatsapp ?? a.telefone_avulso)

  const grupos = appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dia = a.inicio.slice(0, 10)
    ;(acc[dia] ??= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-texto">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-black/10 p-0.5 text-sm">
            <button onClick={() => setVista('lista')} className={`rounded-md px-3 py-1.5 ${vista === 'lista' ? 'bg-primaria text-white' : 'text-texto/60'}`}>Lista</button>
            <button onClick={() => setVista('semana')} className={`rounded-md px-3 py-1.5 ${vista === 'semana' ? 'bg-primaria text-white' : 'text-texto/60'}`}>Semana</button>
          </div>
          <select value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria">
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <button onClick={() => setWaitlistOpen(true)} className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5">
            Lista de espera{waitCount > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-700">{waitCount}</span>}
          </button>
          <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo</button>
        </div>
      </div>

      {/* Busca por paciente (mostra todas as agendas dele) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            list="agenda-pacientes"
            value={buscaPac}
            onChange={(e) => aplicarBuscaPac(e.target.value)}
            placeholder="🔍 Buscar paciente…"
            className="w-64 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          />
          <datalist id="agenda-pacientes">
            {pacientes.map((p) => <option key={p.id} value={p.nome} />)}
          </datalist>
        </div>
        {filtroPac && (
          <button onClick={limparPac} className="rounded-lg bg-black/5 px-3 py-2 text-sm text-texto/70 hover:bg-black/10">
            Limpar paciente
          </button>
        )}
        {filtroPac && pacienteSel && (
          <span className="rounded-full bg-primaria/10 px-3 py-1 text-xs font-medium text-primaria">
            Agendas de {pacienteSel.nome}
          </span>
        )}
      </div>

      {/* Busca por data + calendário visual (apenas na visão em lista) */}
      {vista === 'lista' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dataFiltro ?? ''}
            onChange={(e) => setDataFiltro(e.target.value || null)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          />
          <button onClick={() => setMostrarCal((v) => !v)} className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5">
            {mostrarCal ? 'Ocultar calendário' : '📅 Ver calendário'}
          </button>
          {dataFiltro && (
            <button onClick={() => { setDataFiltro(null); setMostrarCal(false) }} className="rounded-lg bg-black/5 px-3 py-2 text-sm text-texto/70 hover:bg-black/10">
              Limpar data
            </button>
          )}
        </div>
      )}
      {vista === 'lista' && mostrarCal && (
        <div className="mt-3 max-w-sm">
          <MonthCalendar value={dataFiltro} onChange={(d) => { setDataFiltro(d); setMostrarCal(false) }} marcados={diasComAgenda} />
          <p className="mt-1 text-xs text-texto/40">• dias com agendamento marcados</p>
        </div>
      )}

      {modal && clinicId && (
        <AgendamentoModal
          clinicId={clinicId}
          profissionais={profissionais}
          recursos={recursos}
          defaultProf={profile?.professional?.id}
          initial={preAgendar
            ? { patientId: preAgendar.patient_id, nomeAvulso: preAgendar.nome_avulso, telefoneAvulso: preAgendar.telefone_avulso, professionalId: preAgendar.professional_id, procedimento: preAgendar.procedimento }
            : novoSlot ? { data: novoSlot.data, horaInicio: novoSlot.horaInicio } : undefined}
          onClose={() => { setModal(false); setPreAgendar(null); setNovoSlot(null) }}
          onSaved={async () => {
            if (preAgendar) { await updateWaitlistStatus(preAgendar.id, 'agendado').catch(() => {}); setPreAgendar(null); carregarWait() }
            setModal(false); setNovoSlot(null); recarregar(); carregarMarcados(); if (vista === 'semana') carregarSemana()
          }}
        />
      )}
      {waitlistOpen && clinicId && (
        <WaitlistModal
          clinicId={clinicId}
          profissionais={profissionais}
          onClose={() => { setWaitlistOpen(false); carregarWait() }}
          onAgendar={(entry) => { setWaitlistOpen(false); setPreAgendar(entry); setModal(true) }}
        />
      )}
      {remarcando && (
        <RemarcarModal appt={remarcando} onClose={() => setRemarcando(null)} onSaved={() => { setRemarcando(null); recarregar(); carregarMarcados(); carregarSemana() }} />
      )}
      {serieDe && (
        <SerieModal appt={serieDe} profissionais={profissionais} onClose={() => setSerieDe(null)} onSaved={() => { setSerieDe(null); recarregar(); carregarMarcados(); carregarSemana() }} />
      )}
      {regularizando && (
        <RegularizarModal appt={regularizando} onClose={() => setRegularizando(null)} onSaved={() => { setRegularizando(null); recarregar(); carregarMarcados() }} />
      )}

      {vista === 'semana' ? (
        <SemanaGrade
          iniSemana={inicioSemanaYmd(semanaBase)}
          appts={weekAppts}
          onPrev={() => setSemanaBase(addDaysYmdLocal(semanaBase, -7))}
          onProx={() => setSemanaBase(addDaysYmdLocal(semanaBase, 7))}
          onHoje={() => setSemanaBase(ymd(new Date()))}
          onCriar={(dataYmd, horaIni) => { setNovoSlot({ data: dataYmd, horaInicio: horaIni }); setModal(true) }}
          onAbrir={(a) => setAcoesDe(a)}
          onSoltar={remarcarArrasto}
        />
      ) : carregando ? (
        <p className="mt-4 text-sm text-texto/50">Carregando…</p>
      ) : appts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          {pacienteSel
            ? `Nenhum agendamento para ${pacienteSel.nome}${dataFiltro ? ` em ${new Date(dataFiltro + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}.`
            : dataFiltro ? `Nenhum agendamento em ${new Date(dataFiltro + 'T12:00:00').toLocaleDateString('pt-BR')}.` : 'Nenhum agendamento.'}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grupos).map(([dia, lista]) => (
            <div key={dia}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-texto/70">{dataLonga(dia + 'T12:00:00')}</h2>
              <div className="space-y-2">
                {lista.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-white p-4">
                    <div className="w-14 text-center"><div className="text-lg font-semibold text-primaria">{hora(a.inicio)}</div></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-texto">{a.patients?.nome ?? a.nome_avulso ?? 'Paciente'}</span>
                        {!a.patient_id && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">cadastro pendente</span>}
                      </div>
                      <div className="text-sm text-texto/60">
                        {a.procedimento ?? 'Atendimento'}
                        {!a.patient_id && a.telefone_avulso && <span className="text-texto/40"> · 📞 {a.telefone_avulso}</span>}
                        {a.professionals?.nome && <span className="text-texto/40"> · {a.professionals.nome}</span>}
                        {a.resources?.nome && <span className="text-texto/40"> · 🚪 {a.resources.nome}</span>}
                      </div>
                    </div>
                    <ApptStatusBadge status={a.status} />
                    <div className="flex flex-wrap gap-1 text-xs">
                      {!a.patient_id && (
                        <button onClick={() => setRegularizando(a)} className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100">Regularizar</button>
                      )}
                      {a.status !== 'cancelado' && a.status !== 'realizado' && (
                        <>
                          {temTelefone(a) && (
                            <button onClick={() => lembrarWhatsApp(a)} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100" title="Enviar lembrete por WhatsApp">WhatsApp</button>
                          )}
                          {a.status === 'agendado' && (
                            <button onClick={() => mudarStatus(a.id, 'confirmado')} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                          )}
                          <button onClick={() => setRemarcando(a)} className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-700 hover:bg-sky-100">Remarcar</button>
                          <button onClick={() => mudarStatus(a.id, 'realizado')} className="rounded-md bg-black/5 px-2 py-1 font-medium text-texto/70 hover:bg-black/10">Realizado</button>
                          <button onClick={() => mudarStatus(a.id, 'faltou')} className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100">Faltou</button>
                          <button onClick={() => mudarStatus(a.id, 'cancelado')} className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700 hover:bg-rose-100">Cancelar</button>
                        </>
                      )}
                      {a.recorrencia_grupo && (
                        <button onClick={() => setSerieDe(a)} className="rounded-md bg-violet-50 px-2 py-1 font-medium text-violet-700 hover:bg-violet-100">Série ⋯</button>
                      )}
                      <button onClick={() => excluir(a)} className="rounded-md px-2 py-1 font-medium text-secundaria hover:bg-secundaria/10">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {acoesDe && (
        <Shell titulo="Agendamento" onClose={() => setAcoesDe(null)}>
          <div className="space-y-3">
            <div>
              <div className="font-medium text-texto">{acoesDe.patients?.nome ?? acoesDe.nome_avulso ?? 'Paciente'}</div>
              <div className="text-sm text-texto/60 capitalize">
                {new Date(acoesDe.inicio).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                {acoesDe.procedimento ? ` · ${acoesDe.procedimento}` : ''}
              </div>
              <div className="mt-1"><ApptStatusBadge status={acoesDe.status} /></div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {!acoesDe.patient_id && (
                <button onClick={() => { setRegularizando(acoesDe); setAcoesDe(null) }} className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-100">Regularizar</button>
              )}
              {temTelefone(acoesDe) && (
                <button onClick={() => lembrarWhatsApp(acoesDe)} className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100">WhatsApp</button>
              )}
              {acoesDe.status !== 'cancelado' && acoesDe.status !== 'realizado' && (
                <>
                  {acoesDe.status === 'agendado' && (
                    <button onClick={async () => { await mudarStatus(acoesDe.id, 'confirmado'); setAcoesDe(null); carregarSemana() }} className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                  )}
                  <button onClick={() => { setRemarcando(acoesDe); setAcoesDe(null) }} className="rounded-lg bg-sky-50 px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-100">Remarcar</button>
                  <button onClick={async () => { await mudarStatus(acoesDe.id, 'realizado'); setAcoesDe(null); carregarSemana() }} className="rounded-lg bg-black/5 px-3 py-1.5 font-medium text-texto/70 hover:bg-black/10">Realizado</button>
                  <button onClick={async () => { await mudarStatus(acoesDe.id, 'faltou'); setAcoesDe(null); carregarSemana() }} className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-100">Faltou</button>
                  <button onClick={async () => { await mudarStatus(acoesDe.id, 'cancelado'); setAcoesDe(null); carregarSemana() }} className="rounded-lg bg-rose-50 px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-100">Cancelar</button>
                </>
              )}
              {acoesDe.recorrencia_grupo && (
                <button onClick={() => { setSerieDe(acoesDe); setAcoesDe(null) }} className="rounded-lg bg-violet-50 px-3 py-1.5 font-medium text-violet-700 hover:bg-violet-100">Série ⋯</button>
              )}
              <button onClick={async () => { const alvo = acoesDe; setAcoesDe(null); await excluir(alvo); carregarSemana() }} className="rounded-lg px-3 py-1.5 font-medium text-secundaria hover:bg-secundaria/10">Excluir</button>
            </div>
          </div>
        </Shell>
      )}
    </div>
  )
}

// --- Grade semanal (visão visual da agenda) ---------------------------------
function SemanaGrade({ iniSemana, appts, onPrev, onProx, onHoje, onCriar, onAbrir, onSoltar }: {
  iniSemana: string
  appts: Appointment[]
  onPrev: () => void
  onProx: () => void
  onHoje: () => void
  onCriar: (dataYmd: string, horaIni: string) => void
  onAbrir: (a: Appointment) => void
  onSoltar: (a: Appointment, novoInicioIso: string) => void
}) {
  const drag = useRef<{ appt: Appointment; offsetMin: number } | null>(null)
  const dias = Array.from({ length: 7 }, (_, i) => addDaysYmdLocal(iniSemana, i))
  const bodyH = (HH_FIM - HH_INI) * 60 * PX_MIN
  const horas = Array.from({ length: HH_FIM - HH_INI + 1 }, (_, i) => HH_INI + i)
  const hojeStr = ymd(new Date())

  const cor = (s: AppointmentStatus) => (
    s === 'confirmado' ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
      : s === 'realizado' ? 'bg-black/5 border-black/10 text-texto/60'
        : s === 'faltou' ? 'bg-rose-100 border-rose-300 text-rose-800'
          : s === 'cancelado' ? 'bg-black/5 border-black/10 text-texto/40 line-through'
            : 'bg-amber-100 border-amber-300 text-amber-800'
  )

  function tempo(clientY: number, rect: DOMRect): { hh: string; mm: string } {
    let min = (clientY - rect.top) / PX_MIN + HH_INI * 60
    if (drag.current) min -= drag.current.offsetMin
    min = Math.max(HH_INI * 60, Math.min(HH_FIM * 60 - 15, Math.round(min / 15) * 15))
    return { hh: String(Math.floor(min / 60)).padStart(2, '0'), mm: String(min % 60).padStart(2, '0') }
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onPrev} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5">←</button>
        <button onClick={onHoje} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5">Hoje</button>
        <button onClick={onProx} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5">→</button>
        <span className="ml-2 text-sm text-texto/60">
          {new Date(dias[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {new Date(dias[6] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <div className="min-w-[720px]">
          <div className="flex border-b border-black/5">
            <div className="w-12 shrink-0" />
            {dias.map((d) => {
              const dt = new Date(d + 'T12:00:00')
              const ehHoje = d === hojeStr
              return (
                <div key={d} className={`flex-1 py-2 text-center text-xs font-medium ${ehHoje ? 'text-primaria' : 'text-texto/60'}`}>
                  {DIAS_SEMANA[dt.getDay()]} <span className={ehHoje ? 'rounded-full bg-primaria px-1.5 text-white' : ''}>{dt.getDate()}</span>
                </div>
              )
            })}
          </div>
          <div className="flex" style={{ height: bodyH }}>
            <div className="w-12 shrink-0">
              {horas.map((h) => (
                <div key={h} className="relative" style={{ height: 60 * PX_MIN }}>
                  <span className="absolute -top-2 right-1 text-[10px] text-texto/40">{String(h).padStart(2, '0')}h</span>
                </div>
              ))}
            </div>
            {dias.map((d) => {
              const doDia = appts.filter((a) => ymd(new Date(a.inicio)) === d)
              return (
                <div
                  key={d}
                  className="relative flex-1 border-l border-black/5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { if (!drag.current) return; const { hh, mm } = tempo(e.clientY, e.currentTarget.getBoundingClientRect()); const iso = new Date(`${d}T${hh}:${mm}:00`).toISOString(); const a = drag.current.appt; drag.current = null; onSoltar(a, iso) }}
                  onClick={(e) => { const { hh, mm } = tempo(e.clientY, e.currentTarget.getBoundingClientRect()); onCriar(d, `${hh}:${mm}`) }}
                >
                  {horas.map((h) => <div key={h} className="border-b border-black/5" style={{ height: 60 * PX_MIN }} />)}
                  {doDia.map((a) => {
                    const ini = new Date(a.inicio)
                    const minIni = ini.getHours() * 60 + ini.getMinutes() - HH_INI * 60
                    const dur = a.fim ? Math.max(15, (new Date(a.fim).getTime() - ini.getTime()) / 60000) : 30
                    const top = Math.max(0, Math.min(bodyH - 16, minIni * PX_MIN))
                    const h = Math.max(16, dur * PX_MIN)
                    return (
                      <button
                        key={a.id}
                        draggable
                        onDragStart={(e) => { drag.current = { appt: a, offsetMin: e.nativeEvent.offsetY / PX_MIN }; e.dataTransfer.effectAllowed = 'move' }}
                        onClick={(e) => { e.stopPropagation(); onAbrir(a) }}
                        className={`absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md border px-1 text-left leading-tight ${cor(a.status)}`}
                        style={{ top, height: h }}
                        title={`${hora(a.inicio)} · ${a.patients?.nome ?? a.nome_avulso ?? ''}`}
                      >
                        <div className="text-[10px] font-semibold">{hora(a.inicio)}</div>
                        <div className="truncate text-[10px]">{a.patients?.nome ?? a.nome_avulso ?? 'Paciente'}</div>
                        {a.procedimento && h > 34 && <div className="truncate text-[10px] opacity-80">{a.procedimento}</div>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-texto/40">Clique num horário vazio para agendar · clique num evento para ações · arraste para remarcar (confirma antes de gravar).</p>
    </div>
  )
}

interface PreAgendarInit { patientId?: string | null; nomeAvulso?: string | null; telefoneAvulso?: string | null; professionalId?: string | null; procedimento?: string | null; data?: string | null; horaInicio?: string | null }

function AgendamentoModal({ clinicId, profissionais, recursos, defaultProf, initial, onClose, onSaved }: {
  clinicId: string; profissionais: Professional[]; recursos: Resource[]; defaultProf?: string | null; initial?: PreAgendarInit; onClose: () => void; onSaved: () => void | Promise<void>
}) {
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [semCadastro, setSemCadastro] = useState(!!initial && !initial.patientId && !!initial.nomeAvulso)
  const [patientId, setPatientId] = useState(initial?.patientId ?? '')
  const [nomeAvulso, setNomeAvulso] = useState(initial?.nomeAvulso ?? '')
  const [telefoneAvulso, setTelefoneAvulso] = useState(initial?.telefoneAvulso ?? '')
  const [professionalId, setProfessionalId] = useState(initial?.professionalId ?? defaultProf ?? '')
  const [procedimento, setProcedimento] = useState(initial?.procedimento ?? '')
  const [resourceId, setResourceId] = useState('')
  const [data, setData] = useState<string | null>(initial?.data ?? null)
  const [horaInicio, setHoraInicio] = useState(initial?.horaInicio ?? '09:00')
  const [horaFim, setHoraFim] = useState('')
  const [obs, setObs] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [periodo, setPeriodo] = useState<ApptPeriodo>('semanal')
  const [ateAno, setAteAno] = useState(new Date().getFullYear())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])
  // Ao escolher a data, garante que "até o ano" não fique antes do ano da 1ª data.
  useEffect(() => { if (data) { const a = Number(data.slice(0, 4)); if (ateAno < a) setAteAno(a) } }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const anoBase = data ? Number(data.slice(0, 4)) : new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => anoBase + i)

  async function salvar() {
    if (semCadastro ? !nomeAvulso.trim() : !patientId) { setErro(semCadastro ? 'Informe o nome.' : 'Selecione o paciente.'); return }
    if (!data) { setErro('Escolha a data no calendário.'); return }
    setSalvando(true); setErro(null)
    // Conflito de horário com a agenda do profissional (a equipe pode sobrepor).
    if (professionalId) {
      try {
        const st = await checkSlot(professionalId, toISO(data, horaInicio), horaFim ? toISO(data, horaFim) : null)
        if (st !== 'ok' && !confirm(`${SLOT_MENSAGEM[st]} Deseja agendar mesmo assim?`)) { setSalvando(false); return }
      } catch { /* se a verificação falhar, segue o fluxo normal */ }
    }
    // Conflito de RECURSO (sala/equipamento): bloqueia de verdade — sem duplo-agendamento.
    if (resourceId && !recorrente) {
      try {
        const ocupado = await resourceConflict(resourceId, toISO(data, horaInicio), horaFim ? toISO(data, horaFim) : null)
        if (ocupado) { setErro('Este recurso já está reservado nesse horário. Escolha outro recurso ou horário.'); setSalvando(false); return }
      } catch { /* backstop no banco (exclusion constraint) */ }
    }
    const comum = {
      clinicId,
      patientId: semCadastro ? null : patientId,
      nomeAvulso: semCadastro ? nomeAvulso.trim() : null,
      telefoneAvulso: semCadastro ? telefoneAvulso.trim() : null,
      professionalId: professionalId || null,
      procedimento,
      observacoes: obs,
      resourceId: resourceId || null,
    }
    try {
      if (recorrente) {
        const n = await createRecurringAppointments({ ...comum, date: data, horaInicio, horaFim: horaFim || null, periodo, ateAno })
        if (n === 0) { setErro('Nenhuma data gerada — verifique o período e o ano.'); setSalvando(false); return }
      } else {
        await createAppointment({ ...comum, inicio: toISO(data, horaInicio), fim: horaFim ? toISO(data, horaFim) : null })
      }
      await onSaved()
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err?.code === '23P01' || /excl_appointments_resource/.test(err?.message ?? '')) {
        setErro('Este recurso já está reservado nesse horário. Escolha outro recurso ou horário.')
      } else setErro('Não foi possível agendar.')
      setSalvando(false)
    }
  }

  return (
    <Shell titulo="Novo agendamento" onClose={onClose}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <input type="checkbox" checked={semCadastro} onChange={(e) => setSemCadastro(e.target.checked)} />
          Paciente ainda sem cadastro (agendamento prévio)
        </label>
        {semCadastro ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-texto/70">Nome *</label><input className={field} value={nomeAvulso} onChange={(e) => setNomeAvulso(e.target.value)} placeholder="Nome do contato" /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Telefone</label><input className={field} value={telefoneAvulso} onChange={(e) => setTelefoneAvulso(e.target.value)} placeholder="WhatsApp/telefone" /></div>
            <p className="text-xs text-amber-700 sm:col-span-2">Ficará marcado como “cadastro pendente”. Ao cadastrar o paciente, há a opção de regularizar e vincular este agendamento.</p>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm text-texto/70">Paciente *</label>
            <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecione…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-texto/70">Profissional</label>
          <select className={field} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">— Não atribuído —</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        {recursos.length > 0 && (
          <div>
            <label className="mb-1 block text-sm text-texto/70">Recurso (sala/equipamento)</label>
            <select className={field} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome} ({r.tipo === 'sala' ? 'sala' : 'equip.'})</option>)}
            </select>
            {recorrente && resourceId && <p className="mt-1 text-xs text-amber-600">Em série, se algum horário do recurso conflitar, a série não é criada.</p>}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-texto/70">Procedimento</label>
          <input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Avaliação, Toxina…" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Data *</label>
          <MonthCalendar value={data} onChange={setData} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Início</label><input type="time" className={field} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Fim</label><input type="time" className={field} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
        </div>

        {/* Recorrência (apenas pelo profissional) */}
        <label className="flex items-center gap-2 text-sm text-texto/70">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Agendamento recorrente
        </label>
        {recorrente && (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-black/[0.02] p-3">
            <div>
              <label className="mb-1 block text-sm text-texto/70">Repetir</label>
              <select className={field} value={periodo} onChange={(e) => setPeriodo(e.target.value as ApptPeriodo)}>
                <option value="semanal">Semanalmente</option>
                <option value="quinzenal">Quinzenalmente</option>
                <option value="mensal">Mensalmente</option>
                <option value="anual">Anualmente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Até o ano (inclusive)</label>
              <select className={field} value={ateAno} onChange={(e) => setAteAno(Number(e.target.value))}>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <p className="col-span-2 text-xs text-texto/50">Cria a mesma consulta repetida no horário escolhido até 31/12/{ateAno}.</p>
          </div>
        )}

        <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        {erro && <p className="text-sm text-secundaria">{erro}</p>}
        <Footer onClose={onClose} onSave={salvar} disabled={salvando} label={salvando ? 'Salvando…' : 'Agendar'} />
      </div>
    </Shell>
  )
}

function WaitlistModal({ clinicId, profissionais, onClose, onAgendar }: {
  clinicId: string; profissionais: Professional[]; onClose: () => void; onAgendar: (e: WaitlistEntry) => void
}) {
  const [itens, setItens] = useState<WaitlistEntry[]>([])
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [semCadastro, setSemCadastro] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [nomeAvulso, setNomeAvulso] = useState('')
  const [telefoneAvulso, setTelefoneAvulso] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [procedimento, setProcedimento] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listWaitlist('aguardando').then(setItens).catch(() => {}) }
  useEffect(() => { recarregar(); listPatients().then(setPacientes).catch(() => {}) }, [])

  async function adicionar() {
    if (semCadastro ? !nomeAvulso.trim() : !patientId) return
    setSalvando(true)
    try {
      await addWaitlist({ clinicId, patientId: semCadastro ? null : patientId, nomeAvulso: semCadastro ? nomeAvulso.trim() : null, telefoneAvulso: semCadastro ? telefoneAvulso.trim() : null, professionalId: professionalId || null, procedimento: procedimento || null, observacoes: obs || null })
      setPatientId(''); setNomeAvulso(''); setTelefoneAvulso(''); setProcedimento(''); setObs('')
      recarregar()
    } finally { setSalvando(false) }
  }
  async function remover(e: WaitlistEntry) { await deleteWaitlist(e.id); recarregar() }

  return (
    <Shell titulo="Lista de espera" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-black/5 bg-black/[0.02] p-3">
          <label className="flex items-center gap-2 text-sm text-texto/70">
            <input type="checkbox" checked={semCadastro} onChange={(e) => setSemCadastro(e.target.checked)} /> Sem cadastro
          </label>
          {semCadastro ? (
            <div className="grid grid-cols-2 gap-2">
              <input className={field} placeholder="Nome" value={nomeAvulso} onChange={(e) => setNomeAvulso(e.target.value)} />
              <input className={field} placeholder="Telefone" value={telefoneAvulso} onChange={(e) => setTelefoneAvulso(e.target.value)} />
            </div>
          ) : (
            <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecione o paciente…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Procedimento (opcional)" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} />
            <select className={field} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Profissional (opcional)</option>
              {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <input className={field} placeholder="Observações (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
          <div className="flex justify-end">
            <button onClick={adicionar} disabled={salvando} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Adicionar à lista</button>
          </div>
        </div>
        {itens.length === 0 ? (
          <p className="text-sm text-texto/50">Ninguém na lista de espera.</p>
        ) : (
          <div className="space-y-2">
            {itens.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/5 p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-texto">{e.patients?.nome ?? e.nome_avulso ?? 'Paciente'}</div>
                  <div className="text-xs text-texto/50">{[e.procedimento, e.professionals?.nome, e.telefone_avulso].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => onAgendar(e)} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Agendar</button>
                  <button onClick={() => remover(e)} className="rounded-md px-2 py-1 text-xs font-medium text-secundaria hover:bg-secundaria/10">Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

function RemarcarModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<string | null>(appt.inicio.slice(0, 10))
  const [horaInicio, setHoraInicio] = useState(new Date(appt.inicio).toTimeString().slice(0, 5))
  const [horaFim, setHoraFim] = useState(appt.fim ? new Date(appt.fim).toTimeString().slice(0, 5) : '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!data) return
    setSalvando(true)
    try {
      await rescheduleAppointment(appt.id, toISO(data, horaInicio), horaFim ? toISO(data, horaFim) : null)
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <Shell titulo={`Remarcar — ${appt.patients?.nome ?? 'paciente'}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-texto/60">Atual: {new Date(appt.inicio).toLocaleString('pt-BR')}</p>
        <MonthCalendar value={data} onChange={setData} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Novo início</label><input type="time" className={field} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Novo fim</label><input type="time" className={field} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
        </div>
        <Footer onClose={onClose} onSave={salvar} disabled={salvando || !data} label={salvando ? 'Salvando…' : 'Remarcar'} />
      </div>
    </Shell>
  )
}

function SerieModal({ appt, profissionais, onClose, onSaved }: { appt: Appointment; profissionais: Professional[]; onClose: () => void; onSaved: () => void }) {
  const grupo = appt.recorrencia_grupo as string
  const [escopo, setEscopo] = useState<'todas' | 'futuras'>('futuras')
  const [procedimento, setProcedimento] = useState(appt.procedimento ?? '')
  const [professionalId, setProfessionalId] = useState(appt.professional_id ?? '')
  const [horaInicio, setHoraInicio] = useState(new Date(appt.inicio).toTimeString().slice(0, 5))
  const [horaFim, setHoraFim] = useState(appt.fim ? new Date(appt.fim).toTimeString().slice(0, 5) : '')
  const [busy, setBusy] = useState(false)
  const desde = () => (escopo === 'futuras' ? appt.inicio : undefined)

  async function salvarEdicao() {
    setBusy(true)
    try {
      await updateAppointmentSeries(grupo, {
        procedimento, professionalId: professionalId || null, horaInicio, horaFim: horaFim || null,
      }, desde())
      onSaved()
    } catch { setBusy(false) }
  }
  async function excluir() {
    const txt = escopo === 'futuras' ? 'esta e as próximas ocorrências' : 'TODAS as ocorrências'
    if (!confirm(`Excluir ${txt} desta série recorrente?`)) return
    setBusy(true)
    try { await deleteAppointmentSeries(grupo, desde()); onSaved() } catch { setBusy(false) }
  }

  return (
    <Shell titulo="Série recorrente" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg bg-violet-50 p-3 text-xs text-violet-800">
          Alterações abaixo valem para o escopo selecionado. A data de cada ocorrência é preservada; apenas o horário é reaplicado.
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Aplicar em</label>
          <select className={field} value={escopo} onChange={(e) => setEscopo(e.target.value as 'todas' | 'futuras')}>
            <option value="futuras">Esta e as próximas</option>
            <option value="todas">Todas as ocorrências</option>
          </select>
        </div>
        <div><label className="mb-1 block text-sm text-texto/70">Procedimento</label><input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} /></div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Profissional</label>
          <select className={field} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">— Não atribuído —</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-sm text-texto/70">Início</label><input type="time" className={field} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Fim</label><input type="time" className={field} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={excluir} disabled={busy} className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Excluir série</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvarEdicao} disabled={busy} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar série'}</button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function RegularizarModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])
  const filtrados = busca ? pacientes.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())) : pacientes

  async function vincular() {
    if (!sel) return
    setBusy(true)
    try {
      if (appt.recorrencia_grupo) {
        await linkGroupToPatient(sel, appt.recorrencia_grupo)
      } else {
        await linkAppointmentsToPatient(sel, [appt.id])
      }
      // Vincula TODOS os demais avulsos com o mesmo nome_avulso (grupos distintos ou sem grupo)
      if (appt.nome_avulso) await linkByNomeAvulso(sel, appt.nome_avulso)
      onSaved()
    } catch { setBusy(false) }
  }

  return (
    <Shell titulo="Regularizar agendamento" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-texto/60">
          Vincule este agendamento prévio (<strong>{appt.nome_avulso ?? 'sem nome'}</strong>
          {appt.telefone_avulso ? ` · ${appt.telefone_avulso}` : ''}) a um paciente já cadastrado.
        </p>
        <input className={field} placeholder="🔍 Buscar paciente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={field} size={6} value={sel} onChange={(e) => setSel(e.target.value)}>
          {filtrados.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cpf ? ` · ${p.cpf}` : ''}</option>)}
        </select>
        <p className="text-xs text-texto/50">Não encontrou? Cadastre o paciente em Pacientes → Novo e marque a regularização lá.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={vincular} disabled={busy || !sel} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? 'Vinculando…' : 'Vincular'}</button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Footer({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{label}</button>
    </div>
  )
}
