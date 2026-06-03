interface Ponto {
  rotulo: string
  valor: number
}

interface Props {
  pontos: Ponto[]
  titulo?: string
  sufixo?: string
}

/** Gráfico de linha minimalista em SVG (sem dependências). */
export default function LineChart({ pontos, titulo, sufixo }: Props) {
  if (pontos.length === 0) return null
  const W = 520, H = 160, pad = 30
  const valores = pontos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const span = max - min || 1
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, pontos.length - 1)
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad)

  const d = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      {titulo && <div className="mb-2 text-sm font-medium text-texto/70">{titulo}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="currentColor" className="text-black/10" />
        <path d={d} fill="none" stroke="rgb(var(--cor-primaria))" strokeWidth="2" />
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.valor)} r="3" fill="rgb(var(--cor-primaria))" />
            <text x={x(i)} y={H - pad + 14} textAnchor="middle" className="fill-current text-[9px] text-texto/40">{p.rotulo}</text>
            <text x={x(i)} y={y(p.valor) - 7} textAnchor="middle" className="fill-current text-[9px] text-texto/60">{p.valor}{sufixo}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
