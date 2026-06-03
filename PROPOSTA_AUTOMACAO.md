# Proposta de Automação — Clínica de Estética (Instituto Geny Freitas)

> Documento de análise e arquitetura inicial gerado a partir do material fornecido
> (arquivo "Instruções iniciais" + 17 documentos/fichas modelo).
> Stack-alvo: **Supabase** (Postgres + Auth + Storage + Edge Functions) + frontend web/PWA.

> **Decisões definidas (2026-06-03):**
> - **Login do paciente:** Google (OAuth) + CPF/senha. Instagram/Facebook ficam para fase futura.
> - **WhatsApp:** link `wa.me` no MVP; API oficial (envio automatizado) em fase posterior.
> - **Assinatura de termos:** aceite interno com registro de IP, data/hora, versão e hash do documento.
> - **Escopo:** instância única do Instituto Geny Freitas (um estabelecimento, um ou mais profissionais)
>   — sem camada SaaS multi-clínica. A tabela `clinics` existe como **registro único de configuração**.

---

## 1. Entendimento do projeto

Sistema de gestão para clínica de estética, multiprofissional, com:

- **Área administrativa/clínica** (profissionais) — prontuário, fichas, agenda, estoque, financeiro.
- **Portal do paciente** (logado) — acesso aos próprios dados, agendamentos, leitura/consentimento
  de orientações, notificações de cuidados e lembretes de consulta, interação via WhatsApp.
- **Formalização de documentos** — termos de consentimento, fichas e orientações com assinatura
  e versionamento, tudo configurável via CRUD (modelos dinâmicos).
- **Configuração visual white-label** — cores, logo e dados da empresa por clínica.

---

## 2. Análise documento por documento → automação correspondente

| # | Documento | O que é | Entidade / Módulo | Automação principal |
|---|-----------|---------|-------------------|---------------------|
| 1 | Instruções iniciais | Briefing geral | — | Define escopo |
| 2 | TERMO DE AUTORIZAÇÃO E ORIENTAÇÕES | Consentimento (TCLE) genérico de procedimentos faciais | `document_templates` (tipo: termo) | **Formulário dinâmico** por procedimento, assinatura eletrônica, versionado, gera PDF |
| 3 | Termos Crio | TCLE específico de Criolipólise (contraindicações, riscos, uso de imagem) | `document_templates` | Mesmo motor de termos; comprova que termos variam por procedimento |
| 4 | Avaliação clínica (Anamnese) | Ficha de anamnese clínica e estética completa | `anamnesis` | **Pré-preenchida** com cadastro; preenchível pelo paciente no portal ou pelo profissional |
| 5 | Avaliação Dermato Funcional | Avaliação facial avançada (Fitzpatrick, Glogau, lesões, etc.) | `assessment_dermato` | Ficha estruturada com campos padronizados (escalas) |
| 6 | Capilar - Avaliação clínica | Ficha de avaliação capilar + plano + orçamento | `assessment_capilar` | Ficha + gera plano/orçamento vinculado |
| 7 | Corporal - Avaliação clínica | Ficha corporal (celulite, estrias) + perimetria | `assessment_corporal` | Ficha + tabela de perimetria evolutiva |
| 8 | Medidas corporal | Acompanhamento de medidas por sessão (peso, IMC, gordura...) | `body_measurements` | **Evolução por sessão** com gráficos; entrada por bioimpedância |
| 9 | Procedimentos | Registro dos procedimentos realizados | `procedures_log` | Histórico cronológico; baixa de estoque automática |
| 10 | Plano de Tratamento | Texto livre + domínios de textos padrão | `treatment_plans` | Texto padrão selecionável; **sugestão por IA** conforme tratamento |
| 11 | Suplementação | Suplementos prescritos (medicação, via, lote, validade) | `supplementations` | Prescrição vinculada ao paciente; alerta de validade |
| 12 | Manipulação / Prescrição | Fórmulas manipuladas prescritas | `formulations` | Biblioteca de fórmulas reutilizáveis + prescrição; gera PDF p/ farmácia |
| 13 | Exames Lab | Checklist de exames a requisitar | `lab_orders` / `lab_results` | Requisição com checklist; paciente faz upload do resultado |
| 14 | Cuidados pós Toxina Botulínica | Orientação pós-procedimento | `guidance_templates` | **Push/WhatsApp automático** após o procedimento |
| 15 | Cuidados pós Bioestimulador | Orientação pós-procedimento | `guidance_templates` | Idem — incluindo lembretes recorrentes (ex.: massagem 5x/dia por 5 dias) |
| 16 | Controle de Estoque (xlsx) | Estoque com lote, validade, custo, venda, lucro | `inventory` + `stock_movements` | Baixa por uso/venda, **alerta de validade e estoque mínimo**, margem |
| 17 | Orçamento Estética (Junho) | Orçamento + controle de pagamentos/saldos | `quotes` + `payments` | Orçamento → contrato → **pagamentos (PIX via gateway)**, saldo a receber |

---

## 3. Arquitetura proposta (Supabase)

### Camadas
- **Auth (Supabase Auth)**
  - Paciente: login **Google (OAuth)** ou **CPF + senha**. (Instagram/Facebook em fase futura.)
  - Profissional/Admin: e-mail + senha (+ 2FA recomendado).
- **Banco (Postgres)** com **Row Level Security (RLS)** — pilar central:
  - Paciente só enxerga as próprias linhas (filtro por `auth_user_id`).
  - Profissional/Admin enxergam todos os pacientes da clínica.
  - Instância única: `clinic_id` ainda existe nas tabelas como boa prática e para o
    registro único de configuração, mas **não há isolamento entre múltiplas clínicas**.
- **Storage** — logo da clínica, fotos de evolução, PDFs assinados, resultados de exame.
- **Edge Functions** — geração de PDF, envio WhatsApp, webhooks de pagamento, sugestões de IA.
- **Realtime** — chat/notificações in-app.
- **pg_cron / Scheduled Functions** — lembretes de consulta, alertas de validade de estoque,
  sequências de cuidados pós-procedimento.

### Frontend
- Web responsivo / **PWA** (permite notificação push e "instalar" no celular do paciente).
- Sugestão: React + Vite (ou Next.js) + Tailwind, com tema dinâmico (white-label).

---

## 4. Modelo de dados (entidades principais)

```
clinics (id, nome, cnpj, endereço, logo_url, tema_cores JSONB, dados_empresa)
professionals (id, clinic_id, nome, conselho_tipo, conselho_numero, especialidade, assinatura_url)
patients (id, clinic_id, nome, cpf, nascimento, email, whatsapp, auth_user_id, ...)

document_templates (id, clinic_id, tipo[termo|orientacao|ficha], nome, schema JSONB, corpo, versao, ativo)
document_instances (id, template_id, patient_id, professional_id, procedure_id,
                    dados JSONB, status[pendente|lido|assinado], assinado_em, pdf_url, hash)

anamnesis (id, patient_id, dados JSONB, preenchido_por[paciente|profissional], data)
assessments (id, patient_id, tipo[dermato|capilar|corporal], dados JSONB, fotos[], data)
body_measurements (id, patient_id, sessao, data, peso, imc, gordura, musculo, rm, kcal,
                   idade_corporal, gordura_visceral)
perimetry (id, assessment_id, regiao, inicial, intermediaria, final)

treatment_plans (id, patient_id, professional_id, texto, recursos[], sessoes, frequencia, valor)
procedures_log (id, patient_id, professional_id, procedimento, data, produtos_usados[], obs)
supplementations (id, patient_id, medicacao, via, validade, lote, data)
formulations (id, clinic_id?, patient_id?, nome, composicao JSONB, posologia)  -- biblioteca + prescrição
lab_orders (id, patient_id, exames[], data); lab_results (id, order_id, arquivo_url, valores JSONB)

guidance_templates (id, clinic_id, titulo, conteudo, procedimento_rel, sequencia_lembretes JSONB)
patient_guidance (id, patient_id, guidance_id, enviado_em, lido_em, consentido_em)

appointments (id, clinic_id, patient_id, professional_id, inicio, fim, status, procedimento)
quotes (id, patient_id, itens JSONB, valor_total, desconto, status)
payments (id, quote_id, valor, metodo[pix|cartao|dinheiro], status, pago_em, gateway_ref)

inventory (id, clinic_id, produto, lote, validade, custo_unit, preco_venda, qtd_atual, qtd_minima)
stock_movements (id, inventory_id, tipo[entrada|saida|uso], qtd, ref_procedure_id?, data)
notifications (id, patient_id, tipo, payload, canal[push|whatsapp|email], enviado_em, lido_em)
```

---

## 5. Automações-chave (o coração do sistema)

1. **Motor de documentos dinâmicos (CRUD de modelos)**
   Termos, orientações e fichas são *templates* com campos definíveis (JSON Schema). A clínica cria
   N modelos. Ao atender, o profissional escolhe o modelo → instancia → paciente lê/assina → gera PDF
   com hash e timestamp (validade jurídica / LGPD).

2. **Assinatura e consentimento eletrônico**
   Paciente assina no portal (desenho/aceite) → registra IP, data/hora, versão do termo.
   Profissional assina com dados do conselho (vindos do cadastro).

3. **Pré-preenchimento inteligente de fichas**
   Anamnese e avaliações herdam dados do cadastro do paciente; paciente pode preencher pelo portal
   antes da consulta (economiza tempo no atendimento).

4. **Sequências de cuidados pós-procedimento**
   Ao registrar um procedimento, dispara a orientação correspondente + lembretes programados
   (ex.: Bioestimulador → "massagem 5 min, 5x/dia, por 5 dias"; revisão de toxina em 10 dias).
   Canais: push (PWA) + WhatsApp.

5. **Lembretes de agendamento**
   Notificação automática X horas antes; confirmação/reagendamento pelo paciente.

6. **Gestão de estoque automatizada**
   Baixa ao registrar procedimento/venda; alertas de **estoque mínimo** e **validade próxima**;
   relatório de custo/margem/lucro (já presente na planilha atual).

7. **Financeiro e pagamentos**
   Orçamento → controle de saldos e parcelas → integração com **gateway PIX** (ex.: Mercado Pago,
   Asaas, Pagar.me) → webhook confirma pagamento e baixa o saldo automaticamente.

8. **Interação WhatsApp**
   Botão "falar com o profissional" (deep link `wa.me`) e, em fase posterior, API oficial
   (WhatsApp Cloud API) para envio automatizado de lembretes e orientações.

9. **IA de apoio ao Plano de Tratamento**
   Sugestão de texto/conduta conforme procedimento e achados das fichas (domínio de textos padrão
   + geração assistida).

10. **Configuração white-label**
    Upload de logo, paleta de cores e dados da empresa por clínica, refletidos em UI e PDFs.

---

## 6. Perfis de acesso (RLS)

- **Admin da clínica** — configura clínica, profissionais, modelos, estoque, financeiro.
- **Profissional** — pacientes, fichas, procedimentos, prescrições, agenda.
- **Recepção** (opcional) — agenda, cadastro, financeiro básico.
- **Paciente** — seus dados, agendamentos, documentos para ler/assinar, orientações, exames.

---

## 7. Roadmap sugerido (MVP → completo)

**Fase 1 — MVP (fundação)**
- Auth (paciente + profissional), multi-tenant, configuração white-label.
- Cadastro de pacientes e profissionais.
- Motor de documentos dinâmicos + assinatura + PDF (termos e orientações).
- Anamnese + 3 fichas de avaliação (dermato, capilar, corporal) com pré-preenchimento.

**Fase 2 — Operação clínica**
- Agenda + lembretes automáticos.
- Procedimentos, plano de tratamento, suplementação, manipulação, exames.
- Medidas corporais com evolução/gráficos.
- Orientações pós-procedimento automáticas (push/WhatsApp).

**Fase 3 — Gestão e crescimento**
- Estoque com alertas + relatórios de margem.
- Orçamento + pagamentos PIX (gateway).
- Portal do paciente completo + WhatsApp + IA no plano de tratamento.

---

## 8. Pontos a confirmar com a cliente

**Todos definidos:**
- Login: Google + CPF/senha · WhatsApp: `wa.me` no MVP · Assinatura: aceite interno c/ hash ·
  Escopo: instância única Geny.
- **Gateway PIX:** arquitetura "plugável" — o gateway (Asaas/Mercado Pago/Pagar.me) é escolhido
  na área de **Configurações** (`integration_settings`). A tabela `payments` já é agnóstica
  (`gateway`, `gateway_ref`, `pix_*`). Chaves secretas ficam em Vault/Edge secrets, nunca no banco
  legível pelo app.
- **Anamnese:** preenchível por **ambos** — paciente (portal, antes da consulta) e profissional.
  Já suportado (`anamnesis.preenchido_por` + RLS de insert/update do paciente).
- **Fotos de evolução:** **no MVP** — tabela `clinical_photos` (antes/depois/evolução, agrupáveis
  por `grupo_id`), arquivos no bucket privado `patient-files`.
- **Frontend:** **React + Vite + TypeScript (PWA)** + Tailwind + shadcn/ui, cliente `supabase-js`,
  hospedagem em CDN estática (Cloudflare Pages/Vercel/Netlify — free tier). Escolha por custo baixo,
  segurança (RLS no Supabase, sem backend próprio a manter) e praticidade.
```
