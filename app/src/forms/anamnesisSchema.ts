import type { FormSchema } from './types'

const fpm = [
  { value: 'muito', label: 'Muito' },
  { value: 'pouco', label: 'Pouco' },
  { value: 'moderado', label: 'Moderado' },
]

// Ficha de Anamnese Clínica e Estética — baseada no documento da clínica.
// Dados pessoais (nome, CPF, etc.) vêm do cadastro do paciente e são
// pré-preenchidos fora deste schema; aqui ficam os campos clínicos.
export const anamnesisSchema: FormSchema = {
  sections: [
    {
      title: 'Avaliação Inicial e Objetivos',
      fields: [
        { key: 'queixa_principal', label: 'Queixa principal (o que trouxe você até aqui?)', type: 'textarea' },
        {
          key: 'objetivos',
          label: 'Objetivos principais',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'emagrecimento', label: 'Emagrecimento / Redução de gordura' },
            { value: 'massa_magra', label: 'Ganho de massa magra / Recuperação nutricional' },
            { value: 'estetica', label: 'Melhora da estética corporal/facial' },
            { value: 'saude_geral', label: 'Melhora da saúde geral e qualidade de vida' },
            { value: 'queixas_especificas', label: 'Queixas específicas (flacidez, celulite, manchas…)' },
          ],
        },
      ],
    },
    {
      title: 'Histórico Clínico e de Saúde',
      fields: [
        { key: 'doenca_cronica', label: 'Possui doença crônica?', type: 'boolean' },
        { key: 'doenca_cronica_qual', label: 'Qual?', type: 'text', showIf: { field: 'doenca_cronica', truthy: true } },
        { key: 'tratamento_medico', label: 'Está em tratamento médico atualmente?', type: 'boolean' },
        { key: 'tratamento_medico_qual', label: 'Qual?', type: 'text', showIf: { field: 'tratamento_medico', truthy: true } },
        { key: 'medicacao_continua', label: 'Faz uso de medicação contínua?', type: 'boolean' },
        { key: 'medicacao_continua_quais', label: 'Quais?', type: 'text', showIf: { field: 'medicacao_continua', truthy: true } },
        { key: 'suplementacao', label: 'Faz suplementação de vitaminas/manipulados?', type: 'boolean' },
        { key: 'suplementacao_quais', label: 'Quais?', type: 'text', showIf: { field: 'suplementacao', truthy: true } },
        { key: 'cirurgia', label: 'Já se submeteu a alguma cirurgia?', type: 'boolean' },
        { key: 'cirurgia_quais', label: 'Quais e há quanto tempo?', type: 'text', showIf: { field: 'cirurgia', truthy: true } },
        { key: 'filhos', label: 'Tem filhos?', type: 'boolean' },
        { key: 'filhos_quantos', label: 'Quantos?', type: 'number', showIf: { field: 'filhos', truthy: true } },
        { key: 'parto_recente', label: 'Parto recente (menos de 6 meses)?', type: 'boolean' },
        { key: 'anestesia_odonto', label: 'Já recebeu anestesia odontológica?', type: 'boolean' },
        { key: 'anestesia_intercorrencia', label: 'Houve intercorrência?', type: 'text', showIf: { field: 'anestesia_odonto', truthy: true } },
        {
          key: 'alergias',
          label: 'Histórico de alergias',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'anestesicos', label: 'Anestésicos' },
            { value: 'medicamentos', label: 'Medicamentos' },
            { value: 'alimentos', label: 'Alimentos' },
            { value: 'cosmeticos_latex', label: 'Cosméticos / Látex' },
          ],
        },
        { key: 'alergias_detalhe', label: 'Especifique as alergias', type: 'text', full: true, showIf: { field: 'alergias', truthy: true } },
      ],
    },
    {
      title: 'Histórico Estético e Dermatológico',
      fields: [
        { key: 'procedimento_anterior', label: 'Já realizou algum procedimento estético?', type: 'boolean' },
        { key: 'procedimento_anterior_detalhe', label: 'Quais e como foram os resultados?', type: 'textarea', showIf: { field: 'procedimento_anterior', truthy: true } },
        { key: 'cosmeticos_uso', label: 'Cosméticos em uso atualmente (skincare/corporal)', type: 'text', full: true },
        { key: 'historico_cicatriz', label: 'Histórico de cicatriz/queloide ou hiperpigmentação pós-inflamatória?', type: 'boolean', full: true },
      ],
    },
    {
      title: 'Estilo de Vida e Hábitos',
      fields: [
        {
          key: 'estilo_trabalho',
          label: 'Estilo de trabalho (no dia a dia)',
          type: 'radio',
          options: [
            { value: 'sentado', label: 'Sentado' },
            { value: 'em_pe_ativo', label: 'Em pé / Ativo' },
          ],
        },
        { key: 'sono_horas', label: 'Horas de sono por noite', type: 'number', suffix: 'h' },
        { key: 'sono_reparador', label: 'O sono é reparador?', type: 'boolean' },
        { key: 'ingesta_hidrica', label: 'Ingesta hídrica diária', type: 'number', suffix: 'ml' },
        { key: 'atividade_fisica', label: 'Pratica atividade física?', type: 'boolean' },
        { key: 'atividade_modalidade', label: 'Modalidade', type: 'text', showIf: { field: 'atividade_fisica', truthy: true } },
        { key: 'atividade_frequencia', label: 'Frequência semanal (vezes)', type: 'number', showIf: { field: 'atividade_fisica', truthy: true } },
        {
          key: 'alcool',
          label: 'Consumo de bebidas alcoólicas',
          type: 'radio',
          options: [
            { value: 'nao', label: 'Não consome' },
            { value: 'raramente', label: 'Raramente' },
            { value: 'socialmente', label: 'Socialmente' },
            { value: 'frequentemente', label: 'Frequentemente' },
          ],
        },
        {
          key: 'tabagismo',
          label: 'Tabagismo',
          type: 'radio',
          options: [
            { value: 'nao', label: 'Não' },
            { value: 'sim', label: 'Sim' },
            { value: 'ex', label: 'Ex-fumante' },
          ],
        },
      ],
    },
    {
      title: 'Histórico Nutricional e Gastrointestinal',
      fields: [
        {
          key: 'intestino',
          label: 'O intestino funciona regularmente?',
          type: 'radio',
          options: [
            { value: 'diario', label: 'Sim, diariamente' },
            { value: 'irregular', label: 'Não / irregular' },
          ],
        },
        { key: 'habitos_alimentares', label: 'Como caracteriza seus hábitos alimentares?', type: 'textarea' },
        { key: 'consumo_doces', label: 'Doces / Açúcares', type: 'radio', options: fpm },
        { key: 'consumo_carbo', label: 'Carboidratos (pães, massas, fritos)', type: 'radio', options: fpm },
        { key: 'consumo_proteinas', label: 'Proteínas (carnes, ovos, leguminosas)', type: 'radio', options: fpm },
        { key: 'compulsao', label: 'Episódios de compulsão alimentar ou fome por ansiedade?', type: 'boolean' },
      ],
    },
    {
      title: 'Triagem Laboratorial e Métrica (uso do profissional)',
      description: 'Campos antropométricos para acompanhamento de evolução.',
      fields: [
        { key: 'exames_alterados', label: 'Possui alterações em exames recentes?', type: 'boolean' },
        { key: 'exames_alterados_quais', label: 'Quais?', type: 'text', showIf: { field: 'exames_alterados', truthy: true } },
        { key: 'peso_kg', label: 'Peso atual', type: 'number', suffix: 'kg' },
        { key: 'altura_m', label: 'Altura (m)', type: 'number', placeholder: 'ex.: 1,70' },
        { key: 'peso_meta_kg', label: 'Peso desejado / meta', type: 'number', suffix: 'kg' },
      ],
    },
  ],
}
