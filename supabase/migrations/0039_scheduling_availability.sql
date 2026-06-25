-- =============================================================================
-- 0039_scheduling_availability.sql
-- Agenda por profissional:
--   1) Agrupa séries recorrentes (recorrencia_grupo) para editar/excluir todas.
--   2) Disponibilidade do profissional: janelas semanais (dia + faixa de horas)
--      e bloqueios de datas (férias / indisponibilidade).
--   3) Função check_slot(): valida se um horário está livre/dentro da agenda do
--      profissional — chamável pelo paciente (SECURITY DEFINER) sem expor dados.
-- Observação de fuso: a clínica opera em America/Sao_Paulo; a função compara o
-- dia da semana e a hora nesse fuso (os agendamentos são gravados em UTC).
-- =============================================================================

-- 1) Séries recorrentes -------------------------------------------------------
alter table appointments add column if not exists recorrencia_grupo uuid;
create index if not exists idx_appointments_grupo on appointments(recorrencia_grupo);

-- 2) Disponibilidade semanal --------------------------------------------------
create table if not exists professional_availability (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6),  -- 0=Dom ... 6=Sáb
  hora_inicio     time not null,
  hora_fim        time not null,
  created_at      timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);
create index if not exists idx_avail_prof on professional_availability(professional_id);

alter table professional_availability enable row level security;
create policy avail_read on professional_availability for select to authenticated using (true);
create policy avail_staff_write on professional_availability for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- Bloqueios de datas (indisponibilidade / férias) -----------------------------
create table if not exists professional_blocks (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date not null,
  motivo          text,
  created_at      timestamptz not null default now(),
  check (data_fim >= data_inicio)
);
create index if not exists idx_blocks_prof on professional_blocks(professional_id);

alter table professional_blocks enable row level security;
create policy blocks_read on professional_blocks for select to authenticated using (true);
create policy blocks_staff_write on professional_blocks for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- 3) Verificação de horário ---------------------------------------------------
-- Devolve: 'ok' | 'ocupado' | 'fora_horario' | 'bloqueado'.
create or replace function public.check_slot(p_prof uuid, p_inicio timestamptz, p_fim timestamptz default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fim   timestamptz := coalesce(p_fim, p_inicio + interval '30 minutes');
  v_local timestamp   := (p_inicio at time zone 'America/Sao_Paulo');
  v_dow   int         := extract(dow from v_local);
  v_time  time        := v_local::time;
  v_date  date        := v_local::date;
  v_tem_janela boolean;
begin
  if p_prof is null then
    return 'ok';  -- sem profissional definido, não há agenda para validar
  end if;

  -- Bloqueio de data (férias / indisponível)
  if exists (
    select 1 from professional_blocks b
    where b.professional_id = p_prof and v_date between b.data_inicio and b.data_fim
  ) then
    return 'bloqueado';
  end if;

  -- Janelas de disponibilidade: se houver alguma cadastrada, o horário precisa
  -- cair dentro de uma delas no dia da semana. Sem nenhuma janela = sempre livre.
  select exists (select 1 from professional_availability a where a.professional_id = p_prof)
    into v_tem_janela;
  if v_tem_janela then
    if not exists (
      select 1 from professional_availability a
      where a.professional_id = p_prof and a.dia_semana = v_dow
        and v_time >= a.hora_inicio and v_time < a.hora_fim
    ) then
      return 'fora_horario';
    end if;
  end if;

  -- Conflito com outro agendamento ativo do profissional (sobreposição)
  if exists (
    select 1 from appointments ap
    where ap.professional_id = p_prof
      and ap.status not in ('cancelado')
      and ap.inicio < v_fim
      and coalesce(ap.fim, ap.inicio + interval '30 minutes') > p_inicio
  ) then
    return 'ocupado';
  end if;

  return 'ok';
end;
$$;
