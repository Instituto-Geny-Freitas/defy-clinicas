-- 0072_nps_respostas.sql
-- NPS configurável: guarda as respostas das PERGUNTAS ADICIONAIS definidas pelo
-- admin (Configurações → NPS). A definição das perguntas vive em
-- clinics.dados_empresa.nps (sem tabela nova, como o motor de formulários);
-- aqui só o valor respondido, por id de pergunta. Aditivo e idempotente.

alter table nps_responses
  add column if not exists respostas jsonb not null default '{}'::jsonb;

comment on column nps_responses.respostas is
  'Respostas das perguntas adicionais do NPS: { "<id_da_pergunta>": valor }. A definição fica em clinics.dados_empresa.nps.perguntas.';
