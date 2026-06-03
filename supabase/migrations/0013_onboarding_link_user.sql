-- =============================================================================
-- 0013_onboarding_link_user.sql
-- Onboarding automático: quando um usuário é criado no Supabase Auth, vincula-o
-- ao registro existente de profissional ou paciente.
--
-- Regras de vínculo (na ordem):
--   1) professional com mesmo e-mail e ainda sem auth_user_id;
--   2) patient com mesmo e-mail e ainda sem auth_user_id;
--   3) patient por CPF — no login por CPF o e-mail é sintético "<cpf>@<dominio>".
--
-- Só vincula registros AINDA NÃO vinculados (auth_user_id IS NULL), evitando
-- "sequestro" de cadastros já associados a outra conta. Sem correspondência,
-- o usuário fica "não vinculado" e o app orienta procurar a recepção.
--
-- IMPORTANTE: o domínio do e-mail sintético DEVE corresponder ao
-- VITE_CPF_EMAIL_DOMAIN do frontend (padrão: geny.local).
-- =============================================================================

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf_domain text := 'geny.local';
  v_cpf text;
begin
  -- 1) Profissional por e-mail
  update professionals
     set auth_user_id = new.id
   where auth_user_id is null
     and email is not null
     and email = new.email;
  if found then
    return new;
  end if;

  -- 2) Paciente por e-mail
  update patients
     set auth_user_id = new.id
   where auth_user_id is null
     and email is not null
     and email = new.email;
  if found then
    return new;
  end if;

  -- 3) Paciente por CPF (login por CPF -> e-mail sintético)
  if new.email like ('%@' || v_cpf_domain) then
    v_cpf := split_part(new.email, '@', 1);
    update patients
       set auth_user_id = new.id
     where auth_user_id is null
       and cpf = v_cpf;
  end if;

  return new;
end;
$$;

comment on function app.handle_new_user() is
  'Vincula um novo usuário do Auth ao profissional/paciente existente (por e-mail ou CPF).';

-- Dispara após a criação do usuário no Auth.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
