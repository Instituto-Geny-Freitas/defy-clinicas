-- 0069_internal_activity_status_rpc.sql
-- Permite ao RESPONSÁVEL (além de admin/criador) mudar apenas o STATUS e a
-- data efetivada de uma atividade — sem poder alterar os demais campos.
-- Implementado como função SECURITY DEFINER (restringe as colunas alteráveis);
-- a policy de UPDATE geral continua só para admin/criador.

create or replace function public.set_internal_activity_status(p_id uuid, p_status text, p_data_efetivada date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act  internal_activities%rowtype;
  v_prof uuid := app.current_professional_id();
begin
  select * into v_act from internal_activities where id = p_id;
  if not found then raise exception 'Atividade não encontrada'; end if;
  if p_status not in ('pendente','executado','redirecionado') then
    raise exception 'Status inválido';
  end if;
  -- Só admin, criador ou responsável podem mudar o status.
  if not (app.is_admin() or v_act.created_by = v_prof or v_act.responsavel_professional_id = v_prof) then
    raise exception 'Sem permissão para alterar o status desta atividade';
  end if;

  update internal_activities
     set status = p_status,
         data_efetivada = case
           when p_status = 'executado' then coalesce(p_data_efetivada, data_efetivada, current_date)
           else p_data_efetivada
         end,
         updated_at = now()
   where id = p_id;

  -- Log das atividades criadas pelo Admin (auditoria dos ajustes).
  if v_act.origem = 'admin' and v_act.status is distinct from p_status then
    insert into internal_activity_log (clinic_id, activity_id, changed_by, changed_by_nome, campo, de, para)
    values (v_act.clinic_id, p_id, v_prof, (select nome from professionals where id = v_prof), 'status', v_act.status, p_status);
  end if;
end;
$$;

grant execute on function public.set_internal_activity_status(uuid, text, date) to authenticated;
