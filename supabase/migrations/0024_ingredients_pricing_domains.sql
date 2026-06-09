-- =============================================================================
-- 0024_ingredients_pricing_domains.sql
-- Ativos: Via de aplicação (domínio), fornecedor (domínio), preços de aquisição
-- e de venda com margem (%). CRUDs de Vias de administração e Fornecedores.
-- =============================================================================

create table if not exists administration_routes (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  contato    text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table active_ingredients
  add column if not exists via             text,
  add column if not exists fornecedor      text,
  add column if not exists preco_aquisicao numeric(12,2) not null default 0,
  add column if not exists margem_pct      numeric(6,2)  not null default 0,
  add column if not exists preco_venda     numeric(12,2) not null default 0;

alter table administration_routes enable row level security;
alter table suppliers              enable row level security;
create policy ar_staff  on administration_routes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy sup_staff on suppliers              for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Seed das vias de administração
do $$ begin
  if not exists (select 1 from administration_routes) then
    insert into administration_routes (clinic_id, nome) values
      ('00000000-0000-0000-0000-0000000c1111', 'Oral'),
      ('00000000-0000-0000-0000-0000000c1111', 'Endovenosa');
  end if;
end $$;
