-- 0081_patients_trim_nome.sql
-- Nomes de paciente gravados com espaço no início/fim saíam fora de ordem nas
-- listas (o Postgres não ignora espaços na ordenação; espaço vem antes das letras,
-- então " Sebastião" aparecia entre os nomes com "A"). Aditivo e idempotente,
-- sem blocos $$ (pode colar direto no SQL Editor).
--
-- 1) Trigger: remove espaços (inclusive tab, quebra de linha e espaço "duro" NBSP)
--    do início/fim do nome em TODO insert/update — cobre cadastro, edição,
--    anamnese, assistente e qualquer outro caminho.
-- 2) Limpa os nomes já gravados.

create or replace function app.patients_trim_nome() returns trigger
language plpgsql as
'begin
  if new.nome is not null then
    new.nome := btrim(new.nome, chr(32) || chr(9) || chr(10) || chr(13) || chr(160));
  end if;
  return new;
end;';

drop trigger if exists trg_patients_trim_nome on patients;
create trigger trg_patients_trim_nome
  before insert or update of nome on patients
  for each row execute function app.patients_trim_nome();

update patients
   set nome = btrim(nome, chr(32) || chr(9) || chr(10) || chr(13) || chr(160))
 where nome <> btrim(nome, chr(32) || chr(9) || chr(10) || chr(13) || chr(160));
