import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  createAppointment,
  createRecurringAppointments,
  deleteAppointment,
  deleteAppointmentSeries,
  linkAppointmentsToPatient,
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

export default function Agenda() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [appts, setAppts] = useState<Appointment[]>([])
  const [profissionais, setProfissionais] = useState<Professional[]>([])
  const [pacientes, setPacientes] = useState<Patient[]>([])
  // Agenda individualizada: por padrão mostra a do profissional logado.
  const [filtroProf, setFiltroProf] = useState(profile?.professional?.id ?? '')
  const [filtroPac, setFiltroPac] = useState('')        // id do paciente selecionado
  const [buscaPac, setBuscaPac] = useState('')          // texto digitado na busca
  const [dataFiltro, setDataFiltro] = useState<string | null>(null) // YYYY-MM-DD
  const [mostrarCal, setMostrarCal] = useState(false)
  const [diasComAgenda, setDiasComAgenda] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [remarcando, setRemarcando] = useState<Appointment | null>(null)
  const [serieDe, setSerieDe] = useState<Appointment | null>(null)
  const [regularizando, setRegularizando] = useState<Appointment | null>(null)

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
  useEffect(() => { listProfessionals().then((p) => setProfissionais(p.filter((x) => x.ativo))).catch(() => {}) }, [])
  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])

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

  const grupos = appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dia = a.inicio.slice(0, 10)
    ;(acc[dia] ??= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-texto">Agenda</h1>
        <div className="flex items-center gap-2">
          <select value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria">
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
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

      {/* Busca por data + calendário visual */}
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
      {mostrarCal && (
        <div className="mt-3 max-w-sm">
          <MonthCalendar value={dataFiltro} onChange={(d) => { setDataFiltro(d); setMostrarCal(false) }} marcados={diasComAgenda} />
          <p className="mt-1 text-xs text-texto/40">• dias com agendamento marcados</p>
        </div>
      )}

      {modal && clinicId && (
        <AgendamentoModal clinicId={clinicId} profissionais={profissionais} defaultProf={profile?.professional?.id} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar(); carregarMarcados() }} />
      )}
      {remarcando && (
        <RemarcarModal appt={remarcando} onClose={() => setRemarcando(null)} onSaved={() => { setRemarcando(null); recarregar(); carregarMarcados() }} />
      )}
      {serieDe && (
        <SerieModal appt={serieDe} profissionais={profissionais} onClose={() => setSerieDe(null)} onSaved={() => { setSerieDe(null); recarregar(); carregarMarcados() }} />
      )}
      {regularizando && (
        <RegularizarModal appt={regularizando} onClose={() => setRegularizando(null)} onSaved={() => { setRegularizando(null); recarregar(); carregarMarcados() }} />
      )}

      {carregando ? (
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
                      </div>
                    </div>
                    <ApptStatusBadge status={a.status} />
                    <div className="flex flex-wrap gap-1 text-xs">
                      {!a.patient_id && (
                        <button onClick={() => setRegularizando(a)} className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100">Regularizar</button>
                      )}
                      {a.status !== 'cancelado' && a.status !== 'realizado' && (
                        <>
                          {a.status === 'agendado' && (
                            <button onClick={() => mudarStatus(a.id, 'confirmado')} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                          )}
                          <button onClick={() => setRemarcando(a)} className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-700 hover:bg-sky-100">Remarcar</button>
                          <button onClick={() => mudarStatus(a.id, 'realizado')} className="rounded-md bg-black/5 px-2 py-1 font-medium text-texto/70 hover:bg-black/10">Realizado</button>
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
    </div>
  )
}

function AgendamentoModal({ clinicId, profissionais, defaultProf, onClose, onSaved }: {
  clinicId: string; profissionais: Professional[]; defaultProf?: string | null; onClose: () => void; onSaved: () => void
}) {
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [semCadastro, setSemCadastro] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [nomeAvulso, setNomeAvulso] = useState('')
  const [telefoneAvulso, setTelefoneAvulso] = useState('')
  const [professionalId, setProfessionalId] = useState(defaultProf ?? '')
  const [procedimento, setProcedimento] = useState('')
  const [data, setData] = useState<string | null>(null)
  const [horaInicio, setHoraInicio] = useState('09:00')
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
    const comum = {
      clinicId,
      patientId: semCadastro ? null : patientId,
      nomeAvulso: semCadastro ? nomeAvulso.trim() : null,
      telefoneAvulso: semCadastro ? telefoneAvulso.trim() : null,
      professionalId: professionalId || null,
      procedimento,
      observacoes: obs,
    }
    try {
      if (recorrente) {
        const n = await createRecurringAppointments({ ...comum, date: data, horaInicio, horaFim: horaFim || null, periodo, ateAno })
        if (n === 0) { setErro('Nenhuma data gerada — verifique o período e o ano.'); setSalvando(false); return }
      } else {
        await createAppointment({ ...comum, inicio: toISO(data, horaInicio), fim: horaFim ? toISO(data, horaFim) : null })
      }
      onSaved()
    } catch { setErro('Não foi possível agendar.'); setSalvando(false) }
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
    try { await linkAppointmentsToPatient(sel, [appt.id]); onSaved() } catch { setBusy(false) }
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
