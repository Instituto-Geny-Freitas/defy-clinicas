-- =============================================================================
-- 0035_clinic_branding_public.sql
-- Expõe apenas os dados de MARCA da clínica (nome, logo, cores, whatsapp) para
-- usuários anônimos, de modo que a tela de login e o 1º carregamento já apareçam
-- com a identidade visual configurada. A tabela clinics permanece protegida por
-- RLS (apenas autenticados); a view limita as colunas públicas.
-- =============================================================================

create or replace view v_clinic_branding
with (security_invoker = false) as
  select id, nome, logo_url, tema_cores, whatsapp
  from clinics;

-- Leitura pública (anon) e autenticada apenas desta view (colunas de marca).
grant select on v_clinic_branding to anon, authenticated;
