-- =============================================================================
-- 0059_slots_livres.sql — Horários livres para agendamento online do paciente
--
-- slots_livres(profissional, data, duração) devolve os horários de INÍCIO livres
-- naquele dia: dentro das janelas de disponibilidade do profissional, fora dos
-- bloqueios, sem conflito com agendamentos ativos e apenas no futuro.
-- SECURITY DEFINER para o paciente chamar sem expor dados de outros agendamentos.
-- Espelha a lógica de [[check_slot]] (0039). 100% aditivo.
-- =============================================================================
begin;

create or replace function public.slots_livres(p_prof uuid, p_date date, p_dur_min int default 30)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz       text := 'America/Sao_Paulo';
  v_dow    int  := extract(dow from p_date);
  w        record;
  t        time;
  cand_ini timestamptz;
  cand_fim timestamptz;
  out_arr  text[] := '{}';
  agora    timestamptz := now();
begin
  if p_prof is null or p_dur_min <= 0 then return out_arr; end if;

  -- Data bloqueada (férias / indisponibilidade) → nenhum horário.
  if exists (
    select 1 from professional_blocks b
    where b.professional_id = p_prof and p_date between b.data_inicio and b.data_fim
  ) then
    return out_arr;
  end if;

  -- Para cada janela do dia da semana, fatia em intervalos de p_dur_min.
  for w in
    select hora_inicio, hora_fim from professional_availability a
    where a.professional_id = p_prof and a.dia_semana = v_dow
    order by hora_inicio
  loop
    t := w.hora_inicio;
    while (t + make_interval(mins => p_dur_min)) <= w.hora_fim loop
      cand_ini := (p_date + t) at time zone tz;   -- hora local → timestamptz (UTC)
      cand_fim := cand_ini + make_interval(mins => p_dur_min);
      if cand_ini >= agora and not exists (
        select 1 from appointments ap
        where ap.professional_id = p_prof
          and ap.status <> 'cancelado'
          and ap.inicio < cand_fim
          and coalesce(ap.fim, ap.inicio + interval '30 minutes') > cand_ini
      ) then
        out_arr := array_append(out_arr, to_char(t, 'HH24:MI'));
      end if;
      t := t + make_interval(mins => p_dur_min);
    end loop;
  end loop;

  return out_arr;
end;
$$;

grant execute on function public.slots_livres(uuid, date, int) to authenticated;

commit;
