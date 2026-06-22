import { supabase } from '@/lib/supabase'

// =============================================================================
// Motor de formulários da Área Administrativa (data-driven).
// As definições padrão vivem aqui; o admin pode personalizar os campos e a
// personalização é salva em clinics.dados_empresa.admin_forms (sem migração).
// =============================================================================

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'boolean'
  | 'select' | 'multiselect' | 'upload'
  | 'ativo'        // referência a um ativo (active_ingredients); pode auto-preencher
  | 'profissional' // referência a um profissional da equipe
  | 'paciente'     // referência a um paciente

export interface FormField {
  key: string
  label: string
  tipo: FieldType
  opcoes?: string[]        // para select/multiselect
  obrigatorio?: boolean
  full?: boolean           // ocupa a linha inteira no grid
  suffix?: string          // sufixo visual (ex.: °C, BTUs)
  fonte?: string           // auto-preenchimento (ex.: 'ativo.validade', 'ativo.lote')
  auto?: 'profissional_logado' | 'hoje' | 'paciente_nome' | 'paciente_idade' | 'paciente_sexo'
}

export interface FormDef {
  chave: string
  titulo: string
  descricao?: string
  grupo: string
  ordem: number
  vinculo: 'none' | 'paciente'
  numerado?: boolean         // gera nnnnn/ano/códigocliente
  numeradoEscopo?: string
  campoData?: string         // qual campo é a "data principal" (filtro/PDF). Default: 1º date
  campos: FormField[]
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const DEFAULT_FORMS: FormDef[] = [
  // B) Intercorrências e Acidentes -------------------------------------------
  {
    chave: 'intercorrencia', titulo: 'Intercorrências e Acidentes', grupo: 'Registros', ordem: 10,
    vinculo: 'paciente', numerado: true, numeradoEscopo: 'intercorrencia', campoData: 'data',
    descricao: 'Anexo XII — Registro de Intercorrências. O número é gerado automaticamente.',
    campos: [
      { key: 'data', label: 'Data da Intercorrência', tipo: 'date', obrigatorio: true },
      { key: 'hora', label: 'Horário', tipo: 'time' },
      { key: 'local', label: 'Local do Incidente', tipo: 'text', full: true },
      { key: 'idade', label: 'Idade do Paciente', tipo: 'number', auto: 'paciente_idade' },
      { key: 'sexo', label: 'Sexo', tipo: 'select', opcoes: ['M', 'F'], auto: 'paciente_sexo' },
      { key: 'descricao', label: 'Descrição do ocorrido', tipo: 'textarea', full: true },
      { key: 'causas', label: 'Possíveis causas do incidente', tipo: 'textarea', full: true },
      { key: 'acao_corretiva', label: 'Ação corretiva (o que foi feito)', tipo: 'textarea', full: true },
      { key: 'resposta', label: 'Resposta do paciente (resultado)', tipo: 'textarea', full: true },
      { key: 'acao_preventiva', label: 'Ação preventiva (evitar reincidência)', tipo: 'textarea', full: true },
      { key: 'profissional', label: 'Nome do Profissional', tipo: 'profissional', auto: 'profissional_logado' },
      { key: 'data_preenchimento', label: 'Data do preenchimento', tipo: 'date', auto: 'hoje' },
    ],
  },
  // I) Controle de validade de produtos --------------------------------------
  {
    chave: 'validade_produtos', titulo: 'Controle de Validade de Produtos', grupo: 'Registros', ordem: 11,
    vinculo: 'none', campoData: 'data',
    descricao: 'Registro semanal de integridade e validade dos produtos (ativos).',
    campos: [
      { key: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
      { key: 'produto', label: 'Produto', tipo: 'ativo', obrigatorio: true },
      { key: 'validade', label: 'Validade do Produto', tipo: 'date', fonte: 'ativo.validade' },
      { key: 'lote', label: 'Nº do Lote', tipo: 'text', fonte: 'ativo.lote' },
      { key: 'integridade', label: 'Integridade', tipo: 'text', full: true },
      { key: 'responsavel', label: 'Responsável', tipo: 'profissional' },
    ],
  },
  // J) Cronograma de calibração ----------------------------------------------
  {
    chave: 'calibracao', titulo: 'Cronograma de Calibração', grupo: 'Registros', ordem: 12,
    vinculo: 'none', campoData: 'data_estimada',
    descricao: 'Anexo VIII — Manutenção e calibração dos equipamentos. Status: verde = efetuado, vermelho = não efetuado.',
    campos: [
      { key: 'equipamento', label: 'Equipamento', tipo: 'text', obrigatorio: true },
      { key: 'ano', label: 'Ano', tipo: 'number' },
      { key: 'mes', label: 'Mês', tipo: 'select', opcoes: MESES },
      { key: 'data_estimada', label: 'Data estimada', tipo: 'date' },
      { key: 'efetuado', label: 'Efetuado?', tipo: 'boolean' },
      { key: 'fornecedor', label: 'Empresa (Fornecedor)', tipo: 'text' },
      { key: 'tecnico', label: 'Nome do Técnico', tipo: 'text' },
    ],
  },
  // C) Equipamentos -----------------------------------------------------------
  {
    chave: 'equipamentos', titulo: 'Equipamentos', grupo: 'Estrutura', ordem: 20,
    vinculo: 'none', campoData: 'data_aquisicao',
    descricao: 'Lista de equipamentos existentes na clínica.',
    campos: [
      { key: 'nome', label: 'Nome do aparelho', tipo: 'text', obrigatorio: true },
      { key: 'fabricante', label: 'Nome do fabricante', tipo: 'text' },
      { key: 'num_serie', label: 'Nº de série do equipamento', tipo: 'text' },
      { key: 'registro_anvisa', label: 'Nº registro na ANVISA', tipo: 'text' },
      { key: 'data_aquisicao', label: 'Data de aquisição', tipo: 'date' },
    ],
  },
  // F) EPIs -------------------------------------------------------------------
  {
    chave: 'epis', titulo: 'Relação de EPIs', grupo: 'Estrutura', ordem: 21,
    vinculo: 'none', campoData: 'data_aquisicao',
    descricao: 'Equipamentos de proteção individual.',
    campos: [
      { key: 'nome', label: 'Nome do equipamento', tipo: 'text', obrigatorio: true },
      { key: 'data_aquisicao', label: 'Data de aquisição', tipo: 'date' },
      { key: 'objetivo', label: 'Objetivo', tipo: 'text', full: true },
      { key: 'data_validade', label: 'Data de validade', tipo: 'date' },
      { key: 'data_revisao', label: 'Data de revisão', tipo: 'date' },
    ],
  },
  // G) Prestadores de serviços ------------------------------------------------
  {
    chave: 'prestadores', titulo: 'Prestadores de Serviços', grupo: 'Estrutura', ordem: 22,
    vinculo: 'none',
    descricao: 'Empresas terceirizadas que prestam serviço à clínica.',
    campos: [
      { key: 'empresa', label: 'Nome da empresa', tipo: 'text', obrigatorio: true },
      { key: 'servico', label: 'Serviço prestado', tipo: 'text' },
      { key: 'cnpj', label: 'CNPJ da empresa', tipo: 'text' },
      { key: 'telefone', label: 'Telefone da empresa', tipo: 'text' },
      { key: 'contato', label: 'Contato da empresa', tipo: 'text' },
      { key: 'email', label: 'E-mail da empresa', tipo: 'text' },
      { key: 'periodicidade', label: 'Periodicidade', tipo: 'text' },
    ],
  },
  // H) Controle de pragas e vetores ------------------------------------------
  {
    chave: 'pragas', titulo: 'Controle de Pragas e Vetores', grupo: 'Estrutura', ordem: 23,
    vinculo: 'none', campoData: 'data',
    campos: [
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'text', obrigatorio: true },
      { key: 'tipo_servico', label: 'Tipo de serviço', tipo: 'text' },
      { key: 'data', label: 'Data', tipo: 'date' },
      { key: 'registro_inea', label: 'Nº Cadastro INEA / Vigilância Sanitária', tipo: 'text' },
      { key: 'alvara', label: 'Cópia do Alvará', tipo: 'upload' },
      { key: 'responsavel', label: 'Responsável pelo registro', tipo: 'profissional' },
    ],
  },
  // D.a) Climatização (ar-condicionado) --------------------------------------
  {
    chave: 'ar_condicionado', titulo: 'Climatização (Ar-Condicionado)', grupo: 'Limpeza e Desinfecção', ordem: 30,
    vinculo: 'none', campoData: 'ultima_manutencao',
    descricao: 'Ambientes climatizados e manutenção dos aparelhos.',
    campos: [
      { key: 'ambiente', label: 'Ambiente climatizado', tipo: 'text', obrigatorio: true },
      { key: 'ocupantes', label: 'Nº de ocupantes (fixos/flutuantes)', tipo: 'text' },
      { key: 'modelo', label: 'Modelo do aparelho', tipo: 'text' },
      { key: 'btus', label: 'Capacidade do aparelho', tipo: 'number', suffix: 'BTUs' },
      { key: 'periodicidade', label: 'Periodicidade da manutenção', tipo: 'text' },
      { key: 'ultima_manutencao', label: 'Data da última manutenção', tipo: 'date' },
      { key: 'proxima_manutencao', label: 'Data da próxima manutenção', tipo: 'date' },
    ],
  },
  // D.b) Filtro do ar-condicionado -------------------------------------------
  {
    chave: 'filtro_ar', titulo: 'Limpeza — Filtro de Ar-Condicionado', grupo: 'Limpeza e Desinfecção', ordem: 31,
    vinculo: 'none', campoData: 'data',
    campos: [
      { key: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
      { key: 'empresa', label: 'Responsável pela limpeza (empresa)', tipo: 'text' },
      { key: 'tecnico', label: 'Nome do técnico', tipo: 'text' },
      { key: 'documento', label: 'Documento de prestação de serviço', tipo: 'upload' },
    ],
  },
  // D.c) Temperatura do refrigerador -----------------------------------------
  {
    chave: 'temp_refrigerador', titulo: 'Temperatura do Refrigerador', grupo: 'Limpeza e Desinfecção', ordem: 32,
    vinculo: 'none', campoData: 'data',
    campos: [
      { key: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
      { key: 'hora', label: 'Hora', tipo: 'time' },
      { key: 'temp_momento', label: 'Temperatura no momento', tipo: 'number', suffix: '°C' },
      { key: 'temp_maxima', label: 'Temperatura máxima', tipo: 'number', suffix: '°C' },
      { key: 'responsavel', label: 'Responsável', tipo: 'profissional' },
    ],
  },
  // D.d) Limpeza do ambiente --------------------------------------------------
  {
    chave: 'limpeza_ambiente', titulo: 'Limpeza do Ambiente', grupo: 'Limpeza e Desinfecção', ordem: 33,
    vinculo: 'none', campoData: 'data',
    descricao: 'O responsável pelo registro (log) é gravado automaticamente.',
    campos: [
      { key: 'data', label: 'Dia do mês', tipo: 'date', obrigatorio: true },
      { key: 'hora', label: 'Hora', tipo: 'time' },
      { key: 'ambiente', label: 'Ambiente', tipo: 'text' },
      { key: 'tipo', label: 'Tipo de limpeza', tipo: 'select', opcoes: ['Concorrente', 'Terminal'] },
      { key: 'responsavel', label: 'Responsável pela limpeza', tipo: 'text' },
    ],
  },
  // D.e) Filtro de água -------------------------------------------------------
  {
    chave: 'filtro_agua', titulo: 'Limpeza — Filtro de Água', grupo: 'Limpeza e Desinfecção', ordem: 34,
    vinculo: 'none', campoData: 'data',
    campos: [
      { key: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
      { key: 'empresa', label: 'Responsável pela limpeza (empresa)', tipo: 'text' },
      { key: 'tecnico', label: 'Nome do técnico', tipo: 'text' },
      { key: 'documento', label: 'Documento de prestação de serviço', tipo: 'upload' },
    ],
  },
  // E) Esterilização ----------------------------------------------------------
  {
    chave: 'esterilizacao', titulo: 'Esterilização', grupo: 'Limpeza e Desinfecção', ordem: 35,
    vinculo: 'none', campoData: 'data',
    campos: [
      { key: 'equipamento', label: 'Equipamento', tipo: 'text', obrigatorio: true },
      { key: 'data', label: 'Data', tipo: 'date' },
      { key: 'hora', label: 'Hora', tipo: 'time' },
      { key: 'responsavel', label: 'Responsável', tipo: 'profissional' },
      { key: 'observacao', label: 'Observação', tipo: 'textarea', full: true },
    ],
  },
]

export const FORM_GROUPS = ['Registros', 'Estrutura', 'Limpeza e Desinfecção']

function mergeDef(base: FormDef, override: Partial<FormDef> | undefined): FormDef {
  if (!override) return base
  return {
    ...base,
    ...override,
    // os campos personalizados substituem por completo (permite add/editar/excluir)
    campos: Array.isArray(override.campos) ? (override.campos as FormField[]) : base.campos,
  }
}

interface AdminFormsConfig {
  forms?: Record<string, Partial<FormDef>>
  codigo?: string
}

async function readClinicConfig(): Promise<{ id: string | null; dados: Record<string, unknown>; cfg: AdminFormsConfig }> {
  const { data } = await supabase.from('clinics').select('id, dados_empresa').limit(1).maybeSingle()
  const dados = (data?.dados_empresa as Record<string, unknown>) ?? {}
  const cfg = (dados.admin_forms as AdminFormsConfig) ?? {}
  return { id: data?.id ?? null, dados, cfg }
}

/** Lista as definições (padrão + personalizações do admin), ordenadas. */
export async function getForms(): Promise<FormDef[]> {
  const { cfg } = await readClinicConfig()
  const overrides = cfg.forms ?? {}
  return DEFAULT_FORMS
    .map((d) => mergeDef(d, overrides[d.chave]))
    .sort((a, b) => a.ordem - b.ordem)
}

/** Definição de um formulário específico (com personalização aplicada). */
export async function getForm(chave: string): Promise<FormDef | null> {
  const all = await getForms()
  return all.find((f) => f.chave === chave) ?? null
}

/** Código curto da clínica usado no numerador (nnnnn/ano/CODIGO). */
export async function getClinicCodigo(): Promise<string> {
  const { cfg } = await readClinicConfig()
  return (cfg.codigo || 'CLI').toUpperCase()
}

/** Salva a personalização de um formulário (campos/título) preservando o resto. */
export async function saveFormDef(clinicId: string, chave: string, patch: Partial<FormDef>): Promise<void> {
  const { dados, cfg } = await readClinicConfig()
  const forms = { ...(cfg.forms ?? {}), [chave]: { ...(cfg.forms?.[chave] ?? {}), ...patch } }
  const novo = { ...dados, admin_forms: { ...cfg, forms } }
  const { error } = await supabase.from('clinics').update({ dados_empresa: novo }).eq('id', clinicId)
  if (error) throw error
}

/** Restaura um formulário para o padrão de fábrica (remove personalização). */
export async function resetFormDef(clinicId: string, chave: string): Promise<void> {
  const { dados, cfg } = await readClinicConfig()
  const forms = { ...(cfg.forms ?? {}) }
  delete forms[chave]
  const novo = { ...dados, admin_forms: { ...cfg, forms } }
  const { error } = await supabase.from('clinics').update({ dados_empresa: novo }).eq('id', clinicId)
  if (error) throw error
}

/** Salva o código da clínica (numerador). */
export async function saveClinicCodigo(clinicId: string, codigo: string): Promise<void> {
  const { dados, cfg } = await readClinicConfig()
  const novo = { ...dados, admin_forms: { ...cfg, codigo: codigo.toUpperCase() } }
  const { error } = await supabase.from('clinics').update({ dados_empresa: novo }).eq('id', clinicId)
  if (error) throw error
}
