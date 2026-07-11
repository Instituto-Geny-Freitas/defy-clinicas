import { supabase } from '@/lib/supabase'

/**
 * Configuração de gestão financeira (clinics.dados_empresa.gestao):
 * - metaMensal: meta de faturamento (recebimento) do mês.
 * - comissoes: percentual de comissão por profissional { [professionalId]: pct }.
 * Sem migration — vive no JSONB de configuração da clínica.
 */
export interface GestaoConfig {
  metaMensal: number
  comissoes: Record<string, number>
}

const DEFAULT_CONFIG: GestaoConfig = { metaMensal: 0, comissoes: {} }

export async function getGestaoConfig(): Promise<GestaoConfig> {
  const { data } = await supabase.from('clinics').select('dados_empresa').limit(1).maybeSingle()
  const g = (data?.dados_empresa as { gestao?: Partial<GestaoConfig> } | null)?.gestao
  if (!g) return { ...DEFAULT_CONFIG }
  return {
    metaMensal: Number(g.metaMensal) || 0,
    comissoes: (g.comissoes && typeof g.comissoes === 'object') ? g.comissoes as Record<string, number> : {},
  }
}

export async function saveGestaoConfig(clinicId: string, cfg: GestaoConfig): Promise<void> {
  const { data } = await supabase.from('clinics').select('dados_empresa').eq('id', clinicId).maybeSingle()
  const dados = { ...((data?.dados_empresa as Record<string, unknown>) ?? {}), gestao: cfg }
  const { error } = await supabase.from('clinics').update({ dados_empresa: dados }).eq('id', clinicId)
  if (error) throw error
}
