import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { getLgpdConfig, recordConsent, type LgpdConfig } from '@/lib/lgpd'

export default function PatientLgpd() {
  const { profile, reloadProfile } = useAuth()
  const patient = profile?.patient
  const [cfg, setCfg] = useState<LgpdConfig | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { getLgpdConfig().then(setCfg).catch(() => {}) }, [])

  const consentidoVersao = patient?.consentimento_lgpd_versao
  const jaConsentiuVersaoAtual = !!patient?.consentimento_lgpd_em && consentidoVersao === cfg?.versao

  async function confirmar() {
    if (!patient || !cfg) return
    setEnviando(true); setMsg(null)
    try {
      await recordConsent({ patientId: patient.id, clinicId: patient.clinic_id, versao: cfg.versao, origem: 'paciente' })
      await reloadProfile()
      setMsg('Ciência registrada. Obrigado!')
    } catch {
      setMsg('Não foi possível registrar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Privacidade e LGPD</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Leia o termo de tratamento de dados e confirme sua ciência.</p>

      {!cfg ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : (
        <>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-texto/40">Termo (versão {cfg.versao})</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-texto/80">{cfg.texto}</p>
          </div>

          {patient?.consentimento_lgpd_em && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Você confirmou em {new Date(patient.consentimento_lgpd_em).toLocaleString('pt-BR')}
              {consentidoVersao ? ` (versão ${consentidoVersao})` : ''}.
            </div>
          )}

          {jaConsentiuVersaoAtual ? (
            <p className="mt-3 text-sm text-texto/60">Ciência já registrada para a versão atual do termo.</p>
          ) : (
            <button onClick={confirmar} disabled={enviando} className="mt-4 w-full rounded-lg bg-primaria px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {enviando ? 'Registrando…' : patient?.consentimento_lgpd_em ? 'Reconfirmar ciência (nova versão)' : 'Li e confirmo minha ciência'}
            </button>
          )}
          {msg && <p className="mt-2 text-sm text-texto/70">{msg}</p>}
        </>
      )}
    </div>
  )
}
