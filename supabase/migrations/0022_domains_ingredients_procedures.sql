-- =============================================================================
-- 0022_domains_ingredients_procedures.sql
-- Domínios: ativos de composição (por categoria) e tipos de procedimento.
-- Seed gerado a partir de catalogo_ativos_organizado.pdf e Tabela.pdf.
-- =============================================================================

create table if not exists active_ingredients (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  codigo      text,
  nome        text not null,
  categoria   text not null,   -- gerais | vitaminas | esclerosantes | anestesicos
  apresentacao text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_active_ingredients_cat on active_ingredients(categoria);

create table if not exists procedure_types (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table active_ingredients enable row level security;
alter table procedure_types    enable row level security;
create policy ai_staff on active_ingredients for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy pt_staff on procedure_types    for all to authenticated using (app.is_staff()) with check (app.is_staff());

do $$ begin
  if not exists (select 1 from active_ingredients) then
    insert into active_ingredients (clinic_id, codigo, nome, categoria, apresentacao) values
  ('00000000-0000-0000-0000-0000000c1111','501','5-OH-Triptofano 10mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','598','Acetil-L-Carnitina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','502','Ácido Alfa Lipóico 10mg/2ml - AMP 2ml','gerais','EV/IM/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','503','Ácido Alfa Lipóico 600mg/20ml - FR 20ml','gerais','EV/IM/ID Cx 10 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','599','Ácido Fólico 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','505','Ácido Glicólico 20mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','506','Ácido Hialurônico não reticulado 30mg/2ml','gerais','SC/ID Cx 5 fras. FR 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','507','Ácido Hialurônico não reticulado 30mg/2ml','gerais','SC/ID Cx 10 fras. FR 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','508','Ácido Hialurônico não reticulado 40mg/3ml','gerais','SC/ID Cx 5 fras. FR 3ml'),
  ('00000000-0000-0000-0000-0000000c1111','509','Ácido Hialurônico não reticulado 40mg/3ml','gerais','SC/ID Cx 10 fras. FR 3ml'),
  ('00000000-0000-0000-0000-0000000c1111','510','Ácido Hialurônico não reticulado 4mg/2ml','gerais','SC/ID Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','511','Ácido Mandélico 20mg + Ác. Kojico 20mg +','gerais','ID Cx 10 amp. Ác.Fítico 20mg/ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','512','Ácido Tranexâmico 8mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','513','ADN (Ácido Hialurônico não reticulado 10mg +','gerais','ID Cx 10 fras. Condroitin 25mg/ml - FR 2,5ml)'),
  ('00000000-0000-0000-0000-0000000c1111','514','Alfa Arbutin 20mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','515','Asiaticosídeo 0,6mg/ml - AMP 2ml','gerais','IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','516','BCAA (L-Leucina 10mg + L-Isoleucina 10mg +','gerais','EV/IM/SC Cx 10 amp. L-Valina 10mg/ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','517','BCAA (L-Leucina 10mg + L-Isoleucina 10mg +','gerais','EV/IM/SC Cx 10 amp. L-Valina 10mg/ml ) + HMB 50mg/5ml - AMP 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','518','Benzopirona 1mg/2ml - AMP 2ml','gerais','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','520','Cafeína 120mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','521','Cafeína 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','640','Citrulina 100mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','609','Cloreto de Magnésio 400mg/ml - AMP 1ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','523','Coenzima Q10 100mg/1ml - AMP 1ml','gerais','IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','610','Coenzima Q10 100mg/1ml - AMP 1ml','gerais','IM Cx 5 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','524','Colágeno 10mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','525','Colina 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','526','Condroitin Sulfato 200mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','527','Crisina 100mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','529','Desoxicolato de Sódio 50mg/ml - AMP 2ml','gerais','SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','530','DMSO 20mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','531','DMAE 140mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','532','DMAE 60mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','533','D-Pantenol (Vitamina B5) 50mg/ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','642','D-Ribose 500mg/AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','534','Dutasterida 0,1% (1mg) - AMP 1ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','535','Elastina 10mg/ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','536','Finasterida 1 mg/2ml - AMP 2ml','gerais','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','538','GABA 25mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','539','GAG (Glicosaminoglicano) 20mg/2ml - AMP','gerais','EV/IM/ID Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','643','Glutationa 250mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','540','HMB (hidroximetilbutirato) 50mg/2ml - AMP','gerais','EV/IM/SC Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','541','Inositol 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','542','Inositol 200mg + Taurina 200mg/2ml - AMP','gerais','EV/IM/SC/ID Cx 10 amp. 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','543','Ioimbina 5mg/ml - AMP 2ml','gerais','SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','544','L-Fenilalanina 50 mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','545','L-Arginina 1000mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','547','L-Carnitina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','614','L-Glicina 100mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','615','L-Glutamina 150mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','618','L-Lisina 300mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','619','L-Prolina 600mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','548','L-Carnitina 500mg + Cafeina 65mg/5ml - AMP','gerais','EV/IM/SC/ID Cx 10 amp. 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','549','Vit B12 1mg + Metionina 50mg + Inositol 75mg','gerais','EV/IM/SC Cx 10 amp. + Colina75mg - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','550','L-Metionina 100mg/2ml - AMP 2ml','gerais','EV/IM/ID/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','551','L-Ornitina 150mg/2ml - AMP 2ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','552','L-Taurina 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','553','L-Theanina 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','554','L-Triptofano 50mg/5ml - AMP 5ml','gerais','EV/IM/SC Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','621','Melatonina 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','622','Melatonina 3mg /2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','624','Metilfolato (5-MTHF ou 5-Metiltetrahidrofolato)','gerais','EV/IM/SC Cx 10 amp. 3500mcg/1ml AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','555','Minoxidil 10mg/2ml - AMP 2ml','gerais','ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','645','MSM 15% AMP 10ml','gerais','EV/IM/SC Cx 5 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','625','N-Acetil Cisteína 300mg/2ml - AMP 2ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','626','NADH 50mg pó liofilizado','gerais','EV/IM/SC Cx 4 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','557','Pentoxifilina 40mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','226','PDRN 80mg/4ml - FR 4ml','gerais','ID Cx 4 fras.'),
  ('00000000-0000-0000-0000-0000000c1111','558','Picolinato de Cromo 100mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','559','Pill Food (L-Metionina 25mg + L-Taurina 50mg','gerais','EV/IM/ID Cx 10 amp. + L-Prolina 10mg + Biotina 10mg + D-Pantenol 10mg + Vit B2 5mg + Vit B310mg + Vit B610mg/ 2ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','628','Pill Food (L - Metionina 62,5mg + L Taurina','gerais','EV/IM/ID Cx 10 amp. 125mg + L Prolina 25mg + Biotina 25mg + D- Pantenol 25mg + Vit.B2 12,5mg + Vit. B3 25mg + Vit.B6 25mg + Lisina 20mg/5ml) - AMP 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','629','Piracetam 500mg - AMP 1ml','gerais','EV/IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','560','Pool de Oligominerais (Silício + Cobre + Zinco','gerais','IM/SC/ID Cx 10 amp. + Magnésio + Cromo) 50mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','561','Piruvato de Sódio 20mg/2ml - AMP 2ml','gerais','SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','562','PQQ (Pirroloquinolina Quinona) 5mg/2ml','gerais','EV/IM/SC Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','563','Resveratrol 5mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','630','SAMe (S-Adenosilmetionina) 200mg/2ml','gerais','EV/IM Cx 10 amp. AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','631','Selênio 80mcg/ml - AMP 1ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','657','Sulfato de Magnésio 10% - AMP 10ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','564','Silício 10mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','565','Sulfato de Cobre 500mcg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','566','Sulfato de Magnésio 200mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','568','Sulfato de Zinco 20mg/2ml - AMP 2ml','gerais','EV/IM/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','569','Sulfato de Zinco 20mg + Sulfato de Magnésio','gerais','EV/IM/SC/ID Cx 10 amp. 200mg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','570','Teacrina 50mg/2ml - AMP 2ml','gerais','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','600','ADEK2 100','vitaminas','IM Cx 5 amp. 20.000UI+100.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','601','ADEK2 100','vitaminas','IM Cx 10 amp. 20.000UI+100.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','602','ADEK2 600','vitaminas','IM Cx 5 amp. 20.000UI+600.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','603','ADEK2 600','vitaminas','IM Cx 10 amp. 20.000UI+600.000UI+10UI+1300mcg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','572','Biotina (vitamina H ou B7) 10mg/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','573','Complexo B (c/ B1)*B1+B2+B3+B5+B6','vitaminas','EV/IM/SC/ID Cx 10 amp. 5mg+1,25mg+15mg+3mg+1,25mg/1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','574','Complexo B (s/ B1)*B2+B3+B5+B6','vitaminas','EV/IM/SC Cx 10 amp. 10mg+10mg+50mg+10mg/2ml - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','649','Trio Metilador (Vit B6 10mg + Metilfolato','vitaminas','EV/IM Cx 10 amp. 2500mcg + Metilcobalamina 2600mcg/2ml) - AMP 2ml'),
  ('00000000-0000-0000-0000-0000000c1111','575','Vitamina B12 (Cianocobalamina ) 2500mcg/','vitaminas','EV/IM/SC/ID Cx 10 amp. 1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','576','Vitamina B12 (Metilcobalamina) 2500mcg/ml','vitaminas','EV/IM/SC/ID Cx 10 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','623','Vitamina B12 (Metilcobalamina) 5000mcg/ml','vitaminas','EV/IM/SC/ID Cx 10 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','577','Vitamina B5 (D Pantenol) 50mg/ml - AMP 2ml','vitaminas','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','578','Vitamina B6 (Piridoxina) 50mg/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','580','Vitamina C 20%/2ml - AMP 2ml','vitaminas','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','635','Vitamina C (Ácido Ascórbico) 1,2g /5ml - AMP','vitaminas','EV/IM/SC/ID Cx 10 amp. 5ml'),
  ('00000000-0000-0000-0000-0000000c1111','658','Vitamina D3 (colecalciferol) 10.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','636','Vitamina D3 (colecalciferol) 100.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','637','Vitamina D3 (colecalciferol) 600.000 UI / 1ml','vitaminas','IM Cx 5 amp. AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','638','Vitamina K2 MK7 1300mcg/1ml - AMP 1ml','vitaminas','IM Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','586','Vitamina K2 MK7 + Vitamina D3 1300mcg+','vitaminas','IM Cx 10 amp. 600.000 UI/1ml - AMP 1ml'),
  ('00000000-0000-0000-0000-0000000c1111','587','Glicose 75%/3ml - AMP 3ml','esclerosantes','EV Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','589','Lidocaína 2%/10ml - FR 10ml','anestesicos','IM/SC/ID Cx 10 Frasco 10ml'),
  ('00000000-0000-0000-0000-0000000c1111','590','Lidocaína 40mg/2ml - AMP 2ml','anestesicos','IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','591','Procaína 40mg/2ml - AMP 2ml','anestesicos','EV/IM/SC/ID Cx 10 amp.'),
  ('00000000-0000-0000-0000-0000000c1111','593','Procaína 200mg/10ml - FR 10ml','anestesicos','EV/IM/SC/ID Cx 10 fras.');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from procedure_types) then
    insert into procedure_types (clinic_id, nome) values
  ('00000000-0000-0000-0000-0000000c1111','Peeling de Algas Marinhas'),
  ('00000000-0000-0000-0000-0000000c1111','Limpeza de pele'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster com colágeno / elastina / DMAE ou zinco'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster com Peptídeos'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster PDRN'),
  ('00000000-0000-0000-0000-0000000c1111','Skinbooster exossomos'),
  ('00000000-0000-0000-0000-0000000c1111','Aplicação de Fios de PDO'),
  ('00000000-0000-0000-0000-0000000c1111','Seringa de Ácido hialurônico'),
  ('00000000-0000-0000-0000-0000000c1111','Toxina botulínica'),
  ('00000000-0000-0000-0000-0000000c1111','Crio Modelação Corporal'),
  ('00000000-0000-0000-0000-0000000c1111','Crio Modelação Facial'),
  ('00000000-0000-0000-0000-0000000c1111','Ozonioterapia'),
  ('00000000-0000-0000-0000-0000000c1111','Bioestimulador colágeno PLLA'),
  ('00000000-0000-0000-0000-0000000c1111','Bioestimulador colágeno Hidroxiapatita'),
  ('00000000-0000-0000-0000-0000000c1111','Drenagem linfática'),
  ('00000000-0000-0000-0000-0000000c1111','Massagem relaxante'),
  ('00000000-0000-0000-0000-0000000c1111','Eletrocauterização Avançada (Jato de Plasma)');
  end if;
end $$;
