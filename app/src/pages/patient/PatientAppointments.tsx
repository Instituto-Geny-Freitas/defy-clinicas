import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listPatientAppointments, requestAppointment, type Appointment } from '@/lib/appointments'
import { checkSlot, SLOT_MENSAGEM, type SlotStatus } from '@/lib/availability'
import { listPublicProfessionals, type PublicProfessional } from '@/lib/patients'
import ApptStatusBadge from '@/components/ApptStatusBadge'
import MonthCalendar from '@/components/MonthCalendar'

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function PatientAppointments() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const patient = profile?.patient
  const patientId = patient?.id
  const [appts, setAppts] = useState<Appointment[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  function recarregar() {
    if (!patientId) return
    listPatientAppointments(patientId).then(setAppts).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  const wpp = clinic?.whatsapp?.replace(/\D/g, '')

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-texto">Meus Agendamentos</h1>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">+ Solicitar</button>
      </div>
      <p className="mt-1 mb-4 text-sm text-texto/60">Suas consultas e sessões. Solicitações são confirmadas pela clínica.</p>

      {modal && patient && (
        <SolicitarModal clinicId={patient.clinic_id} patientId={patient.id} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />
      )}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : appts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma consulta agendada.</p>
      ) : (
        <div className="space-y-2">
          {appts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-4">
              <div>
                <div className="text-sm font-medium capitalize text-texto">{quando(a.inicio)}</div>
                <div className="text-xs text-texto/60">{a.procedimento ?? 'Atendimento'}</div>
              </div>
              <ApptStatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}

      {wpp && (
        <a
          href={`https://wa.me/55${wpp}?text=${encodeURIComponent('Olá! Gostaria de agendar/remarcar um horário.')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-xl border border-primaria/30 px-4 py-3 text-center text-sm font-semibold text-primaria"
        >
          Falar pelo WhatsApp
        </a>
      )}
    </div>
  )
}

function SolicitarModal({ clinicId, patientId, onClose, onSaved }: { clinicId: string; patientId: string; onClose: () => void; onSaved: () => void }) {
  const [profissionais, setProfissionais] = useState<PublicProfessional[]>([])
  const [professionalId, setProfessionalId] = useState('')
  const [data, setData] = useState<string | null>(null)
  const [hora, setHora] = useState('09:00')
  const [procedimento, setProcedimento] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotStatus | null>(null)
  const [checando, setChecando] = useState(false)

  useEffect(() => {
    listPublicProfessionals().then((lista) => {
      setProfissionais(lista)
      // Se há apenas um profissional, seleciona automaticamente
      if (lista.length === 1) setProfessionalId(lista[0].id)
    }).catch(() => {})
  }, [])

  // Verifica disponibilidade sempre que profissional + data + hora mudarem.
  useEffect(() => {
    setSlot(null)
    if (!professionalId || !data || !hora) return
    let cancelado = false
    setChecando(true)
    const inicio = new Date(`${data}T${hora}:00`).toISOString()
    checkSlot(professionalId, inicio).then((s) => { if (!cancelado) setSlot(s) }).catch(() => {}).finally(() => { if (!cancelado) setChecando(false) })
    return () => { cancelado = true }
  }, [professionalId, data, hora])

  async function salvar() {
    if (!data) { setErro('Escolha uma data.'); return }
    if (!professionalId) { setErro('Selecione a profissional desejada.'); return }
    const inicio = new Date(`${data}T${hora}:00`).toISOString()
    setErro(null)
    // Bloqueia se o horário não estiver disponível para o profissional escolhido.
    if (professionalId) {
      try {
        const s = await checkSlot(professionalId, inicio)
        if (s !== 'ok') { setSlot(s); setErro(SLOT_MENSAGEM[s] + ' Escolha outro horário.'); return }
      } catch { /* se falhar a checagem, segue (a clínica confirma) */ }
    }
    setSalvando(true)
    try {
      await requestAppointment({
        clinicId, patientId, professionalId: professionalId || null, inicio,
        procedimento: procedimento || null, observacoes: obs || null,
      })
      onSaved()
    } catch { setErro('Não foi possível enviar a solicitação.'); setSalvando(false) }
  }

  const slotCor = slot === 'ok' ? 'text-emerald-600' : 'text-rose-600'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Solicitar horário</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Profissional</label>
            <select className={field} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              {profissionais.length > 1 && <option value="">Selecione a profissional…</option>}
              {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <MonthCalendar value={data} onChange={setData} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-texto/70">Horário preferido</label><input type="time" className={field} value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Procedimento</label><input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} /></div>
          </div>
          {professionalId && data && (
            <p className={`text-sm font-medium ${checando ? 'text-texto/50' : slotCor}`}>
              {checando ? 'Verificando disponibilidade…' : slot ? (slot === 'ok' ? '✓ ' : '⚠ ') + SLOT_MENSAGEM[slot] : ''}
            </p>
          )}
          <div><label className="mb-1 block text-sm text-texto/70">Observações</label><textarea rows={2} className={field} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          {erro && <p className="text-sm text-secundaria">{erro}</p>}
          <p className="text-xs text-texto/50">A clínica confirmará (ou ajustará) o horário solicitado.</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando || (!!professionalId && slot != null && slot !== 'ok')} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Enviando…' : 'Solicitar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
