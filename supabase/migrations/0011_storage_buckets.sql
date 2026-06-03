-- =============================================================================
-- 0011_storage_buckets.sql
-- Buckets de Storage e políticas de acesso.
--   • branding  : público (logo da clínica, exibido no portal/PDF).
--   • patient-files : privado (fotos clínicas, PDFs assinados, exames).
-- Estrutura de pasta sugerida em patient-files: <patient_id>/<categoria>/<arquivo>
-- assim a 1ª pasta do path identifica o dono.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- BRANDING: leitura pública; escrita só admin -------------------------------
create policy branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

create policy branding_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'branding' and app.is_admin())
  with check (bucket_id = 'branding' and app.is_admin());

-- PATIENT-FILES: equipe acessa tudo; paciente acessa sua própria pasta -------
-- A pasta raiz do objeto deve ser o patient_id (texto).
create policy patient_files_staff on storage.objects for all to authenticated
  using (bucket_id = 'patient-files' and app.is_staff())
  with check (bucket_id = 'patient-files' and app.is_staff());

create policy patient_files_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text
  );

create policy patient_files_owner_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = app.current_patient_id()::text
  );
