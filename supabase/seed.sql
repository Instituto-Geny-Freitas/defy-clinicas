-- =============================================================================
-- seed.sql — dados iniciais do Instituto Geny Freitas.
-- Idempotente (on conflict do nothing). UUIDs fixos para reprodutibilidade.
-- =============================================================================

-- Clínica (instância única) ---------------------------------------------------
insert into clinics (id, nome, razao_social, responsavel_tecnico, telefone, whatsapp, tema_cores, dados_empresa)
values (
  '00000000-0000-0000-0000-0000000c1111',
  'Instituto Geny Freitas',
  'Instituto Geny Freitas',
  'Maria Geny de Freitas',
  '11995744524',
  '11995744524',
  '{"primaria":"#0f766e","secundaria":"#e11d48","fundo":"#f8fafc","texto":"#0f172a"}'::jsonb,
  '{"cidade":"São Paulo","uf":"SP","rodape_pdf":"Instituto Geny Freitas — São Paulo/SP"}'::jsonb
)
on conflict (id) do nothing;

-- Profissional responsável (vincular auth_user_id no 1º login) -----------------
insert into professionals (id, clinic_id, nome, telefone, role, ativo)
values (
  '00000000-0000-0000-0000-0000000a0001',
  '00000000-0000-0000-0000-0000000c1111',
  'Maria Geny de Freitas',
  '11995744524',
  'admin',
  true
)
on conflict (id) do nothing;

-- TERMO geral de autorização (procedimentos faciais) --------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, schema, corpo)
values (
  '00000000-0000-0000-0000-0000000d0001',
  '00000000-0000-0000-0000-0000000c1111',
  'termo',
  'Termo de Autorização e Orientações para Procedimento',
  'geral_facial',
  true,
  '[
    {"key":"procedimento_sessao","label":"Procedimento desta sessão","type":"text","required":true},
    {"key":"valor","label":"Valor dos serviços (R$)","type":"number","required":false},
    {"key":"uso_imagem","label":"Autoriza uso de imagem (redes sociais, sem identidade)","type":"boolean","required":true}
  ]'::jsonb,
  'O(s) procedimento(s) realizados na Clínica Instituto Geny Freitas como: aplicação de Toxina Botulínica do tipo A, Preenchedores faciais com Ácido Hialurônico, Skinbooster, fios de PDO, microagulhamento, peeling químico, Bioestimulador de Colágeno, intradermoterapia, Laser e procedimentos de estética básica em geral, foram a mim esclarecidos pelo profissional abaixo referido. O procedimento a ser realizado nesta sessão será {{procedimento_sessao}}. Declaro estar ciente dos efeitos adversos possíveis (vermelhidão, marcas, edema, hematomas, inflamação, cefaléia, sensibilidade, prurido, descamação, alergias, entre outros descritos em bula). Pelos serviços contratados, o(a) paciente pagará o valor total de R$ {{valor}}.'
)
on conflict (id) do nothing;

-- TERMO específico de Criolipólise --------------------------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, schema, corpo)
values (
  '00000000-0000-0000-0000-0000000d0002',
  '00000000-0000-0000-0000-0000000c1111',
  'termo',
  'Termo de Autorização e Orientações — Criolipólise',
  'criolipolise',
  true,
  '[
    {"key":"valor","label":"Valor dos serviços (R$)","type":"number","required":false},
    {"key":"uso_imagem","label":"Autoriza uso de imagem (redes sociais, sem identidade)","type":"boolean","required":true}
  ]'::jsonb,
  'A criolipólise é um tratamento não invasivo que utiliza resfriamento de áreas do corpo para reduzir células de gordura. CONTRA-INDICAÇÕES: gestantes, infecções ou feridas na área, sensibilidade/alergia ao resfriamento, herniações ou cirurgia recente no local e doenças autoimunes. Estou ciente dos riscos (vermelhidão, pontos roxos, áreas endurecidas, e raramente hiperplasia paradoxal e risco de queimadura). Pelos serviços contratados pagarei R$ {{valor}}.'
)
on conflict (id) do nothing;

-- ORIENTAÇÃO pós Toxina Botulínica --------------------------------------------
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, reminder_schedule, corpo)
values (
  '00000000-0000-0000-0000-0000000d0003',
  '00000000-0000-0000-0000-0000000c1111',
  'orientacao',
  'Cuidados pós Toxina Botulínica',
  'toxina_botulinica',
  false,
  '[
    {"offset_horas":0,"canal":"whatsapp","mensagem":"Cuidados pós toxina: nas primeiras 4-6h não baixe a cabeça, não faça força/peso, evite calor e massagens locais."},
    {"offset_horas":240,"canal":"whatsapp","mensagem":"Lembrete: revisão da toxina em consulta em até 10 dias."}
  ]'::jsonb,
  'Cuidados nas primeiras 4 a 6 horas: não baixar a cabeça; não fazer força nem pegar peso; academia só após 24h; evitar banho quente, calor, avião e massagens locais nas primeiras 24h; não coçar o local. Liberado protetor solar e cosmético. O efeito aparece entre 2-5 dias. Revisão em até 10 dias em consulta.'
)
on conflict (id) do nothing;

-- ORIENTAÇÃO pós Bioestimulador (com lembretes de massagem 5x/dia por 5 dias) --
insert into document_templates (id, clinic_id, tipo, nome, procedimento_rel, requer_assinatura, reminder_schedule, corpo)
values (
  '00000000-0000-0000-0000-0000000d0004',
  '00000000-0000-0000-0000-0000000c1111',
  'orientacao',
  'Cuidados pós Bioestimulador de Colágeno',
  'bioestimulador',
  false,
  '[
    {"repetir":"5x/dia","por_dias":5,"canal":"push","mensagem":"Massagem: 5 minutos em cada local de aplicação, 5x ao dia, por 5 dias."}
  ]'::jsonb,
  'Não se maquiar nas 24h seguintes; evitar atividades extenuantes nas 24h; evitar sol, sauna e banhos muito quentes até recuperação; compressas frias podem ser feitas. Intervalo de 45-60 dias entre sessões de PLLA (máx. 4 sessões/ano). IMPORTANTE (home care): 5 MINUTOS DE MASSAGEM EM CADA LOCAL DE APLICAÇÃO, 5 VEZES AO DIA, POR 5 DIAS.'
)
on conflict (id) do nothing;

-- Opções padrão de exames laboratoriais (texto padrão reutilizável) -----------
insert into treatment_text_snippets (clinic_id, categoria, titulo, conteudo)
values (
  '00000000-0000-0000-0000-0000000c1111',
  'exames_lab',
  'Painel laboratorial padrão',
  'Vitamina D, Vit. B12, Testosterona, Testost. Livre, Hemoglobina Glicada, Glicemia, Insulina, PCR, Vit. C, Ferro, Ferritina, Cortisol sérico, Ácido Fólico, TSH, T4 Livre, T3, T4, Hemograma Completo, HB+HT, Plaquetas, Na+, K+, Ca+, Mg, Cálcio Iônico, Colesterol total, HDL, LDL, VLDL, Triglicerídeos, Cobre, Zinco, Amilase, Lipase, TGO, TGP, Ureia, Creatinina, Homocisteína, Eosinófilos.'
)
on conflict do nothing;
