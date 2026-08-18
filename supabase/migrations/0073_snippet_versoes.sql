-- 0073_snippet_versoes.sql
-- Edição de textos-padrão COM histórico de versões.
--
-- Importante: quando um texto-padrão é inserido num plano/observação, o
-- conteúdo é COPIADO para o registro do paciente — então o histórico clínico
-- nunca muda ao editar o texto-padrão. Este histórico guarda as versões
-- ANTERIORES do próprio texto-padrão, para auditoria e para poder restaurar.
-- Aditivo e idempotente.

alter table treatment_text_snippets
  add column if not exists versao     int not null default 1,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists treatment_text_snippet_versions (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  snippet_id      uuid not null references treatment_text_snippets(id) on delete cascade,
  versao          int  not null,
  categoria       text,
  titulo          text not null,
  conteudo        text not null,
  created_by      uuid references professionals(id) on delete set null,
  created_by_nome text,
  created_at      timestamptz not null default now(),
  unique (snippet_id, versao)
);
create index if not exists idx_snippet_versions_snippet
  on treatment_text_snippet_versions (snippet_id, versao desc);

comment on table treatment_text_snippet_versions is
  'Versões anteriores dos textos-padrão. Os textos já inseridos em planos/observações são cópias e não mudam ao editar o texto-padrão.';

alter table treatment_text_snippet_versions enable row level security;
do $$ begin
  create policy snippet_versions_staff on treatment_text_snippet_versions for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;
