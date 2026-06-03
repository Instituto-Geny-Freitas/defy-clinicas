-- =============================================================================
-- 0016_appointment_reminders_cron.sql
-- Lembretes automáticos de consulta. Uma função enfileira notificações para
-- agendamentos nas próximas 24h ainda sem lembrete; o pg_cron a executa
-- periodicamente.
--
-- OBS: requer a extensão pg_cron. No Supabase, habilite em
-- Database → Extensions → pg_cron (ou rode o create extension abaixo). Se o
-- create extension falhar por permissão, habilite pela UI e rode só o trecho
-- do cron.schedule.
-- =============================================================================

-- Enfileira lembretes para consultas nas próximas 24h --------------------------
create or replace function app.enqueue_appointment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (clinic_id, patient_id, tipo, canal, titulo, payload, agendado_para, appointment_id)
  select a.clinic_id, a.patient_id, 'lembrete_consulta', 'in_app',
         'Lembrete de consulta',
         jsonb_build_object('inicio', a.inicio, 'procedimento', a.procedimento),
         now(), a.id
  from appointments a
  where a.status in ('agendado', 'confirmado')
    and a.lembrete_enviado_em is null
    and a.inicio between now() and now() + interval '24 hours';

  update appointments
     set lembrete_enviado_em = now()
   where status in ('agendado', 'confirmado')
     and lembrete_enviado_em is null
     and inicio between now() and now() + interval '24 hours';
end;
$$;

comment on function app.enqueue_appointment_reminders() is
  'Enfileira lembretes (notifications) para consultas nas próximas 24h sem lembrete.';

-- Agendamento periódico (a cada 15 min) ---------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('lembretes-consulta');
exception when others then
  null; -- ainda não existia
end $$;

select cron.schedule(
  'lembretes-consulta',
  '*/15 * * * *',
  $$ select app.enqueue_appointment_reminders(); $$
);
