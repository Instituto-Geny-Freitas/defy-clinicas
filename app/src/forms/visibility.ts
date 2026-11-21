import type { FormValues, ShowIf } from './types'

/** Regra de exibição condicional de um campo (mesma na tela e no PDF). */
export function visivel(showIf: ShowIf | undefined, values: FormValues): boolean {
  if (!showIf) return true
  const v = values[showIf.field]
  if (showIf.truthy) return Boolean(v)
  return v === showIf.equals
}
