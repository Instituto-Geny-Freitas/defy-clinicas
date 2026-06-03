-- =============================================================================
-- 0002_helpers_and_triggers.sql
-- Gatilho genérico de updated_at. (As funções de identidade de RLS são criadas
-- em 0003, após as tabelas professionals/patients existirem — funções SQL têm
-- o corpo validado na criação.)
-- =============================================================================

-- Atualiza automaticamente a coluna updated_at em qualquer tabela ------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
