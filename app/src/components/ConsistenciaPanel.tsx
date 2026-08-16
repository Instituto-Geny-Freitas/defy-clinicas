import { useEffect, useState } from 'react'
import { listSupplementations } from '@/lib/supplementations'
import { listProcedures } from '@/lib/procedures'
import { carregarVinculoCtx, diagnosticar, type Achado } from '@/lib/vinculoFinanceiro'

const CHIP: Record<Achado['severidade'], string> = {
  erro: 'bg-rose-100 text-rose-700',
  atencao: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
}
const LABEL: Record<Achado['severidade'], string> = { erro: 'Erro', atencao: 'Atenção', info: 'Info' }

/**
 * Verificação de consistência clínico-financeira do paciente: mostra vínculos
 * quebrados, planos/pacotes sem orçamento, marcações de pagamento divergentes
 * e avulsos pendentes — coisas que as telas normais não deixam ver.
 */
export default function ConsistenciaPanel({ patientId }: { patientId: string }) {
  const [achados, setAchados] = useState<Achado[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function verificar() {
    setCarregando(true)
    try {
      const [ctx, suplementacoes, procedimentos] = await Promise.all([
        carregarVinculoCtx(patientId),
        listSupplementations(patientId),
        listProcedures(patientId),
      ])
      setAchados(diagnosticar({ ctx, suplementacoes, procedimentos }))
    } catch { setAchados([]) } finally { setCarregando(false) }
  }
  useEffect(() => { verificar() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (achados === null && !carregando) return null
  const erros = (achados ?? []).filter((a) => a.severidade === 'erro').length
  const total = achados?.length ?? 0

  return (
    <div className={`mb-4 rounded-xl border p-3 ${erros > 0 ? 'border-rose-200 bg-rose-50/50' : total > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <strong className="text-texto">Verificação de consistência</strong>
          <span className="ml-2 text-texto/60">
            {carregando ? 'analisando…'
              : total === 0 ? 'nenhuma inconsistência encontrada entre plano, pacote, orçamento e atendimentos.'
                : `${total} ponto(s)${erros > 0 ? ` · ${erros} erro(s)` : ''}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={verificar} className="font-medium text-texto/60 hover:underline">Reverificar</button>
          {total > 0 && (
            <button onClick={() => setAberto((v) => !v)} className="font-medium text-primaria hover:underline">
              {aberto ? 'Ocultar' : 'Ver detalhes'}
            </button>
          )}
        </div>
      </div>

      {aberto && total > 0 && (
        <ul className="mt-3 space-y-2">
          {(achados ?? []).map((a, i) => (
            <li key={`${a.registroId}-${i}`} className="rounded-lg border border-black/5 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHIP[a.severidade]}`}>{LABEL[a.severidade]}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-texto/60">
                  {a.origem === 'suplementacao' ? 'Suplementação' : 'Procedimento'}
                </span>
                <span className="font-medium text-texto">{a.titulo}</span>
              </div>
              <p className="mt-1 text-texto/70">{a.detalhe}</p>
              <p className="mt-0.5 text-xs text-texto/50">→ {a.comoResolver}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
