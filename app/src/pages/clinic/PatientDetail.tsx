import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient, calcAge } from '@/lib/patients'
import { formatDateBR } from '@/lib/format'
import { listConsentLogs, type ConsentLog } from '@/lib/lgpd'
import PatientFormModal from './PatientFormModal'
import { useAuth } from '@/auth/AuthProvider'
import type { Patient } from '@/lib/types'
import AnamnesisForm from '@/forms/AnamnesisForm'
import AssessmentForm from '@/forms/AssessmentForm'
import type { AssessmentType } from '@/lib/assessments'
import DocumentsPanel from './DocumentsPanel'
import ProceduresPanel from './ProceduresPanel'
import FinancePanel from './FinancePanel'
import PhotosPanel from './PhotosPanel'
import TreatmentPlansPanel from './TreatmentPlansPanel'
import SupplementationsPanel from './SupplementationsPanel'
import FormulationsPanel from './FormulationsPanel'
import LabsPanel from './LabsPanel'
import MeasurementsPanel from './MeasurementsPanel'
import PatientReportsPanel from './PatientReportsPanel'

type Aba =
  | 'resumo' | 'anamnese' | 'avaliacoes' | 'plano' | 'procedimentos' | 'medidas'
  | 'suplementacao' | 'manipulacao' | 'exames' | 'fotos' | 'documentos' | 'financeiro' | 'relatorios'

const ABAS: { key: Aba; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'anamnese', label: 'Anamnese' },
  { key: 'avaliacoes', label: 'Avaliações' },
  { key: 'plano', label: 'Plano' },
  { key: 'procedimentos', label: 'Procedimentos' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'suplementacao', label: 'Suplementação' },
  { key: 'manipulacao', label: 'Manipulação' },
  { key: 'exames', label: 'Exames' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'relatorios', label: 'Relatórios' },
]

const TIPOS_AVALIACAO: { key: AssessmentType; label: string }[] = [
  { key: 'dermato', label: 'Dermato Funcional' },
  { key: 'capilar', label: 'Capilar' },
  { key: 'corporal', label: 'Corporal' },
]

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [paciente, setPaciente] = useState<Patient | null>(null)
  const [aba, setAba] = useState<Aba>('resumo')
  const [tipoAval, setTipoAval] = useState<AssessmentType>('dermato')
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [consentLogs, setConsentLogs] = useState<ConsentLog[]>([])

  function recarregar() {
    if (!id) return
    getPatient(id)
      .then(setPaciente)
      .catch(() => {})
      .finally(() => setCarregando(false))
    listConsentLogs(id).then(setConsentLogs).catch(() => {})
  }
  useEffect(recarregar, [id])

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>
  if (!paciente) return <p className="text-sm text-texto/50">Paciente não encontrado.</p>

  return (
    <div>
      <Link to="/clinica/pacientes" className="text-sm text-primaria hover:underline">
        ← Pacientes
      </Link>
      <div className="mt-1 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">{paciente.nome}</h1>
          <p className="text-sm text-texto/60">
            {paciente.cpf ?? 'CPF não informado'} · {paciente.whatsapp ?? 'sem WhatsApp'}
          </p>
        </div>
        <button onClick={() => setEditando(true)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5">
          Editar
        </button>
      </div>

      {editando && (
        <PatientFormModal
          clinicId={paciente.clinic_id}
          patient={paciente}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); recarregar() }}
        />
      )}

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/5">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
              aba === a.key
                ? 'border-primaria font-semibold text-primaria'
                : 'border-transparent text-texto/60 hover:text-texto'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {aba === 'resumo' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Data de nascimento" valor={paciente.nascimento ? formatDateBR(paciente.nascimento) : null} />
            <Info label="Idade" valor={calcAge(paciente.nascimento) != null ? `${calcAge(paciente.nascimento)} anos` : null} />
            <Info label="CPF" valor={paciente.cpf} />
            <Info label="E-mail" valor={paciente.email} />
            <Info label="WhatsApp" valor={paciente.whatsapp} />
            <Info label="Profissão" valor={paciente.profissao} />
            <Info label="Estilo de trabalho" valor={paciente.estilo_trabalho === 'sentado' ? 'Sentado' : paciente.estilo_trabalho === 'em_pe_ativo' ? 'Em pé / Ativo' : null} />
            <Info label="Alergias" valor={paciente.alergias} />
            <Info
              label="Consentimento LGPD"
              valor={paciente.consentimento_lgpd_em ? `Sim — ${new Date(paciente.consentimento_lgpd_em).toLocaleString('pt-BR')} (v${paciente.consentimento_lgpd_versao ?? '?'})` : 'Pendente'}
            />
            {consentLogs.length > 0 && (
              <div className="rounded-xl border border-black/5 bg-white p-4 sm:col-span-2 lg:col-span-3">
                <div className="text-xs uppercase tracking-wide text-texto/40">Histórico de consentimento LGPD</div>
                <ul className="mt-2 space-y-1 text-sm text-texto/70">
                  {consentLogs.map((l) => (
                    <li key={l.id}>
                      {new Date(l.created_at).toLocaleString('pt-BR')} — versão {l.versao ?? '?'} · por {l.origem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {aba === 'anamnese' && (
          <AnamnesisForm
            patientId={paciente.id}
            clinicId={paciente.clinic_id}
            professionalId={profile?.professional?.id}
            preenchidoPor="profissional"
          />
        )}

        {aba === 'avaliacoes' && (
          <div>
            <div className="mb-4 inline-flex rounded-lg bg-black/5 p-1 text-sm">
              {TIPOS_AVALIACAO.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTipoAval(t.key)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    tipoAval === t.key ? 'bg-white font-medium text-texto shadow-sm' : 'text-texto/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <AssessmentForm
              key={tipoAval}
              patientId={paciente.id}
              clinicId={paciente.clinic_id}
              professionalId={profile?.professional?.id}
              tipo={tipoAval}
            />
          </div>
        )}
        {aba === 'procedimentos' && (
          <ProceduresPanel
            patientId={paciente.id}
            clinicId={paciente.clinic_id}
            professionalId={profile?.professional?.id}
          />
        )}
        {aba === 'plano' && <TreatmentPlansPanel patientId={paciente.id} clinicId={paciente.clinic_id} professionalId={profile?.professional?.id} />}
        {aba === 'medidas' && <MeasurementsPanel patientId={paciente.id} clinicId={paciente.clinic_id} professionalId={profile?.professional?.id} />}
        {aba === 'suplementacao' && <SupplementationsPanel patientId={paciente.id} clinicId={paciente.clinic_id} professionalId={profile?.professional?.id} />}
        {aba === 'manipulacao' && <FormulationsPanel patientId={paciente.id} clinicId={paciente.clinic_id} professionalId={profile?.professional?.id} pacienteNome={paciente.nome} pacienteWhatsapp={paciente.whatsapp} />}
        {aba === 'exames' && <LabsPanel patientId={paciente.id} clinicId={paciente.clinic_id} professionalId={profile?.professional?.id} />}
        {aba === 'fotos' && (
          <PhotosPanel
            patientId={paciente.id}
            clinicId={paciente.clinic_id}
            professionalId={profile?.professional?.id}
          />
        )}
        {aba === 'documentos' && (
          <DocumentsPanel
            patient={paciente}
            clinicId={paciente.clinic_id}
            professionalId={profile?.professional?.id}
          />
        )}
        {aba === 'financeiro' && (
          <FinancePanel
            patientId={paciente.id}
            clinicId={paciente.clinic_id}
            professionalId={profile?.professional?.id}
          />
        )}
        {aba === 'relatorios' && <PatientReportsPanel patientId={paciente.id} />}
      </div>
    </div>
  )
}

function Info({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-texto/40">{label}</div>
      <div className="mt-1 text-sm text-texto">{valor || '—'}</div>
    </div>
  )
}
