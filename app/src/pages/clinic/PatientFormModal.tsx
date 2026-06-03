import { useEffect, useState, type FormEvent } from 'react'
import {
  calcAge,
  createPatient,
  gerarSenhaProvisoria,
  provisionPatientAccess,
  updatePatient,
  type PatientInput,
} from '@/lib/patients'
import { getClinic } from '@/lib/settings'
import type { Patient } from '@/lib/types'

interface Props {
  clinicId: string
  patient?: Patient | null // presente = edição
  onClose: () => void
  onSaved: (id: string) => void
}

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function PatientFormModal({ clinicId, patient, onClose, onSaved }: Props) {
  const editando = !!patient
  const [form, setForm] = useState<PatientInput>({
    nome: patient?.nome ?? '',
    cpf: patient?.cpf ?? '',
    nascimento: patient?.nascimento ?? '',
    email: patient?.email ?? '',
    whatsapp: patient?.whatsapp ?? '',
    profissao: patient?.profissao ?? '',
    estilo_trabalho: patient?.estilo_trabalho ?? '',
    alergias: patient?.alergias ?? '',
  })
  const [consentido, setConsentido] = useState(!!patient?.consentimento_lgpd_em)
  const [lgpd, setLgpd] = useState<{ texto: string; versao: string }>({ texto: '', versao: '1' })
  const [senhaAcesso, setSenhaAcesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [provisionando, setProvisionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // resultado do provisionamento (mostra login + senha para entregar ao paciente)
  const [resultado, setResultado] = useState<{ id: string; login: string; senha: string; aviso?: string } | null>(null)

  useEffect(() => {
    setSenhaAcesso(gerarSenhaProvisoria())
    getClinic()
      .then((c) => {
        const l = (c?.dados_empresa as { lgpd?: { texto?: string; versao?: string } })?.lgpd
        setLgpd({
          texto: l?.texto || 'Autorizo o tratamento dos meus dados pessoais e de saúde para fins do meu atendimento, nos termos da Lei 13.709/2018 (LGPD).',
          versao: l?.versao || '1',
        })
      })
      .catch(() => {})
  }, [editando])

  function set<K extends keyof PatientInput>(k: K, v: PatientInput[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const idade = calcAge(form.nascimento)

  async function handleRedefinirAcesso() {
    if (!patient) return
    if (!patient.cpf && !patient.email) { setErro('O paciente precisa de CPF ou e-mail para ter login.'); return }
    if (senhaAcesso.length < 6) { setErro('A senha de acesso deve ter ao menos 6 caracteres.'); return }
    setProvisionando(true)
    setErro(null)
    try {
      const { login } = await provisionPatientAccess(patient.id, senhaAcesso)
      setResultado({ id: patient.id, login, senha: senhaAcesso })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível redefinir o acesso.')
      setProvisionando(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome.'); return }
    if (!editando) {
      if (!form.cpf?.trim() && !form.email?.trim()) { setErro('Informe CPF ou e-mail (necessário para o login).'); return }
      if (senhaAcesso.length < 6) { setErro('A senha de acesso deve ter ao menos 6 caracteres.'); return }
    }
    setSalvando(true)
    setErro(null)
    const consentPatch =
      consentido && !patient?.consentimento_lgpd_em
        ? { consentimento_lgpd_em: new Date().toISOString(), consentimento_lgpd_versao: lgpd.versao }
        : !consentido && patient?.consentimento_lgpd_em
          ? { consentimento_lgpd_em: null, consentimento_lgpd_versao: null }
          : {}
    try {
      if (editando && patient) {
        await updatePatient(patient.id, { ...form, ...consentPatch })
        onSaved(patient.id)
        return
      }
      // criação + provisionamento de acesso
      const p = await createPatient(clinicId, form)
      if (Object.keys(consentPatch).length) await updatePatient(p.id, consentPatch)
      try {
        const { login } = await provisionPatientAccess(p.id, senhaAcesso)
        setResultado({ id: p.id, login, senha: senhaAcesso })
      } catch (err) {
        setResultado({
          id: p.id,
          login: form.cpf?.replace(/\D/g, '') || form.email || '',
          senha: senhaAcesso,
          aviso: 'Paciente criado, mas o acesso ainda não foi provisionado (publique a Edge Function provision-patient-access). Use depois "Editar → Redefinir acesso".',
        })
      }
      setSalvando(false)
    } catch {
      setErro('Não foi possível salvar (CPF duplicado? migrations aplicadas?).')
      setSalvando(false)
    }
  }

  // Tela de confirmação com as credenciais para entregar ao paciente
  if (resultado) {
    return (
      <Shell titulo="Acesso do paciente" onClose={() => onSaved(resultado.id)}>
        <p className="text-sm text-texto/70">Entregue estas credenciais ao paciente. No primeiro acesso por senha, ele será obrigado a definir uma nova.</p>
        <div className="mt-3 space-y-2 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm">
          <div><span className="text-texto/50">Login:</span> <strong className="text-texto">{resultado.login}</strong></div>
          <div><span className="text-texto/50">Senha provisória:</span> <strong className="text-texto">{resultado.senha}</strong></div>
        </div>
        {resultado.aviso && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">{resultado.aviso}</p>}
        <div className="mt-5 flex justify-end">
          <button onClick={() => onSaved(resultado.id)} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Concluir</button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell titulo={editando ? 'Editar paciente' : 'Novo paciente'} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-texto/70">Nome completo *</label>
          <input className={field} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Data de nascimento</label>
          <input type="date" className={field} value={form.nascimento ?? ''} onChange={(e) => set('nascimento', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Idade (automática)</label>
          <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-texto/70">{idade != null ? `${idade} anos` : '—'}</div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">CPF</label>
          <input className={field} value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">WhatsApp</label>
          <input className={field} value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">E-mail</label>
          <input className={field} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Profissão</label>
          <input className={field} value={form.profissao ?? ''} onChange={(e) => set('profissao', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-texto/70">Estilo de trabalho</label>
          <div className="flex gap-4 py-1 text-sm">
            {[{ v: 'sentado', l: 'Sentado' }, { v: 'em_pe_ativo', l: 'Em pé / Ativo' }].map((o) => (
              <label key={o.v} className="flex items-center gap-1.5">
                <input type="radio" checked={form.estilo_trabalho === o.v} onChange={() => set('estilo_trabalho', o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-texto/70">Alergias</label>
          <input className={field} value={form.alergias ?? ''} onChange={(e) => set('alergias', e.target.value)} />
        </div>

        {/* Acesso do paciente */}
        <div className="sm:col-span-2 rounded-xl border border-primaria/20 bg-primaria/5 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-texto/80">Acesso ao sistema</span>
            {editando && (
              <span className={`text-xs ${patient?.auth_user_id ? 'text-emerald-600' : 'text-texto/50'}`}>
                {patient?.auth_user_id ? 'login ativo' : 'sem login'}
              </span>
            )}
          </div>
          <p className="mb-2 text-xs text-texto/60">
            {editando
              ? patient?.auth_user_id
                ? 'Redefina a senha de acesso — o paciente será obrigado a trocá-la no próximo login por senha.'
                : 'Este paciente ainda não tem login. Provisione o acesso definindo uma senha.'
              : 'Senha provisória — o paciente será obrigado a trocá-la no 1º acesso. (Login por Google não exige senha.)'}
          </p>
          <div className="flex gap-2">
            <input className={field} value={senhaAcesso} onChange={(e) => setSenhaAcesso(e.target.value)} />
            <button type="button" onClick={() => setSenhaAcesso(gerarSenhaProvisoria())} className="shrink-0 rounded-lg border border-black/10 px-3 text-sm hover:bg-black/5">Gerar</button>
          </div>
          {editando && (
            <button
              type="button"
              onClick={handleRedefinirAcesso}
              disabled={provisionando}
              className="mt-2 rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {provisionando ? 'Processando…' : patient?.auth_user_id ? 'Redefinir senha de acesso' : 'Provisionar acesso'}
            </button>
          )}
        </div>

        {/* Consentimento LGPD */}
        <div className="sm:col-span-2 rounded-xl border border-black/5 bg-black/[0.02] p-3">
          <div className="mb-1 text-sm font-medium text-texto/80">Consentimento LGPD (versão {lgpd.versao})</div>
          <p className="mb-2 text-xs text-texto/60">{lgpd.texto}</p>
          <label className="flex items-start gap-2 text-sm text-texto/80">
            <input type="checkbox" className="mt-0.5" checked={consentido} onChange={(e) => setConsentido(e.target.checked)} />
            <span>Consentimento obtido do paciente para tratamento de dados.</span>
          </label>
          {patient?.consentimento_lgpd_em && (
            <p className="mt-1 text-xs text-emerald-600">Consentido em {new Date(patient.consentimento_lgpd_em).toLocaleString('pt-BR')} (v{patient.consentimento_lgpd_versao})</p>
          )}
        </div>

        {erro && <p className="text-sm text-secundaria sm:col-span-2">{erro}</p>}

        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button type="submit" disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </Shell>
  )
}

function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
