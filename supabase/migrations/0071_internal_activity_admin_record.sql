-- 0071_internal_activity_admin_record.sql
-- Vincula (opcional) uma Atividade Interna a um registro administrativo
-- (admin_records) — ex.: a atividade "medir temperatura" apontando para a
-- medição registrada no formulário. Aditivo e idempotente. ON DELETE SET NULL
-- (excluir o registro não apaga a atividade; só desfaz o vínculo).

alter table internal_activities
  add column if not exists admin_record_id uuid references admin_records(id) on delete set null;

create index if not exists internal_activities_admin_record_idx on internal_activities (admin_record_id);
