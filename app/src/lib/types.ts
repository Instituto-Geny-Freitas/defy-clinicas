// Tipos compartilhados do app. (Futuramente podem ser gerados automaticamente
// a partir do schema com `supabase gen types typescript`.)

export type UserRole = 'admin' | 'profissional' | 'recepcao'

/** Tipo de perfil resolvido após o login. */
export type ProfileKind = 'staff' | 'patient' | 'unknown'

export interface Professional {
  id: string
  clinic_id: string
  auth_user_id: string | null
  nome: string
  role: UserRole
  conselho_tipo: string | null
  conselho_numero: string | null
  ativo: boolean
}

export interface Patient {
  id: string
  clinic_id: string
  auth_user_id: string | null
  nome: string
  cpf: string | null
  nascimento: string | null
  sexo: string | null
  email: string | null
  whatsapp: string | null
  telefone: string | null
  profissao: string | null
  estilo_trabalho: string | null
  alergias: string | null
  observacoes: string | null
  consentimento_lgpd_em: string | null
  consentimento_lgpd_versao: string | null
  senha_provisoria: boolean
}

export interface ClinicTheme {
  primaria?: string
  secundaria?: string
  fundo?: string
  texto?: string
}

export interface Clinic {
  id: string
  nome: string
  logo_url: string | null
  tema_cores: ClinicTheme
  whatsapp: string | null
}

export interface Profile {
  kind: ProfileKind
  professional: Professional | null
  patient: Patient | null
}
