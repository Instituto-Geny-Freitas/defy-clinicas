-- =============================================================================
-- 0010_rls_policies.sql
-- Row Level Security. Regra geral:
--   • Equipe (app.is_staff()) acessa tudo da clínica.
--   • Paciente acessa/edita apenas as próprias linhas.
-- Políticas são combinadas por OR; várias políticas SELECT ampliam o acesso.
-- =============================================================================

-- Habilita RLS em todas as tabelas -------------------------------------------
alter table clinics                  enable row level security;
alter table professionals            enable row level security;
alter table patients                 enable row level security;
alter table document_templates       enable row level security;
alter table document_instances       enable row level security;
alter table anamnesis                enable row level security;
alter table assessments              enable row level security;
alter table perimetry                enable row level security;
alter table body_measurements        enable row level security;
alter table procedures_log           enable row level security;
alter table treatment_plans          enable row level security;
alter table treatment_text_snippets  enable row level security;
alter table supplementations         enable row level security;
alter table formulations             enable row level security;
alter table formulation_prescriptions enable row level security;
alter table lab_orders               enable row level security;
alter table lab_results              enable row level security;
alter table appointments             enable row level security;
alter table inventory                enable row level security;
alter table stock_movements          enable row level security;
alter table quotes                   enable row level security;
alter table payments                 enable row level security;
alter table notifications            enable row level security;
alter table patient_guidance         enable row level security;
alter table push_subscriptions       enable row level security;

-- CLÍNICA ---------------------------------------------------------------------
-- Dados de marca/contato são lidos por qualquer autenticado (portal precisa do
-- logo, cores e dados da empresa). Só admin altera.
create policy clinics_select on clinics for select to authenticated using (true);
create policy clinics_admin  on clinics for all   to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- PROFISSIONAIS ---------------------------------------------------------------
-- Equipe e pacientes podem ler (nome/conselho aparecem em documentos).
create policy professionals_select on professionals for select to authenticated using (true);
-- Admin gerencia toda a equipe.
create policy professionals_admin on professionals for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
-- Profissional pode atualizar o próprio cadastro.
create policy professionals_self_update on professionals for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- PACIENTES -------------------------------------------------------------------
create policy patients_staff on patients for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy patients_self_select on patients for select to authenticated
  using (auth_user_id = auth.uid());
create policy patients_self_update on patients for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- MODELOS DE DOCUMENTO --------------------------------------------------------
create policy doc_templates_staff on document_templates for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
-- Paciente lê modelos ativos (orientações/termos a consentir).
create policy doc_templates_patient_read on document_templates for select to authenticated
  using (ativo);

-- INSTÂNCIAS DE DOCUMENTO -----------------------------------------------------
create policy doc_instances_staff on document_instances for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy doc_instances_patient_read on document_instances for select to authenticated
  using (patient_id = app.current_patient_id());
-- Paciente assina/consente o próprio documento (update das colunas de aceite).
create policy doc_instances_patient_sign on document_instances for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- Macro auxiliar: política padrão "staff tudo + paciente lê o próprio" --------
-- (escrita manualmente por tabela abaixo, pois SQL não tem template de policy)

-- ANAMNESE (paciente pode preencher) -----------------------------------------
create policy anamnesis_staff on anamnesis for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy anamnesis_patient_read on anamnesis for select to authenticated
  using (patient_id = app.current_patient_id());
create policy anamnesis_patient_insert on anamnesis for insert to authenticated
  with check (patient_id = app.current_patient_id());
create policy anamnesis_patient_update on anamnesis for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- AVALIAÇÕES (somente leitura para paciente) ---------------------------------
create policy assessments_staff on assessments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy assessments_patient_read on assessments for select to authenticated
  using (patient_id = app.current_patient_id());

-- PERIMETRIA (ownership via assessment) --------------------------------------
create policy perimetry_staff on perimetry for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy perimetry_patient_read on perimetry for select to authenticated
  using (exists (
    select 1 from assessments a
    where a.id = perimetry.assessment_id
      and a.patient_id = app.current_patient_id()
  ));

-- MEDIDAS CORPORAIS -----------------------------------------------------------
create policy body_meas_staff on body_measurements for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy body_meas_patient_read on body_measurements for select to authenticated
  using (patient_id = app.current_patient_id());

-- PROCEDIMENTOS ---------------------------------------------------------------
create policy procedures_staff on procedures_log for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy procedures_patient_read on procedures_log for select to authenticated
  using (patient_id = app.current_patient_id());

-- PLANO DE TRATAMENTO ---------------------------------------------------------
create policy plans_staff on treatment_plans for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy plans_patient_read on treatment_plans for select to authenticated
  using (patient_id = app.current_patient_id());

-- TEXTOS PADRÃO (somente equipe) ---------------------------------------------
create policy snippets_staff on treatment_text_snippets for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- SUPLEMENTAÇÃO ---------------------------------------------------------------
create policy suppl_staff on supplementations for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy suppl_patient_read on supplementations for select to authenticated
  using (patient_id = app.current_patient_id());

-- FÓRMULAS (biblioteca: somente equipe) --------------------------------------
create policy formulations_staff on formulations for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- PRESCRIÇÕES DE FÓRMULA ------------------------------------------------------
create policy form_presc_staff on formulation_prescriptions for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy form_presc_patient_read on formulation_prescriptions for select to authenticated
  using (patient_id = app.current_patient_id());

-- EXAMES: REQUISIÇÕES ---------------------------------------------------------
create policy lab_orders_staff on lab_orders for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy lab_orders_patient_read on lab_orders for select to authenticated
  using (patient_id = app.current_patient_id());

-- EXAMES: RESULTADOS (paciente pode enviar o próprio) ------------------------
create policy lab_results_staff on lab_results for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy lab_results_patient_read on lab_results for select to authenticated
  using (patient_id = app.current_patient_id());
create policy lab_results_patient_insert on lab_results for insert to authenticated
  with check (patient_id = app.current_patient_id());

-- AGENDAMENTOS (paciente solicita/confirma/cancela o próprio) -----------------
create policy appts_staff on appointments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy appts_patient_read on appointments for select to authenticated
  using (patient_id = app.current_patient_id());
create policy appts_patient_insert on appointments for insert to authenticated
  with check (patient_id = app.current_patient_id());
create policy appts_patient_update on appointments for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- ESTOQUE (somente equipe) ----------------------------------------------------
create policy inventory_staff on inventory for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy stock_mov_staff on stock_movements for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- FINANCEIRO ------------------------------------------------------------------
create policy quotes_staff on quotes for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy quotes_patient_read on quotes for select to authenticated
  using (patient_id = app.current_patient_id());

create policy payments_staff on payments for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy payments_patient_read on payments for select to authenticated
  using (patient_id = app.current_patient_id());

-- NOTIFICAÇÕES (paciente lê e marca como lida) -------------------------------
create policy notif_staff on notifications for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy notif_patient_read on notifications for select to authenticated
  using (patient_id = app.current_patient_id());
create policy notif_patient_update on notifications for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- ORIENTAÇÕES INDICADAS (paciente lê/consente) -------------------------------
create policy guidance_staff on patient_guidance for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy guidance_patient_read on patient_guidance for select to authenticated
  using (patient_id = app.current_patient_id());
create policy guidance_patient_update on patient_guidance for update to authenticated
  using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- PUSH SUBSCRIPTIONS (dono) ---------------------------------------------------
create policy push_owner on push_subscriptions for all to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
