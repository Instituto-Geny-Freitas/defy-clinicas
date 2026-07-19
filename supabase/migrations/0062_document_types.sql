-- Tipos de documento gerenciáveis (CRUD) para o dropdown "Tipo" dos modelos.
-- Aditivo e idempotente. NÃO altera o enum document_type nem colunas existentes:
-- document_templates.tipo (enum) continua sendo gravado (derivado da natureza do
-- tipo escolhido), então todo o fluxo atual de emissão/consentimento/rótulos e os
-- lembretes (natureza "orientacao") seguem inalterados.

create table if not exists document_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  rotulo     text not null,
  natureza   text not null default 'termo' check (natureza in ('termo', 'orientacao')),
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, rotulo)
);
create index if not exists idx_document_types_clinic on document_types(clinic_id);

-- Modelo passa a referenciar o tipo gerenciado (mantém a coluna tipo enum p/ compat).
alter table document_templates add column if not exists tipo_id uuid references document_types(id) on delete set null;
create index if not exists idx_document_templates_tipo_id on document_templates(tipo_id);

alter table document_types enable row level security;

do $$ begin
  create policy doc_types_staff on document_types for all to authenticated
    using (app.is_staff()) with check (app.is_staff());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy doc_types_patient_read on document_types for select to authenticated
    using (ativo);
exception when duplicate_object then null; end $$;

-- Semeia os dois tipos padrão por clínica (idempotente).
insert into document_types (clinic_id, rotulo, natureza, ordem)
select c.id, v.rotulo, v.natureza, v.ordem
from clinics c
cross join (values
  ('Termo (consentimento)', 'termo', 0),
  ('Orientação (cuidados)', 'orientacao', 1)
) as v(rotulo, natureza, ordem)
on conflict (clinic_id, rotulo) do nothing;

-- Vincula os modelos existentes ao tipo semeado correspondente à sua natureza.
update document_templates t
set tipo_id = dt.id
from document_types dt
where t.tipo_id is null
  and dt.clinic_id = t.clinic_id
  and ( (t.tipo = 'termo'      and dt.rotulo = 'Termo (consentimento)')
     or (t.tipo = 'orientacao' and dt.rotulo = 'Orientação (cuidados)') );
