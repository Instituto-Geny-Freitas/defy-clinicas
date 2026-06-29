/**
 * Formata datas em pt-BR sem o "deslocamento de fuso" para colunas DATE.
 * `new Date("1980-01-14")` é interpretado como UTC e, em fusos negativos,
 * aparece como o dia anterior. Para strings YYYY-MM-DD formatamos direto.
 */
export function formatDateBR(value?: string | null): string {
  if (!value) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

/** Converte data-only (YYYY-MM-DD) em Date no fuso LOCAL (sem shift de UTC). */
export function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Lê um valor monetário digitado em pt-BR e devolve um número.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" etc.
 */
export function parseMoneyBR(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  let s = String(value).replace(/[^\d.,-]/g, '') // remove R$, espaços, etc.
  if (s.includes(',')) {
    // vírgula é o separador decimal; pontos são milhar
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? 0 : n
}
