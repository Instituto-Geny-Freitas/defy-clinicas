import { supabase } from '@/lib/supabase'
import type { Professional, UserRole } from '@/lib/types'

// ---- Clínica (white-label) -------------------------------------------------
export interface ClinicFull {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  responsavel_tecnico: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  logo_url: string | null
  tema_cores: Record<string, string>
  dados_empresa: Record<string, unknown>
}

export async function getClinic(): Promise<ClinicFull | null> {
  const { data, error } = await supabase.from('clinics').select('*').limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function updateClinic(id: string, patch: Partial<ClinicFull>): Promise<void> {
  const { error } = await supabase.from('clinics').update(patch).eq('id', id)
  if (error) throw error
}

/** Faz upload do logo no bucket público 'branding' e retorna a URL pública. */
export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `logo-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('branding').upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  return supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
}

// ---- Equipe ----------------------------------------------------------------
export interface ProfessionalInput {
  nome: string
  email?: string | null
  telefone?: string | null
  role: UserRole
  conselho_tipo?: string | null
  conselho_numero?: string | null
  conselho_uf?: string | null
  especialidade?: string | null
}

export async function listProfessionals(): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .order('nome')
  if (error) throw error
  return data ?? []
}

export async function createProfessional(clinicId: string, input: ProfessionalInput): Promise<{ id: string }> {
  const { data, error } = await supabase.from('professionals').insert({ clinic_id: clinicId, ...input }).select('id').single()
  if (error) throw error
  return data
}

/** Provisiona/redefine o login do profissional (Edge Function, server-side). */
export async function provisionStaffAccess(professionalId: string, password: string): Promise<{ login: string }> {
  const { data, error } = await supabase.functions.invoke('provision-staff-access', {
    body: { professional_id: professionalId, password },
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as { login: string }
}

// ---- Integrações (gateway de pagamento, etc.) ------------------------------
export interface IntegrationSetting {
  id?: string
  clinic_id: string
  categoria: 'pagamento' | 'whatsapp' | 'email'
  provider: string | null
  modo: string
  config_publica: Record<string, unknown>
  ativo: boolean
}

export async function getIntegration(
  categoria: IntegrationSetting['categoria'],
): Promise<IntegrationSetting | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('categoria', categoria)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---- Textos-padrão (snippets) ----------------------------------------------
export interface Snippet {
  id: string
  categoria: string | null
  titulo: string
  conteudo: string
  ativo: boolean
}

export async function listAllSnippets(): Promise<Snippet[]> {
  const { data, error } = await supabase
    .from('treatment_text_snippets')
    .select('id, categoria, titulo, conteudo, ativo')
    .order('categoria')
    .order('titulo')
  if (error) throw error
  return data ?? []
}

export async function createSnippet(clinicId: string, input: { categoria: string; titulo: string; conteudo: string }): Promise<void> {
  const { error } = await supabase.from('treatment_text_snippets').insert({ clinic_id: clinicId, ...input })
  if (error) throw error
}

export async function deleteSnippet(id: string): Promise<void> {
  const { error } = await supabase.from('treatment_text_snippets').delete().eq('id', id)
  if (error) throw error
}

export async function upsertIntegration(s: IntegrationSetting): Promise<void> {
  const { error } = await supabase
    .from('integration_settings')
    .upsert(
      {
        clinic_id: s.clinic_id,
        categoria: s.categoria,
        provider: s.provider,
        modo: s.modo,
        config_publica: s.config_publica,
        ativo: s.ativo,
      },
      { onConflict: 'clinic_id,categoria' },
    )
  if (error) throw error
}
