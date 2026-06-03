// Definições para formulários guiados por schema (dinâmicos).
// O mesmo schema renderiza a anamnese para o profissional e para o paciente,
// e o mesmo motor servirá às fichas de avaliação e aos termos.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean' // Sim / Não
  | 'radio'
  | 'select'
  | 'multiselect' // grupo de checkboxes -> array
  | 'grid' // tabela de linhas x colunas (ex.: perimetria)

/** Configuração de um campo do tipo 'grid'. */
export interface GridConfig {
  rows: string[]
  columns: { key: string; label: string }[]
}

export interface FieldOption {
  value: string
  label: string
}

/** Condição para exibir um campo conforme o valor de outro. */
export interface ShowIf {
  field: string
  equals?: unknown
  truthy?: boolean
}

export interface FormField {
  key: string
  label: string
  type: FieldType
  options?: FieldOption[]
  placeholder?: string
  suffix?: string // ex.: "kg", "ml", "h"
  showIf?: ShowIf
  full?: boolean // ocupa a linha inteira no grid
  grid?: GridConfig // obrigatório quando type === 'grid'
}

export interface FormSection {
  title: string
  description?: string
  fields: FormField[]
}

export interface FormSchema {
  sections: FormSection[]
}

export type FormValues = Record<string, unknown>
