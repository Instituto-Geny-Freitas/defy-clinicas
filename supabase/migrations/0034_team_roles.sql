-- =============================================================================
-- 0034_team_roles.sql
-- Domínio de Papéis da equipe (CRUD em Configurações). Cada papel mapeia para
-- um NÍVEL de acesso (enum user_role) que continua governando as permissões
-- (RLS). Assim o domínio é editável sem alterar as funções app.is_admin()/
-- app.is_staff(), que seguem lendo professionals.role.
-- =============================================================================

create table if not exists roles (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  nivel      user_role not null default 'profissional',  -- admin | profissional | recepcao
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

alter table roles enable row level security;
create policy roles_staff_read on roles for select to authenticated using (app.is_staff());
create policy roles_admin_write on roles for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Semeia os papéis iniciais para a clínica (instância única).
insert into roles (clinic_id, nome, nivel)
select c.id, v.nome, v.nivel::user_role
from clinics c
cross join (values ('Admin', 'admin'), ('Secretaria', 'recepcao'), ('Profissional', 'profissional')) as v(nome, nivel)
on conflict (clinic_id, nome) do nothing;
