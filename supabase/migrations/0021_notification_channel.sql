-- =============================================================================
-- 0021_notification_channel.sql
-- Atualiza o trigger de orientações para respeitar o CANAL definido em cada item
-- da reminder_schedule (push | whatsapp | email | in_app). Default: in_app.
-- Assim, itens com "canal":"push" geram notificações que a Edge Function
-- send-push entrega como Web Push.
-- =============================================================================

create or replace function app.on_document_issued()
returns trigger
language plpgsql
as $$
declare
  v_tipo  document_type;
  v_sched jsonb;
  item    jsonb;
  v_dias  int;
  v_canal notification_channel;
  d       int;
begin
  select tipo, reminder_schedule into v_tipo, v_sched
  from document_templates where id = new.template_id;

  if v_tipo is distinct from 'orientacao' then
    return new;
  end if;

  insert into patient_guidance (clinic_id, patient_id, template_id, professional_id, procedure_id, indicado_em)
  values (new.clinic_id, new.patient_id, new.template_id, new.professional_id, new.procedure_id, now());

  for item in select * from jsonb_array_elements(coalesce(v_sched, '[]'::jsonb))
  loop
    v_canal := coalesce((item->>'canal')::notification_channel, 'in_app');
    if item ? 'repetir' then
      v_dias := coalesce((item->>'por_dias')::int, 1);
      for d in 0 .. (v_dias - 1) loop
        insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
        values (new.clinic_id, new.patient_id, 'pos_procedimento', v_canal,
                'Cuidados pós-procedimento',
                jsonb_build_object('mensagem', item->>'mensagem', 'repetir', item->>'repetir'),
                now() + make_interval(days => d), new.id);
      end loop;
    else
      insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
      values (new.clinic_id, new.patient_id, 'pos_procedimento', v_canal,
              'Cuidados pós-procedimento',
              jsonb_build_object('mensagem', item->>'mensagem'),
              now() + make_interval(hours => coalesce((item->>'offset_horas')::int, 0)), new.id);
    end if;
  end loop;

  return new;
end;
$$;
