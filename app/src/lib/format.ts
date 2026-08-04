/** Retorna a data local de hoje no formato YYYY-MM-DD, sem deslocamento UTC. */
export function localDateToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
 * Nome da clínica com o artigo correto, para as mensagens ao paciente:
 * `comArtigo('Instituto Geny Freitas', 'de')` → "do Instituto Geny Freitas";
 * `comArtigo('Clínica Bella', 'em')` → "na Clínica Bella".
 *
 * O sistema é white-label, então o gênero vem do nome: nomes que começam com
 * palavra feminina usam "da/na"; o padrão é masculino ("do/no").
 */
const NOME_FEMININO = /^(cl[íi]nica|policl[íi]nica|est[ée]tica|casa|academia|unidade|sa[úu]de|beleza|derma)/i

export function comArtigo(nome: string, base: 'de' | 'em'): string {
  let n = (nome ?? '').trim()
  // Nome que já começa com artigo ("A Casa…", "O Instituto…"): ele define o
  // gênero e sai do texto, senão ficaria "da A Casa…".
  const comArt = /^([ao])\s+(.+)$/i.exec(n)
  let feminino: boolean
  if (comArt) {
    feminino = comArt[1].toLowerCase() === 'a'
    n = comArt[2]
  } else {
    feminino = NOME_FEMININO.test(n)
  }
  const artigo = base === 'de' ? (feminino ? 'da' : 'do') : (feminino ? 'na' : 'no')
  return `${artigo} ${n}`
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
