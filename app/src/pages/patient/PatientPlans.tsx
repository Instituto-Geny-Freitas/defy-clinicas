import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { acknowledgePlan, listPatientPlans, type TreatmentPlan } from '@/lib/treatmentPlans'
import { formatDateBR } from '@/lib/format'

export default function PatientPlans() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const [planos, setPlanos] = useState<TreatmentPlan[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<TreatmentPlan | null>(null)

  function recarregar() {
    if (!patientId) return
    listPatientPlans(patientId).then(setPlanos).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Meu Plano de Tratamento</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Planos enviados pela clínica. Confirme a ciência para a equipe.</p>

      {planos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhum plano no momento.
        </p>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => (
            <button
              key={p.id}
              onClick={() => setAberto(p)}
              className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white p-4 text-left hover:bg-black/[0.02]"
            >
              <div>
                <div className="text-sm font-medium text-texto">{p.titulo || 'Plano de tratamento'}</div>
                <div className="text-xs text-texto/50">{formatDateBR(p.data)}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'consentido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {p.status === 'consentido' ? 'Ciente' : 'A confirmar'}
              </span>
            </button>
          ))}
        </div>
      )}

      {aberto && <PlanViewer plano={aberto} onClose={() => setAberto(null)} onDone={() => { setAberto(null); recarregar() }} />}
    </div>
  )
}

function PlanViewer({ plano, onClose, onDone }: { plano: TreatmentPlan; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth()
  const jaConcluido = plano.status === 'consentido'
  const [aceito, setAceito] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setSalvando(true); setErro(null)
    try {
      await acknowledgePlan(plano, { nome: profile?.patient?.nome, cpf: profile?.patient?.cpf })
      onDone()
    } catch { setErro('Não foi possível registrar a ciência.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-texto">{plano.titulo || 'Plano de tratamento'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <p className="whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm text-texto/80">{plano.texto}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-texto/50">
          {plano.num_sessoes != null && <span>{plano.num_sessoes} sessões</span>}
          {plano.frequencia && <span>{plano.frequencia}</span>}
        </div>

        {jaConcluido ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Ciência registrada{plano.consentido_em && ` em ${new Date(plano.consentido_em).toLocaleString('pt-BR')}`}.
            {plano.assinatura_hash && <div className="mt-1 break-all text-[10px] text-emerald-700/70">Autenticação: {plano.assinatura_hash.slice(0, 24)}…</div>}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2 text-sm text-texto/80">
              <input type="checkbox" className="mt-0.5" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              <span>Li e estou ciente do plano de tratamento proposto.</span>
            </label>
            {erro && <p className="text-sm text-secundaria">{erro}</p>}
            <button
              onClick={confirmar}
              disabled={!aceito || salvando}
              className="w-full rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Registrando…' : 'Confirmar ciência'}
            </button>
            <p className="text-center text-[11px] text-texto/40">Ao confirmar, registramos data, hora e um código de autenticidade do seu aceite.</p>
          </div>
        )}
      </div>
    </div>
  )
}
