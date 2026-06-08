# Manual do Administrador — Sistema da Clínica (Instituto Geny Freitas)

Guia de navegação e uso da **Área da Clínica** e do **Portal do Paciente**.
Aplicação web responsiva (PWA): funciona no computador e no celular, e pode ser
"instalada" na tela inicial do aparelho.

> **Acesso:** `https://defy-clinicas.vercel.app`

---

## 1. Entrar no sistema (login)

Na tela inicial há três formas de entrar:

- **Entrar com Google** — para quem usa conta Google (precisa estar habilitado).
- **CPF** — paciente entra com CPF + senha.
- **E-mail** — equipe (profissionais/admin) entra com e-mail + senha.

> Dica: se você digitar um **e-mail** na aba CPF, o sistema entende e usa o login por e-mail automaticamente.

**Esqueci minha senha:** clique no link na tela de login, informe o e-mail e
você receberá um link para redefinir.

**Primeiro acesso:** ao entrar com uma **senha provisória** (criada pela clínica),
o sistema **obriga a definir uma nova senha** antes de continuar. (Quem entra pelo
Google não passa por isso.)

### Perfis de acesso
- **Admin:** acesso total, incluindo Configurações e gestão da equipe.
- **Profissional:** atende pacientes e usa todos os módulos clínicos.
- **Recepção:** agenda, cadastro e financeiro.
- **Paciente:** vê apenas os próprios dados, no Portal do Paciente.

---

## 2. Primeira configuração (o que fazer antes de usar)

Acesse **Configurações** (menu lateral, somente admin). Há 5 abas:

### 2.1 Identidade visual
- Envie o **logo** da clínica.
- Defina a **paleta de cores** (primária, secundária, fundo, texto) — o app inteiro
  e os PDFs passam a usar essas cores.
- Preencha **nome, CNPJ, responsável técnico, WhatsApp**. O WhatsApp aqui é o
  número que o paciente usa para falar com a clínica.

### 2.2 Equipe
- **+ Novo profissional:** nome, e-mail (usado no login), papel (admin/profissional/recepção)
  e dados do conselho (ex.: CRBM 12345) — esses dados aparecem nos documentos formais.
- Na lista, cada profissional mostra **login ativo** ou **sem login**:
  - **Provisionar acesso** (sem login): cria o usuário, gera uma senha e mostra as
    credenciais para você entregar ao profissional.
  - **Redefinir senha** (login ativo): gera uma nova senha provisória.
  - Em ambos os casos, o profissional troca a senha no primeiro acesso.

### 2.3 Integrações
- Cadastro do **gateway de pagamento (PIX)**: provedor, ambiente (teste/produção),
  chave PIX, chave pública e URL de webhook. (As chaves **secretas** ficam fora do
  app, no servidor.)

### 2.4 Textos-padrão
- Crie/edite **modelos de texto** por categoria (ex.: Plano de tratamento). Eles
  ficam disponíveis para inserir com um clique ao montar planos e documentos.

### 2.5 Ativos (composição de fórmulas)
- Catálogo de **ativos** usados na composição das fórmulas manipuladas, classificados em
  **Ativos Gerais, Vitaminas, Esclerosantes e Anestésicos**.
- Cadastre/exclua ativos e use o **filtro por categoria** + busca. O catálogo já vem
  pré-carregado; ajuste conforme sua necessidade.

### 2.6 Tipos de Procedimento
- Lista dos **procedimentos** oferecidos (ex.: Skinbooster PDRN, Toxina botulínica…),
  usada como domínio ao registrar um atendimento. Cadastre/exclua livremente.

### 2.7 LGPD
- Edite o **texto** e a **versão** do termo de consentimento de tratamento de dados,
  apresentado no cadastro do paciente.

---

## 3. Navegação geral (Área da Clínica)

Menu lateral (no celular, abre pelo ☰):

| Item | Para quê |
|------|----------|
| **Dashboard** | Visão do dia: nº de pacientes, consultas de hoje, documentos pendentes, a receber e alertas de estoque |
| **Agenda** | Agendamentos, calendário e busca por data |
| **Pacientes** | Cadastro e prontuário completo |
| **Modelos de Documentos** | Criar/editar termos e orientações |
| **Estoque** | Produtos, lotes, validade, margem |
| **Financeiro** | Orçamentos, pagamentos e recebíveis |
| **Relatórios** | Faturamento, estoque e atendimentos |
| **Configurações** | Ajustes da clínica (só admin) |

---

## 4. Agenda

- **+ Novo:** cria um agendamento — escolha paciente, **profissional**, data (no
  **calendário**), horário de início/fim, procedimento e observações.
- **Filtro por profissional:** veja a agenda de um profissional específico ou de todos.
- **Buscar data:** use o campo de data ou clique em **📅 Ver calendário** para abrir
  o mês; **dias com agendamento ficam marcados**. Clique em "Limpar data" para voltar.
- Em cada agendamento: **Confirmar**, **Remarcar** (escolhe nova data no calendário),
  **Realizado** ou **Cancelar**.
- **Lembretes automáticos** de consulta são enviados conforme configurado.

---

## 5. Pacientes (o coração do sistema)

### 5.1 Lista e cadastro
- Busque por nome. **+ Novo paciente** abre o cadastro:
  - Dados pessoais (nome, nascimento — **idade calculada automaticamente**, CPF,
    WhatsApp, e-mail, profissão, estilo de trabalho, alergias).
  - **Acesso ao sistema:** defina a **senha provisória** (botão "Gerar"). Ao salvar,
    o sistema cria o login do paciente e mostra **login + senha** para você entregar.
  - **Consentimento LGPD:** marque quando o paciente consentir (registra data e versão).
  - **Limite de relatórios** (ao editar): quantos relatórios o paciente pode manter
    armazenados — controle de armazenamento (o paciente não pode alterar esse limite).

### 5.2 Ficha do paciente (abas)
Clique num paciente para abrir a ficha. No topo, **Editar** abre o cadastro
(inclui "Redefinir/Provisionar acesso" e o consentimento LGPD).

| Aba | O que faz |
|-----|-----------|
| **Resumo** | Dados pessoais, idade, status do consentimento LGPD |
| **Anamnese** | Ficha clínica e estética (também pode ser preenchida pelo paciente no portal) |
| **Avaliações** | Fichas **Dermato Funcional**, **Capilar** e **Corporal** (com escalas e perimetria) |
| **Plano** | Plano de tratamento — texto livre, **textos-padrão** e **✨ Sugerir com IA**. Permite **editar** e **excluir** planos |
| **Procedimentos** | Registra o atendimento; o **Procedimento** vem do domínio; **vincula a um Orçamento de um Plano** e dá **baixa no estoque** |
| **Medidas** | Peso, IMC, gordura etc. por sessão, com **gráfico de evolução** |
| **Suplementação** | Suplementos prescritos (medicação, via, validade, lote) |
| **Manipulação** | Fórmulas manipuladas — composição via **catálogo de ativos com filtro por categoria** + posologia + biblioteca |
| **Exames** | Requisição (painel padrão de 40 exames + extras) e resultados enviados |
| **Fotos** | Fotos clínicas antes/depois/evolução (bucket privado) |
| **Documentos** | Emitir termos/orientações, **assinar**, **gerar PDF** e **editar** |
| **Financeiro** | Orçamentos (**vinculados a um Plano**), pagamentos, saldo e **produtos utilizados** |
| **Relatórios** | Relatórios que o **paciente gerou** (procedimentos, manipulações, medidas, suplementações) — **visualizar e baixar** |

### 5.3 Encadeamento Plano → Orçamento → Procedimento
Para manter a integridade dos dados, o fluxo recomendado é:
1. **Crie o Plano** de tratamento (aba Plano).
2. **Crie o Orçamento** (aba Financeiro) e **vincule-o ao Plano**.
3. Ao **Registrar o Procedimento**, escolha o **Plano** e o **Orçamento** correspondente
   (o orçamento é obrigatório quando já existe algum). O sistema mostra
   *"Registrando em: Plano X › Orçamento Y"*.

Assim, cada procedimento (e os produtos utilizados nele) fica ligado a um orçamento,
que por sua vez pertence a um plano — e tudo aparece no **Financeiro** do paciente.

---

## 6. Modelos de Documentos

Crie e edite **termos** (consentimento) e **orientações** (cuidados) — tudo via CRUD.

- **Campos dinâmicos:** defina campos (rótulo, chave, tipo, obrigatório). A **chave**
  é usada no corpo do documento como `{{chave}}` e é substituída pelo valor preenchido
  na emissão.
- **Corpo do documento:** texto com os placeholders `{{...}}`.
- **Orientações:** podem ter **lembretes automáticos** (ex.: "após X horas" ou
  "repetir por N dias"), entregues por **aviso no app** e/ou **push**.
- Ao editar um modelo, a **versão** é incrementada; a emissão "congela" a versão usada.

**Como emitir:** na ficha do paciente → aba **Documentos → + Emitir documento** →
escolha o modelo → preencha → veja a pré-visualização → emitir. O paciente lê e
**assina** no portal; você pode **Gerar PDF** (com identificação do paciente, do
profissional e hash de integridade).

---

## 7. Estoque

- **+ Novo produto:** produto, marca, lote, validade, custo, preço de venda,
  quantidade inicial e **estoque mínimo**. A **margem** é calculada automaticamente.
- **+ Entrada:** lança reposição de estoque.
- **Alertas:** itens em **estoque baixo** (no/abaixo do mínimo) e com **validade
  próxima** (≤ 30 dias) ficam destacados aqui e no Dashboard.
- A **baixa automática** acontece quando você registra um procedimento com produtos.

---

## 8. Financeiro

- **Por paciente** (aba Financeiro da ficha): crie **orçamentos** (itens, desconto,
  total), registre **pagamentos** (PIX/cartão/dinheiro…) e acompanhe **pago × saldo**.
  Os **produtos utilizados** nos procedimentos vinculados aparecem dentro do orçamento.
- **Geral** (menu Financeiro): visão de **recebíveis** — total recebido, a receber e
  lista de orçamentos por paciente.

---

## 9. Relatórios

Indicadores do **mês atual** e visão geral:
- **Faturamento:** recebido no mês (por método de pagamento), a receber, total recebido.
- **Estoque:** valor de custo, valor de venda, itens em baixa, validade próxima.
- **Atendimento:** procedimentos e atendimentos realizados no mês.

---

## 10. Automação e notificações

- Ao **emitir uma orientação**, o sistema agenda os **avisos de cuidado** (no app e,
  se configurado, **push** no aparelho) conforme a programação do modelo.
- **Lembretes de consulta** são enfileirados automaticamente.
- O paciente vê os avisos em **Início** do portal e pode **ativar notificações** no
  aparelho.

---

## 11. Portal do Paciente (o que o paciente vê)

- **Início:** avisos/cuidados, ativar notificações, falar no WhatsApp.
- **Agendamentos:** ver consultas e **solicitar horário** (a clínica confirma).
- **Anamnese:** preencher a própria ficha antes da consulta.
- **Documentos:** ler e **assinar** termos; dar ciência em orientações; gerar PDF.
- **Evolução:** gráfico de medidas, **enviar resultados de exame** e ver fotos.
- **Relatórios:** escolhe **seções** (procedimentos, manipulações, medidas, suplementações)
  e **período**, gera um **PDF** (download + guardado no perfil) e gerencia os anteriores.
  Limitado pela quantidade definida pelo admin.
- **Financeiro:** orçamentos, saldos e produtos utilizados.

---

## 12. Gestão de acesso (resumo)

| Situação | Como resolver |
|----------|----------------|
| Novo paciente precisa entrar | Cadastro já cria o login; entregue login + senha mostrados |
| Paciente esqueceu a senha | Paciente usa "Esqueci minha senha" (se tiver e-mail) **ou** você usa Editar → Redefinir acesso |
| Novo profissional | Configurações → Equipe → Provisionar acesso |
| Profissional esqueceu a senha | Configurações → Equipe → Redefinir senha (ou "Esqueci minha senha") |
| Forçar troca no 1º acesso | Automático para senhas provisórias (exceto login Google) |

---

## 13. Dicas finais

- O app **republica sozinho** a cada atualização; basta **recarregar a página**.
- No celular, use **"Adicionar à tela inicial"** para instalar como aplicativo.
- Os dados são protegidos por permissões: **paciente vê só o que é dele**; a equipe
  vê os pacientes da clínica.
- **PDF de documentos** serve como comprovante (traz identificação e hash de integridade).

---

*Este manual cobre as funcionalidades desenvolvidas até o momento. Itens em evolução:
cobrança PIX automática e envio por WhatsApp (dependem de contas externas).*
