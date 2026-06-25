-- =============================================================================
-- 0040_exam_types.sql
-- Domínio configurável de exames laboratoriais (CRUD em Configurações), usado no
-- painel "Requisitar exames". Substitui a lista fixa EXAMES_PADRAO, preservando
-- a ordem definida pela clínica (coluna ordem).
-- =============================================================================

create table if not exists exam_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, nome)
);

alter table exam_types enable row level security;
create policy exam_types_staff_read on exam_types for select to authenticated using (app.is_staff());
create policy exam_types_admin_write on exam_types for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

insert into exam_types (clinic_id, nome, ordem)
select c.id, v.nome, v.ord
from clinics c
cross join (values
  ('Sódio', 1), ('Potássio', 2), ('Cálcio', 3), ('Magnésio', 4), ('Fósforo', 5),
  ('Ca iônico', 6), ('Colesterol Total', 7), ('HDL Colesterol', 8), ('LDL Colesterol', 9),
  ('VLDL Colesterol', 10), ('Triglicérides', 11), ('Cobre', 12), ('Zinco', 13),
  ('Hemoglobina Glicada', 14), ('Glicose', 15), ('Insulina', 16), ('Apolipoproteína A1', 17),
  ('Apolipoproteína B', 18), ('Proteínas Totais e Frações', 19), ('Proteína C Reativa', 20),
  ('Ácido Fólico', 21), ('Vitamina B12', 22), ('Vitamina C', 23), ('Vitamina A', 24),
  ('25 Vitamina D', 25), ('Amilase', 26), ('Bilirrubina total e frações', 27),
  ('Fosfatase alcalina', 28), ('Gama GT', 29), ('Lipase', 30),
  ('TGO/AST Aspartato Aminotransferase', 31), ('TGP/ALT Alanina Aminotransferase', 32),
  ('Creatinina', 33), ('Uréia', 34), ('Hemograma Completo', 35), ('Hb + Ht', 36),
  ('Plaquetas', 37), ('Coagulograma (TP e TTPA)', 38), ('TSH', 39), ('T4L', 40),
  ('T3', 41), ('T4', 42), ('Cortisol sérico', 43), ('Cortisol urinário', 44),
  ('Cortisol salivar', 45), ('Homocisteína', 46), ('Ácido Úrico', 47), ('Ferritina', 48),
  ('Ferro', 49), ('Transferrina', 50), ('LH+FSH', 51), ('Prolactina', 52),
  ('Estradiol', 53), ('Progesterona', 54), ('Testosterona', 55), ('Testosterona Livre', 56)
) as v(nome, ord)
on conflict (clinic_id, nome) do nothing;
