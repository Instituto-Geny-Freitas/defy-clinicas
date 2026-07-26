-- Recorrência ganha DATA-LIMITE de alerta (data_limite). Enquanto null, é
-- permanente (comportamento atual, retrocompatível). Com data definida, o
-- sistema para de gerar alertas depois dela. Aditivo/idempotente.
alter table recurrence_recommendations add column if not exists data_limite date;
