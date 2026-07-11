import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

/** Níveis de acesso configuráveis (o Paciente usa o portal e não entra nesta matriz). */
export type Nivel = UserRole // 'admin' | 'profissional' | 'recepcao'
export const NIVEIS_EDITAVEIS: Exclude<Nivel, 'admin'>[] = ['profissional', 'recepcao']
export const NIVEL_LABEL: Record<Nivel, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  recepcao: 'Secretaria / Recepção',
}

export interface FeatureDef { key: string; label: string; group: 'Menu lateral' | 'Abas do paciente' }

/** Funcionalidades que podem ser ligadas/desligadas por nível. */
export const FEATURES: FeatureDef[] = [
  // Menu lateral
  { key: 'menu.dashboard', label: 'Dashboard', group: 'Menu lateral' },
  { key: 'menu.agenda', label: 'Agenda', group: 'Menu lateral' },
  { key: 'menu.pacientes', label: 'Pacientes', group: 'Menu lateral' },
  { key: 'menu.documentos', label: 'Modelos de Documentos', group: 'Menu lateral' },
  { key: 'menu.estoque', label: 'Estoque', group: 'Menu lateral' },
  { key: 'menu.financeiro', label: 'Financeiro', group: 'Menu lateral' },
  { key: 'menu.relatorios', label: 'Relatórios', group: 'Menu lateral' },
  { key: 'menu.relacionamento', label: 'Relacionamento', group: 'Menu lateral' },
  { key: 'menu.administrativo', label: 'Administrativo', group: 'Menu lateral' },
  // Abas da ficha do paciente
  { key: 'paciente.resumo', label: 'Resumo', group: 'Abas do paciente' },
  { key: 'paciente.agenda', label: 'Agenda', group: 'Abas do paciente' },
  { key: 'paciente.anamnese', label: 'Anamnese', group: 'Abas do paciente' },
  { key: 'paciente.avaliacoes', label: 'Avaliações', group: 'Abas do paciente' },
  { key: 'paciente.plano', label: 'Plano', group: 'Abas do paciente' },
  { key: 'paciente.pacotes', label: 'Pacotes', group: 'Abas do paciente' },
  { key: 'paciente.procedimentos', label: 'Procedimentos', group: 'Abas do paciente' },
  { key: 'paciente.medidas', label: 'Medidas', group: 'Abas do paciente' },
  { key: 'paciente.suplementacao', label: 'Suplementação', group: 'Abas do paciente' },
  { key: 'paciente.manipulacao', label: 'Manipulação', group: 'Abas do paciente' },
  { key: 'paciente.exames', label: 'Exames', group: 'Abas do paciente' },
  { key: 'paciente.fotos', label: 'Fotos', group: 'Abas do paciente' },
  { key: 'paciente.documentos', label: 'Documentos', group: 'Abas do paciente' },
  { key: 'paciente.financeiro', label: 'Financeiro', group: 'Abas do paciente' },
  { key: 'paciente.relatorios', label: 'Relatórios', group: 'Abas do paciente' },
]

export const ALL_KEYS = FEATURES.map((f) => f.key)

/** Permissões padrão por nível (usadas quando o admin ainda não personalizou). */
export const DEFAULTS: Record<Exclude<Nivel, 'admin'>, string[]> = {
  // Profissional: todos os módulos clínicos + todas as abas.
  profissional: ALL_KEYS.slice(),
  // Secretaria/Recepção: agenda, cadastro (pacientes) e financeiro.
  recepcao: [
    'menu.dashboard', 'menu.agenda', 'menu.pacientes', 'menu.financeiro', 'menu.relacionamento',
    'paciente.resumo', 'paciente.agenda', 'paciente.documentos', 'paciente.financeiro',
  ],
}

export type PermMatrix = Record<Exclude<Nivel, 'admin'>, string[]>

export function defaultsMatrix(): PermMatrix {
  return { profissional: DEFAULTS.profissional.slice(), recepcao: DEFAULTS.recepcao.slice() }
}

/** Lê a matriz de permissões salva em clinics.dados_empresa.permissoes (ou os padrões). */
export async function getPermissions(): Promise<PermMatrix> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const saved = (data?.dados_empresa as { permissoes?: Partial<PermMatrix> } | null)?.permissoes
  const base = defaultsMatrix()
  if (!saved) return base
  return {
    profissional: Array.isArray(saved.profissional) ? saved.profissional : base.profissional,
    recepcao: Array.isArray(saved.recepcao) ? saved.recepcao : base.recepcao,
  }
}

/** Salva a matriz (admin), preservando os demais campos de dados_empresa. */
export async function savePermissions(clinicId: string, matrix: PermMatrix): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const atual = (data?.dados_empresa as Record<string, unknown>) ?? {}
  const { error } = await supabase.from('clinics').update({ dados_empresa: { ...atual, permissoes: matrix } }).eq('id', clinicId)
  if (error) throw error
}

/** Admin sempre tem tudo; os demais conforme a matriz. */
export function canWith(matrix: PermMatrix | null, nivel: Nivel | undefined, key: string): boolean {
  if (nivel === 'admin') return true
  if (!nivel) return false
  if (nivel !== 'profissional' && nivel !== 'recepcao') return false
  const list = matrix?.[nivel] ?? DEFAULTS[nivel]
  return list.includes(key)
}
