import type { BodyMeasurement } from '@/lib/measurements'

/** Valor absoluto formatado em pt-BR com 1 casa (ex.: 2,2). */
export const fmt1 = (n: number) => Math.abs(n).toFixed(1).replace('.', ',')

/** Seta (imagem) para cima/baixo — herda a cor do texto (currentColor). */
export function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="inline-block shrink-0">
      {up ? <path d="M5 1 L9 8 L1 8 Z" fill="currentColor" /> : <path d="M5 9 L1 2 L9 2 Z" fill="currentColor" />}
    </svg>
  )
}

/**
 * Célula de variação: vermelho se negativo (com seta ↓), verde se positivo (seta ↑),
 * cinza se ~zero, travessão se não houver base de comparação.
 */
export function Delta({ valor, sufixo = '' }: { valor: number | null; sufixo?: string }) {
  if (valor == null) return <span className="text-texto/30">—</span>
  if (Math.abs(valor) < 0.05) return <span className="text-texto/40">0{sufixo}</span>
  const neg = valor < 0
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${neg ? 'text-red-600' : 'text-emerald-600'}`}>
      <Arrow up={!neg} />{fmt1(valor)}{sufixo}
    </span>
  )
}

/** Peso ganho/perdido da 1ª à última sessão com peso registrado. */
export function resumoPesoGeral(medidas: BodyMeasurement[]): { geralKg: number | null; geralPct: number | null } {
  const comPeso = medidas.filter((m) => m.peso_kg != null)
  if (comPeso.length < 2) return { geralKg: null, geralPct: null }
  const primeiro = Number(comPeso[0].peso_kg)
  const ultimo = Number(comPeso[comPeso.length - 1].peso_kg)
  const geralKg = ultimo - primeiro
  return { geralKg, geralPct: primeiro ? (geralKg / primeiro) * 100 : null }
}

/** Variação de peso (kg e %) de uma medição em relação à anterior. */
export function calcDeltaPeso(
  atual: BodyMeasurement,
  anterior: BodyMeasurement | null | undefined,
): { dKg: number | null; dPct: number | null } {
  const a = atual.peso_kg != null ? Number(atual.peso_kg) : null
  const p = anterior && anterior.peso_kg != null ? Number(anterior.peso_kg) : null
  if (a == null || p == null) return { dKg: null, dPct: null }
  const dKg = a - p
  return { dKg, dPct: p ? (dKg / p) * 100 : null }
}

/** Resumo (total ganho/perdido) para exibir ao lado do cabeçalho "Peso". */
export function PesoResumoHeader({ medidas }: { medidas: BodyMeasurement[] }) {
  const { geralKg, geralPct } = resumoPesoGeral(medidas)
  if (geralKg == null) return null
  const zero = Math.abs(geralKg) < 0.05
  const neg = geralKg < 0
  return (
    <span
      title="Total da 1ª até a última sessão"
      className={`ml-2 inline-flex items-center gap-1 align-middle text-xs font-semibold ${zero ? 'text-texto/40' : neg ? 'text-red-600' : 'text-emerald-600'}`}
    >
      {!zero && <Arrow up={!neg} />}
      {fmt1(geralKg)} kg{geralPct != null ? ` (${neg ? '-' : '+'}${fmt1(geralPct)}%)` : ''}
    </span>
  )
}
