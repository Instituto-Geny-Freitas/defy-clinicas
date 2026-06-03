-- =============================================================================
-- 0015_automation_triggers.sql
-- Automação no nível do banco: ao EMITIR uma orientação para o paciente
-- (document_instances de um template tipo 'orientacao'), o sistema:
--   1) registra a indicação de leitura (patient_guidance);
--   2) enfileira notificações conforme a reminder_schedule do modelo.
-- As notificações entram com canal 'in_app' (exibidas no portal). O envio por
-- WhatsApp/push é feito depois por uma Edge Function que lê a fila.
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
  d       int;
begin
  select tipo, reminder_schedule into v_tipo, v_sched
  from document_templates
  where id = new.template_id;

  -- Só orientações disparam a sequência de cuidados.
  if v_tipo is distinct from 'orientacao' then
    return new;
  end if;

  -- Indicação de leitura/consentimento.
  insert into patient_guidance (clinic_id, patient_id, template_id, professional_id, procedure_id, indicado_em)
  values (new.clinic_id, new.patient_id, new.template_id, new.professional_id, new.procedure_id, now());

  -- Enfileira notificações conforme a programação do modelo.
  for item in select * from jsonb_array_elements(coalesce(v_sched, '[]'::jsonb))
  loop
    if item ? 'repetir' then
      -- Ex.: { "repetir":"5x/dia", "por_dias":5, "mensagem":"..." }
      -- Simplificação: 1 lembrete/dia por 'por_dias' dias (a Edge Function
      -- pode expandir para várias vezes ao dia ao enviar).
      v_dias := coalesce((item->>'por_dias')::int, 1);
      for d in 0 .. (v_dias - 1) loop
        insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
        values (new.clinic_id, new.patient_id, 'pos_procedimento', 'in_app',
                'Cuidados pós-procedimento',
                jsonb_build_object('mensagem', item->>'mensagem', 'repetir', item->>'repetir'),
                now() + make_interval(days => d),
                new.id);
      end loop;
    else
      -- Ex.: { "offset_horas":0, "mensagem":"..." }
      insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, document_instance_id)
      values (new.clinic_id, new.patient_id, 'pos_procedimento', 'in_app',
              'Cuidados pós-procedimento',
              jsonb_build_object('mensagem', item->>'mensagem'),
              now() + make_interval(hours => coalesce((item->>'offset_horas')::int, 0)),
              new.id);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_document_issued on document_instances;
create trigger on_document_issued
  after insert on document_instances
  for each row execute function app.on_document_issued();

comment on function app.on_document_issued() is
  'Ao emitir uma orientação, registra patient_guidance e enfileira notificações da reminder_schedule.';
