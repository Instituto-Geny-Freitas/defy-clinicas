import type { FormSchema } from './types'

const amb = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

const fototipo = [
  { value: 'I', label: 'I' },
  { value: 'II', label: 'II' },
  { value: 'III', label: 'III' },
  { value: 'IV', label: 'IV' },
  { value: 'V', label: 'V' },
  { value: 'VI', label: 'VI' },
]

const planejamento = {
  title: 'Planejamento Terapêutico e Orçamento',
  fields: [
    { key: 'tratamento_proposto', label: 'Tratamento proposto / Recursos', type: 'textarea' as const },
    { key: 'num_sessoes', label: 'Nº de sessões', type: 'number' as const },
    { key: 'frequencia', label: 'Frequência (x por semana)', type: 'text' as const },
    { key: 'valor_total', label: 'Valor total do tratamento', type: 'number' as const, suffix: 'R$' },
  ],
}

// ---------------------------------------------------------------------------
// Avaliação Estética e Dermato Funcional Avançada
// ---------------------------------------------------------------------------
export const dermatoSchema: FormSchema = {
  sections: [
    {
      title: 'Classificação e Características da Pele',
      fields: [
        { key: 'fototipo', label: 'Fototipo (Fitzpatrick)', type: 'radio', options: fototipo },
        {
          key: 'biotipo',
          label: 'Biotipo cutâneo',
          type: 'radio',
          options: [
            { value: 'eudermica', label: 'Eudérmica (Normal)' },
            { value: 'lipidica', label: 'Lipídica (Oleosa)' },
            { value: 'alipica', label: 'Alípica (Seca)' },
            { value: 'mista', label: 'Mista' },
          ],
        },
        {
          key: 'estado_cutaneo',
          label: 'Estado cutâneo atual',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'hidratado', label: 'Hidratado' },
            { value: 'desidratado', label: 'Desidratado' },
            { value: 'acneico', label: 'Acneico' },
            { value: 'seborreico', label: 'Seborreico' },
            { value: 'sensibilizado', label: 'Sensibilizado' },
          ],
        },
        {
          key: 'poros',
          label: 'Óstios (Poros)',
          type: 'radio',
          options: [
            { value: 'zona_t', label: 'Dilatados na zona T' },
            { value: 'toda_face', label: 'Dilatados em toda a face' },
            { value: 'nao_aparentes', label: 'Não aparentes' },
          ],
        },
        { key: 'textura', label: 'Textura', type: 'radio', options: [{ value: 'lisa', label: 'Lisa' }, { value: 'aspera', label: 'Áspera' }] },
        { key: 'espessura', label: 'Espessura', type: 'radio', options: [{ value: 'fina', label: 'Fina' }, { value: 'espessa', label: 'Espessa' }] },
      ],
    },
    {
      title: 'Alterações Cutâneas e Envelhecimento',
      fields: [
        {
          key: 'acne_grau',
          label: 'Acne (classificação clínica)',
          type: 'radio',
          full: true,
          options: [
            { value: 'nao', label: 'Não apresenta' },
            { value: 'I', label: 'Grau I (Comedônica)' },
            { value: 'II', label: 'Grau II (Pápulo-pústulo)' },
            { value: 'III', label: 'Grau III (Nódulo-cística)' },
            { value: 'IV', label: 'Grau IV (Conglobata)' },
            { value: 'V', label: 'Grau V (Fulminans)' },
          ],
        },
        {
          key: 'lesoes',
          label: 'Lesões de pele ativas / identificadas',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'comedoes', label: 'Comedões' },
            { value: 'papula', label: 'Pápula' },
            { value: 'pustula', label: 'Pústula' },
            { value: 'milium', label: 'Milium' },
            { value: 'cisto', label: 'Cisto' },
            { value: 'nodulo', label: 'Nódulo' },
            { value: 'dermatite', label: 'Dermatite' },
            { value: 'hiperqueratose', label: 'Hiperqueratose' },
            { value: 'psoriase', label: 'Psoríase' },
            { value: 'nevo', label: 'Nevo Melanocítico' },
          ],
        },
        {
          key: 'involucao',
          label: 'Sinais de envelhecimento',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'linhas', label: 'Linhas de expressão' },
            { value: 'sulcos', label: 'Sulcos' },
            { value: 'rugas', label: 'Rugas (estáticas/dinâmicas)' },
            { value: 'elastose', label: 'Elastose solar' },
            { value: 'ptose', label: 'Ptose (flacidez de tecidos)' },
          ],
        },
        {
          key: 'glogau',
          label: 'Fotoenvelhecimento (Glogau)',
          type: 'radio',
          full: true,
          options: [
            { value: 'I', label: 'I (Suave)' },
            { value: 'II', label: 'II (Moderado)' },
            { value: 'III', label: 'III (Avançado)' },
            { value: 'IV', label: 'IV (Grave)' },
          ],
        },
      ],
    },
    {
      title: 'Pigmentação, Cicatrizes e Vasos',
      fields: [
        {
          key: 'manchas',
          label: 'Manchas e discromias',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'melanose', label: 'Melanose solar' },
            { value: 'efelides', label: 'Efélides (sardas)' },
            { value: 'melasma', label: 'Melasma' },
            { value: 'cloasma', label: 'Cloasma' },
            { value: 'hiperpig', label: 'Hiperpigmentação pós-inflamatória' },
          ],
        },
        {
          key: 'vasculares',
          label: 'Alterações vasculares',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'equimose', label: 'Equimose' },
            { value: 'petequias', label: 'Petéquias' },
            { value: 'telangiectasias', label: 'Telangiectasias' },
            { value: 'eritema', label: 'Eritema' },
            { value: 'nevo_rubi', label: 'Nevo Rubi' },
            { value: 'rosacea', label: 'Rosácea' },
          ],
        },
        {
          key: 'cicatrizes',
          label: 'Cicatrizes',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'hipertrofica', label: 'Hipertrófica' },
            { value: 'atrofica', label: 'Atrófica' },
            { value: 'hipercromica', label: 'Hipercrômica' },
            { value: 'retratil', label: 'Retrátil' },
            { value: 'queloideana', label: 'Queloideana' },
            { value: 'hipocromica', label: 'Hipocrômica' },
          ],
        },
      ],
    },
    {
      title: 'Outras Avaliações',
      fields: [
        {
          key: 'pelos_couro',
          label: 'Pelos e couro cabeludo',
          type: 'multiselect',
          full: true,
          options: [
            { value: 'hirsutismo', label: 'Hirsutismo' },
            { value: 'hipertricose', label: 'Hipertricose' },
            { value: 'alopecia', label: 'Alopécia' },
            { value: 'foliculite', label: 'Foliculite' },
          ],
        },
        { key: 'olheiras', label: 'Olheiras?', type: 'boolean' },
        { key: 'olheiras_tipo', label: 'Tipo de olheira', type: 'text', showIf: { field: 'olheiras', truthy: true } },
        { key: 'flacidez', label: 'Flacidez corporal/facial?', type: 'boolean' },
        { key: 'flacidez_tipo', label: 'Tipo de flacidez', type: 'text', showIf: { field: 'flacidez', truthy: true } },
      ],
    },
    {
      title: 'Planejamento e Conduta',
      fields: [
        { key: 'tratamento_proposto', label: 'Tratamento proposto', type: 'textarea' },
        { key: 'home_care', label: 'Protocolo home care recomendado', type: 'textarea' },
        { key: 'orientacoes', label: 'Orientações ao paciente', type: 'textarea' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Ficha de Avaliação Capilar
// ---------------------------------------------------------------------------
export const capilarSchema: FormSchema = {
  sections: [
    {
      title: 'Identificação',
      fields: [{ key: 'queixa_capilar', label: 'Queixa capilar principal', type: 'textarea' }],
    },
    {
      title: 'Características Gerais do Cabelo',
      fields: [
        { key: 'tipo_fio', label: 'Tipo de fio', type: 'radio', options: [
          { value: 'liso', label: 'Liso' }, { value: 'ondulado', label: 'Ondulado' },
          { value: 'cacheado', label: 'Cacheado' }, { value: 'crespo', label: 'Crespo' }] },
        { key: 'comprimento', label: 'Comprimento', type: 'radio', options: [
          { value: 'curto', label: 'Curto' }, { value: 'medio', label: 'Médio' }, { value: 'longo', label: 'Longo' }] },
        { key: 'densidade', label: 'Densidade capilar', type: 'radio', options: amb },
      ],
    },
    {
      title: 'Propriedades Físicas do Fio',
      fields: [
        { key: 'textura_fio', label: 'Textura', type: 'radio', options: [
          { value: 'fino', label: 'Fino' }, { value: 'medio', label: 'Médio' }, { value: 'grosso', label: 'Grosso' }] },
        { key: 'tipicidade', label: 'Características', type: 'radio', options: [
          { value: 'normal', label: 'Normal' }, { value: 'seco', label: 'Seco' },
          { value: 'oleoso', label: 'Oleoso' }, { value: 'misto', label: 'Misto' }] },
        { key: 'resistencia', label: 'Resistência', type: 'radio', options: amb },
        { key: 'porosidade', label: 'Porosidade', type: 'radio', options: amb },
        { key: 'elasticidade', label: 'Elasticidade', type: 'radio', options: amb },
      ],
    },
    {
      title: 'Histórico de Danos e Rotina',
      fields: [
        { key: 'quimica_recente', label: 'Química recente (últimos meses)', type: 'multiselect', full: true, options: [
          { value: 'nenhuma', label: 'Nenhuma' }, { value: 'permanente', label: 'Permanente' },
          { value: 'alisamento', label: 'Alisamento/Progressiva' }, { value: 'coloracao', label: 'Coloração' },
          { value: 'descoloracao', label: 'Luzes/Descoloração' }] },
        { key: 'uso_frequente', label: 'Uso frequente (calor/abafamento)', type: 'multiselect', full: true, options: [
          { value: 'secador', label: 'Secador' }, { value: 'prancha', label: 'Prancha' },
          { value: 'modelador', label: 'Modelador' }, { value: 'chapeu', label: 'Chapéu/Boné' }] },
      ],
    },
    {
      title: 'Disfunções do Couro Cabeludo e Queda',
      fields: [
        { key: 'disfuncoes_couro', label: 'Disfunções', type: 'multiselect', full: true, options: [
          { value: 'queda', label: 'Queda (alopécias/eflúvios)' }, { value: 'seborreia', label: 'Seborréia/Caspa' },
          { value: 'dermatite', label: 'Dermatite' }, { value: 'pediculose', label: 'Pediculose' },
          { value: 'tricotilomania', label: 'Tricotilomania' }] },
        { key: 'danos_haste', label: 'Danos à haste (fio)', type: 'multiselect', full: true, options: [
          { value: 'tricorrexis', label: 'Tricorrexis Nodosa' }, { value: 'tricoptilose', label: 'Tricoptilose (pontas duplas)' },
          { value: 'triconodose', label: 'Triconodose (nós no fio)' }] },
      ],
    },
    planejamento,
  ],
}

// ---------------------------------------------------------------------------
// Ficha de Avaliação Corporal
// ---------------------------------------------------------------------------
export const corporalSchema: FormSchema = {
  sections: [
    {
      title: 'Identificação',
      fields: [
        { key: 'peso_kg', label: 'Peso atual', type: 'number', suffix: 'kg' },
        { key: 'altura_m', label: 'Altura', type: 'number', suffix: 'm' },
        { key: 'fototipo', label: 'Fototipo (Fitzpatrick)', type: 'radio', options: fototipo },
      ],
    },
    {
      title: 'Lipodistrofia (Gordura)',
      fields: [
        { key: 'tipo_gordura', label: 'Tipo de gordura', type: 'radio', options: [
          { value: 'compacta', label: 'Compacta' }, { value: 'flacida', label: 'Flácida' }] },
        { key: 'distribuicao', label: 'Distribuição', type: 'radio', options: [
          { value: 'localizada', label: 'Localizada' }, { value: 'generalizada', label: 'Generalizada' }] },
        { key: 'biotipo_corporal', label: 'Biotipo corporal', type: 'radio', options: [
          { value: 'ginoide', label: 'Ginóide (Pera)' }, { value: 'androide', label: 'Andróide (Maçã)' },
          { value: 'normolineo', label: 'Normolíneo' }] },
      ],
    },
    {
      title: 'Celulite (Lipodistrofia Ginóide)',
      fields: [
        { key: 'celulite_tipo', label: 'Tipo', type: 'radio', options: [
          { value: 'flacida', label: 'Flácida' }, { value: 'edematosa', label: 'Edematosa' }, { value: 'compacta', label: 'Compacta' }] },
        { key: 'celulite_grau', label: 'Grau', type: 'radio', options: [
          { value: 'I', label: 'I (Invisível)' }, { value: 'II', label: 'II (Casca de laranja)' },
          { value: 'III', label: 'III (Nódulos/Dor)' }, { value: 'IV', label: 'IV (Grave)' }] },
        { key: 'sensibilidade', label: 'Sensibilidade/dor à palpação?', type: 'boolean' },
        { key: 'sensibilidade_local', label: 'Local', type: 'text', showIf: { field: 'sensibilidade', truthy: true } },
      ],
    },
    {
      title: 'Edema e Flacidez',
      fields: [
        { key: 'edema_godet', label: 'Edema (sinal de Godet)', type: 'radio', options: [
          { value: 'negativo', label: 'Negativo' }, { value: 'positivo', label: 'Positivo' }] },
        { key: 'flacidez', label: 'Flacidez corporal', type: 'multiselect', options: [
          { value: 'tissular', label: 'Tissular (pele)' }, { value: 'muscular', label: 'Muscular' }] },
      ],
    },
    {
      title: 'Estrias',
      fields: [
        { key: 'estrias_qtd', label: 'Quantidade', type: 'radio', options: [
          { value: 'leve', label: 'Leve' }, { value: 'moderada', label: 'Moderada' },
          { value: 'intensa', label: 'Intensa' }, { value: 'grave', label: 'Grave' }] },
        { key: 'estrias_cor', label: 'Cor atual', type: 'radio', options: [
          { value: 'rubra', label: 'Rubra (recente)' }, { value: 'alba', label: 'Alba (antiga)' }] },
        { key: 'estrias_espessura', label: 'Espessura', type: 'radio', options: [
          { value: 'fina', label: 'Fina' }, { value: 'larga', label: 'Larga' }] },
        { key: 'estrias_tipo', label: 'Tipo', type: 'radio', options: [
          { value: 'atrofica', label: 'Atrófica' }, { value: 'hipertrofica', label: 'Hipertrófica' }] },
      ],
    },
    {
      title: 'Perimetria Antropométrica (Evolutiva)',
      fields: [
        {
          key: 'perimetria',
          label: 'Medidas (cm)',
          type: 'grid',
          full: true,
          grid: {
            rows: ['Busto', 'Braço Esq.', 'Braço Dir.', 'Cintura', 'Abdome', 'Quadril', 'Culote', 'Coxa Esq.', 'Coxa Dir.', 'Panturrilha Esq.', 'Panturrilha Dir.'],
            columns: [
              { key: 'inicial', label: 'Inicial' },
              { key: 'intermediaria', label: 'Intermediária' },
              { key: 'final', label: 'Final' },
            ],
          },
        },
      ],
    },
    planejamento,
  ],
}

export const assessmentSchemas = {
  dermato: dermatoSchema,
  capilar: capilarSchema,
  corporal: corporalSchema,
} as const
