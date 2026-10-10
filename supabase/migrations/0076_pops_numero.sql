-- 0075_pops_numero.sql
-- Numeração oficial do POP (ex.: "001/2026"), exibida no documento e no PDF.
-- O índice único por (clinic_id, numero) evita duplicidade e permite a carga
-- idempotente dos POPs (insert ... on conflict). Aditivo e idempotente.

alter table pops
  add column if not exists numero text;

comment on column pops.numero is
  'Número oficial do POP no formato NNN/AAAA (ex.: 001/2026). Único por clínica.';

-- NULLs são distintos entre si no Postgres: POPs sem número continuam possíveis.
create unique index if not exists pops_clinic_numero_uidx
  on pops (clinic_id, numero);
