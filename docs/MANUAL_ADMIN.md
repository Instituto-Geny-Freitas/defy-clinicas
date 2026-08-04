# Manual do Administrador — Sistema da Clínica (Instituto Geny Freitas)

Guia de navegação e uso da **Área da Clínica** e do **Portal do Paciente**.
Aplicação web responsiva (PWA): funciona no computador e no celular, e pode ser
"instalada" na tela inicial do aparelho, já com a **logo, o nome e as cores** da
clínica (identidade visual).

> **Acesso:** `https://app-institutogenyfreitas.vercel.app`

---

## 1. Entrar no sistema (login)

A tela de login já exibe a **logo e o nome** da clínica. Há três formas de entrar:

- **Entrar com Google** — para quem usa conta Google (precisa estar habilitado).
- **CPF** — paciente entra com CPF + senha.
- **E-mail** — equipe (profissionais/admin) entra com e-mail + senha.

> Dica: se você digitar um **e-mail** na aba CPF, o sistema entende e usa o login por e-mail automaticamente.

**Esqueci minha senha:** clique no link na tela de login, informe o e-mail e
você receberá um link para redefinir.

**Primeiro acesso:** ao entrar com uma **senha provisória** (criada pela clínica),
o sistema **obriga a definir uma nova senha** antes de continuar. (Quem entra pelo
Google não passa por isso.)

### Perfis de acesso (Papéis)
- **Admin:** acesso total, incluindo Configurações e gestão da equipe.
- **Profissional:** atende pacientes e usa todos os módulos clínicos.
- **Secretaria / Recepção:** agenda, cadastro e financeiro.
- **Paciente:** vê apenas os próprios dados, no Portal do Paciente.

Os papéis são **configuráveis** (Configurações → Papéis): cada papel aponta para um
**nível de acesso** que define as permissões.

---

## 2. Primeira configuração (o que fazer antes de usar)

Acesse **Configurações** (menu lateral, em **GESTÃO** — somente admin). As abas estão
organizadas em dois grupos, e cada título **expande ou recolhe** os seus itens:

- **NEGOCIAL** — Identidade visual · Equipe · Disponibilidade · **Procedimentos** · Metas ·
  Ativos · Formulários (Admin) · Textos-padrão · Fórmulas · Indicação · Fidelidade · **NPS** ·
  LGPD · Termo de Imagem
- **SISTEMA** — Fornecedores · Papéis · Permissões · Exames · Recursos · Serviços Prestados ·
  Unidades · Tipos de Despesa · Tipos de Documentos · Vacinas · Vias · Integrações

### 2.1 Identidade visual
- Envie o **logo** da clínica e clique em **Salvar**.
- Defina a **paleta de cores** (primária, secundária, fundo, texto) — o app inteiro,
  a tela de login, o ícone do app instalado e os PDFs passam a usar essas cores.
- Preencha **nome, CNPJ, responsável técnico, WhatsApp**. O nome aparece no topo do
  app e nos PDFs; o WhatsApp é o número que o paciente usa para falar com a clínica.

### 2.2 Equipe
- **+ Novo profissional:** nome, e-mail (usado no login), telefone, **papel** e dados
  do conselho (tipo, número e **UF** — ex.: CRBM 12345-SP), que aparecem nos documentos.
- Cada profissional na lista tem **Editar**, **Excluir** e a gestão de acesso:
  - **Provisionar acesso** (sem login): cria o usuário e mostra **login + senha** para entregar.
  - **Gerenciar acesso** (login ativo): aqui você pode **alterar o e-mail de login**
    (a chave de acesso) **e/ou forçar uma nova senha** provisória. A troca de e-mail
    **preserva todo o histórico** do profissional.
- O e-mail no formulário "Editar profissional" fica **somente leitura** quando há login
  ativo — a troca da chave é feita em **Gerenciar acesso** (evita inconsistências).

### 2.3 Papéis
- CRUD dos **papéis** da equipe, já com **Admin, Secretaria e Profissional**.
- Cada papel tem um **nível de acesso** (Administrador / Profissional / Secretaria) que é
  o que **governa as permissões**. Você pode criar novos papéis e reclassificar o nível.
- **Mantenha sempre ao menos um Administrador**, para não perder o acesso às Configurações.

### 2.4 Permissões (o que cada nível pode acessar)
O Admin define, com **botões ativo/inativo**, o que cada **nível de acesso** enxerga e usa.
A matriz tem duas seções:
- **Menu lateral:** Dashboard, Agenda, Pacientes, Modelos de Documentos, Estoque, Financeiro, Relatórios.
- **Abas da ficha do paciente:** Resumo, Agenda, Anamnese, Avaliações, Plano, Procedimentos,
  Medidas, Suplementação, Manipulação, Exames, Fotos, Documentos, Financeiro, Relatórios.

Colunas (níveis):
- **Administrador:** sempre tudo (não editável — evita ficar sem acesso).
- **Profissional** e **Secretaria/Recepção:** cada item é ligado/desligado individualmente.
- **Paciente:** não entra nesta matriz (usa apenas o Portal do Paciente).

Padrões já configurados: **Profissional** = todos os módulos clínicos e abas; **Secretaria/Recepção**
= Agenda, Cadastro (Pacientes) e Financeiro. Botões **Salvar permissões** e **Restaurar padrões**.
As mudanças se aplicam **na hora** (menu e abas se ajustam; a aba ativa muda se a atual for desligada).

> **Proteção em camadas:** além de **esconder** os itens sem permissão, há um **guard de rota** —
> se alguém tentar abrir por **URL direta** uma página sem permissão, é **redirecionado** para a
> primeira página permitida do seu nível. A **segurança real dos dados** continua na proteção do
> banco (RLS): paciente vê só o que é dele; a equipe vê os pacientes da clínica; Configurações é só admin.

> Os **Papéis** (item 2.3) herdam as permissões do seu **nível de acesso**.

### 2.5 Integrações
- **Gateway de pagamento (PIX):** provedor, ambiente (teste/produção), chave PIX,
  chave pública e URL de webhook. (As chaves **secretas** ficam fora do app, no servidor.)
- **WhatsApp:** provedor, número de envio e URL da API — usado para enviar receitas a
  fornecedores. (O **token** fica como segredo do servidor; o envio real é ativado quando
  a integração estiver configurada.)

### 2.6 Textos-padrão
- Crie/edite **modelos de texto** por categoria (ex.: Plano de tratamento). Ficam
  disponíveis para inserir com um clique ao montar planos e documentos.

### 2.7 Ativos (composição de fórmulas)
- Catálogo de **ativos** das fórmulas manipuladas, classificados em **Ativos Gerais,
  Vitaminas, Esclerosantes e Anestésicos**, com **filtro por categoria** + busca.
- **Busca por nome**, **filtro A–Z** e **paginação** (Mostrar 20/50/100 ou outro).
- **CRUD completo** (criar/editar/excluir). Cada ativo tem: código, nome, categoria,
  **apresentação/Via** (domínio) e **unidade**; **fornecedor, lote, validade, preço de
  aquisição, margem (%) e preço de venda** ficam em cada **lote** (um mesmo ativo pode ter
  lotes de fornecedores/validades diferentes). Use **+ Entrada** para lançar um lote.
- A coluna **Venda** mostra o preço do **lote disponível** (marcado com *(lote)*) quando o
  cadastro do ativo está sem valor. Esse é o preço usado para **mensurar** planos e pacotes;
  na suplementação efetiva o profissional escolhe o **lote do estoque** no momento.

### 2.8 Vias
- Domínio das **vias de administração / local** (ex.: Oral, Endovenosa). CRUD.

### 2.9 Fornecedores
- Cadastro de **fornecedores** (nome, contato e **telefone/WhatsApp**). CRUD. Usado nos
  ativos, na suplementação e no envio de receitas.

### 2.10 Fórmulas (biblioteca)
- Biblioteca de **fórmulas manipuladas** (nome, forma, composição e posologia). O admin
  monta as fórmulas aqui; na ficha do paciente a profissional apenas **designa** pelo nome.

### 2.11 Procedimentos (com preço, vigência e histórico)
- Lista dos **tipos de procedimento** (ex.: Skinbooster PDRN, Toxina botulínica…),
  usada como domínio ao registrar um atendimento e nos **itens do Plano/Pacote**.
- **Busca por nome**, **filtro A–Z** e **paginação** (Mostrar 20/50/100 ou outro).
- **+ Novo Procedimento:** abre a janela de cadastro com **Nome**, **Valor (opcional)** e
  **Vigência a partir de**.
- **Ajustar valor:** informe um **reajuste (%)** — o sistema calcula sobre o valor vigente —
  ou digite o **novo valor**, com a **vigência**. Nada muda retroativamente.
- **Histórico:** lista todos os preços por vigência, com o **reajuste aplicado**, o valor
  anterior e **quem ajustou**.
- O preço vigente é o que **preenche automaticamente** o valor do procedimento avulso e o
  preço dos itens do Plano/Pacote (que ficam **congelados** no plano — snapshot).

### 2.12 Tipos de Despesa
- Tipos usados no fluxo de caixa (ex.: Aluguel, Insumos, Energia). Cada tipo é
  **classificado** como **Gasto fixo** ou **Produto** — classifique cada um pelo seletor
  da linha. Essa classificação organiza o registro de despesas e os relatórios.

### 2.13 LGPD
- Edite o **texto** e a **versão** do termo de consentimento, apresentado no cadastro do paciente.

### 2.14 Exames (painel configurável)
- Lista os **tipos de exame** disponíveis para requisição. CRUD completo: criar, renomear,
  excluir e **reordenar** (botões ↑/↓).
- A ordem definida aqui é a mesma que aparece na tela de requisição e no **PDF impresso**.
- O sistema já vem com **56 exames pré-cadastrados**; basta ajustar à realidade da clínica.

### 2.15 Disponibilidade (horários e bloqueios por profissional)
Configure os horários de atendimento de cada profissional. Na aba **Disponibilidade**:

**Horários por dia da semana:**
- Selecione o **profissional** e defina **uma ou mais faixas de horário** para cada dia
  (ex.: "08:00–12:00" e "14:00–17:00" para o intervalo do almoço).
- As faixas são **ordenadas automaticamente** e validadas (fim > início).
- Use o botão **+** da linha do dia para adicionar uma nova faixa; o **×** para remover.

**Bloqueios (datas indisponíveis):**
- Cadastre períodos em que o profissional **não atende** (ex.: férias, congresso).
- Informe: profissional, data de início, data de fim e um **motivo** (opcional).
- Os bloqueios aparecem na verificação de disponibilidade ao agendar (status "Bloqueado").

### 2.16 NPS (pesquisa de satisfação)
Controla a pesquisa que o paciente responde **no portal**. Tudo é editável aqui — antes era fixo.

- **Pesquisa ativa:** desmarque para não exibir a pesquisa no portal.
- **Textos:** **título do convite** (ex.: "Como foi seu atendimento?"), a **pergunta da nota
  (0 a 10)** — é ela que calcula o NPS — e o **rótulo do campo de comentário**.
- **Repetir a cada (dias):** intervalo mínimo antes de convidar o mesmo paciente de novo
  (padrão 90).
- **Convidar a partir de (atendimentos):** nº de atendimentos **realizados** que o paciente
  precisa ter para ver a pesquisa (padrão 1).
- **Perguntas adicionais (opcional):** perguntas próprias além da nota, cada uma com um tipo:

| Tipo | Como aparece ao paciente |
|------|--------------------------|
| **Texto livre** | Campo de texto |
| **Nota (0 a 10)** | Botões de 0 a 10 (não entra no cálculo do NPS) |
| **Escolha (opções)** | Lista de opções que você define, separadas por vírgula |

  Use ↑ ↓ para ordenar, **obrigatória** para exigir resposta e ✕ para excluir.

> As respostas ficam em **Relacionamento → NPS** (cap. 17). Perguntas novas valem para as
> **próximas** respostas — as antigas continuam como foram enviadas.

---

## 3. Navegação geral (Área da Clínica)

No alto de toda tela há uma **barra superior** com o **nome do usuário** e o botão **Sair**
(canto direito). No celular, o menu lateral abre pelo ícone ☰ à esquerda.

Menu lateral — itens do dia a dia:

| Item | Para quê |
|------|----------|
| **Assistente** | Operar por conversa (agenda, financeiro, leads, alertas) |
| **Dashboard** | Visão do dia: pacientes, consultas de hoje, documentos pendentes, a receber, alertas de estoque e **indicações a recompensar** |
| **Agenda** | Agendamentos, calendário, busca por data e a aba **Atividades do dia** (uso interno) |
| **Pacientes** | Cadastro e prontuário completo |
| **Relacionamento** | Aniversariantes, reativação de inativos e **NPS** — painel, exportação e convite (cap. 17) |
| **Comercial** | Funil de leads (CRM) |
| **Financeiro** | Fluxo de caixa: receitas, despesas, caixa, balanço e relatório |
| **Relatórios** | Faturamento, estoque, atendimentos e **Mapa financeiro mensal** |

Abaixo há o grupo **GESTÃO** — clique no título para **expandir ou recolher** os subitens:

| Subitem de GESTÃO | Para quê |
|-------------------|----------|
| **Administrativo** | Formulários de qualidade e biossegurança (cap. 14) |
| **Estoque** | Produtos, lotes, validade, margem |
| **Configurações** | Ajustes da clínica (só admin) |
| **Reuniões Internas** | Agendamento, convocação e **atas** das reuniões da equipe (cap. 16) |
| **Atividades Internas** | Tarefas internas da equipe, com responsável e prazo (cap. 16) |
| **Modelos de Documentos** | Criar/editar termos e orientações |

> Cada item aparece conforme as **permissões** do nível de acesso (cap. 2.4).
> **Reuniões** e **Atividades Internas** são de **uso interno** — nunca aparecem no
> Portal do Paciente.

---

## 4. Agenda

- **+ Novo:** cria um agendamento — escolha paciente, **profissional**, data (no
  **calendário**), horário, procedimento e observações.
- **Agendamento prévio sem cadastro:** marque **"Paciente ainda sem cadastro"** e informe
  **nome + telefone**. O agendamento fica com o selo **"cadastro pendente"**. Depois,
  ao cadastrar o paciente, o sistema oferece **regularizar e vincular** esse agendamento.
- **Agendamento recorrente (só pelo profissional):** marque **"Agendamento recorrente"**,
  escolha o período (**semanal/quinzenal/mensal/anual**) e o **ano até o qual repetir
  (inclusive)** — o sistema cria a série no mesmo horário até 31/12 do ano escolhido.
  (No portal, o paciente solicita horários **individualmente**.)
- **Filtro por profissional** e **busca por data** (campo de data ou **Ver calendário**,
  com os dias que têm agendamento marcados).
- Em cada agendamento: **Confirmar**, **Remarcar**, **Realizado** ou **Cancelar**.
- **Lembretes automáticos** de consulta são enviados conforme configurado.

### 4.1 Verificação de disponibilidade em tempo real

Ao criar ou solicitar um agendamento, o sistema consulta a disponibilidade do profissional
escolhido e exibe um indicador ao lado do horário:

| Indicador | Significado |
|-----------|-------------|
| **Disponível** | Dentro do horário configurado e sem conflito |
| **Ocupado** | Já há um agendamento naquele horário |
| **Fora de horário** | Fora das janelas de atendimento do profissional |
| **Bloqueado** | Data dentro de um bloqueio (ex.: férias) |

A equipe recebe um **aviso de conflito** caso tente confirmar um horário ocupado, mas pode
prosseguir. O paciente, no portal, vê apenas a disponibilidade sem poder forçar o horário.

### 4.2 Gerenciar uma série de agendamentos recorrentes

Nos agendamentos que fazem parte de uma série, o botão **"Série ···"** permite:
- **Editar a série:** alterar procedimento, profissional ou horário.
- **Excluir — três opções:**
  - *Apenas esta* — exclui só o agendamento selecionado.
  - *Esta e as próximas* — exclui o atual e todos os seguintes da série.
  - *Todas* — remove todos os agendamentos da série.

### 4.3 Regularizar agendamento sem cadastro (diretamente na Agenda)

Na lista de agendamentos, o botão **Regularizar** (em agendamentos "sem cadastro") abre
o vínculo com um paciente já cadastrado, sem precisar remarcar o horário.

> **Séries recorrentes:** se o agendamento fizer parte de uma **série recorrente** (agendado
> como avulso repetido), ao vincular um único agendamento da série todos os demais da mesma
> série (passados e futuros) são vinculados automaticamente ao mesmo paciente.

---

## 5. Pacientes (o coração do sistema)

### 5.1 Lista e cadastro (CRUD)
- Busque por nome. Cada paciente na lista tem **Abrir**, **Editar** e **Excluir**
  (o excluir preserva o histórico e apenas tira o paciente da lista).
- **+ Novo paciente** abre o cadastro:
  - Dados pessoais: **nome**, **nascimento** (com **idade automática**), **CPF**,
    **WhatsApp** e **e-mail**.
  - Campos clínicos (profissão, estilo de trabalho, alergias) ficam na **Anamnese** —
    não precisam ser preenchidos no momento do cadastro.
  - **Regularizar agendamento prévio:** se houver agendamentos "sem cadastro" com nome
    compatível, o sistema exibe a opção de **vinculá-los** a este novo paciente. Ao
    marcar um agendamento que faz parte de uma **série recorrente**, todos os outros
    agendamentos da mesma série (passados e futuros) são vinculados automaticamente.
  - **Acesso ao sistema:** defina a **senha provisória**. Ao salvar, o sistema cria o
    login (usando o **e-mail** cadastrado; se não houver, usa o CPF) e mostra **login + senha**.
  - **Consentimento LGPD** e **Limite de relatórios** (ao editar).

### 5.2 Ficha do paciente (abas)
Clique num paciente para abrir a ficha. No topo, **Editar** abre o cadastro.

As abas seguem esta ordem:

| Aba | O que faz |
|-----|-----------|
| **Resumo** | Dados pessoais, idade, status do consentimento LGPD |
| **Agenda** | Agendamentos **deste paciente** + calendário só dele; realizados/cancelados ficam no fim da lista |
| **Financeiro** | Orçamentos (vinculados a um **Plano** ou a um **Pacote**), pagamentos, saldo e **gerar/enviar orçamento em PDF** ao paciente |
| **Plano** | Plano de tratamento com **itens** (procedimentos/suplementações), **sessões e frequência por item**, texto livre, **textos-padrão**, **Sugerir com IA**, **PDF/Imprimir** e **envio ao paciente para ciência** |
| **Pacotes** | Pacotes de sessões **pré-pagos** (procedimentos **ou** suplementações), com itens, desconto e saldo por item |
| **Procedimentos** | Registra o atendimento; **Editar/Excluir**, **CRUD de produtos** (baixa/estorno de estoque), vínculo a Orçamento, **item de Plano/Pacote** (consome sessão) ou **valor avulso** |
| **Suplementação** | Medicação pelo **domínio de Ativos** (preenche fornecedor/lote/validade/valor de venda), vínculo a item de Plano/Pacote, indicador **Pago/Não pago**, **Editar/Excluir** |
| **Manipulação** | **Designar fórmulas** da biblioteca e **gerar a receita em PDF** (enviar ao paciente e ao fornecedor) |
| **Documentos** | Emitir termos/orientações, **assinar**, **gerar PDF** e **editar** |
| **Anamnese** | Ficha clínica completa: hábitos, queixas, histórico de saúde, **profissão**, **estilo de trabalho** e **alergias** (também preenchida pelo próprio paciente no portal) |
| **Avaliações** | Fichas Dermato Funcional, Capilar e Corporal (escalas e perimetria) |
| **Exames** | **Requisição em PDF (A4)**, **anexar resultados** no dossiê |
| **Medidas** | Peso, IMC, gordura etc. por sessão, com **gráfico de evolução** e a **variação de peso** (kg e %) entre sessões |
| **Fotos** | Fotos clínicas antes/depois/evolução (bucket privado) |
| **Relatórios** | Relatórios que o **paciente gerou** — visualizar e baixar |

### 5.3 Encadeamento Plano → Orçamento → Procedimento
1. **Crie o Plano** (aba Plano) e adicione os **itens** (cada procedimento/suplementação
   com suas **sessões**, **frequência** e preço do cadastro).
2. **Crie o Orçamento** (aba Financeiro → **Novo orçamento** → *Plano / avulso*) e
   **selecione o Plano**: os itens do plano entram no orçamento com o valor de cada um,
   e o **Total** já reflete o plano. Aplique o **Desconto** se houver — o paciente pode
   **pagar o plano antecipadamente**.
3. Ao **Registrar o Procedimento**, escolha o **Plano** e o **Orçamento** e, no campo
   **Item do plano**, o item que está sendo realizado (**consome uma sessão**); ou deixe
   **sem vínculo** e informe um **Valor a cobrar** (procedimento **avulso**).

### 5.4 Procedimentos avulsos e importação no orçamento
- Sem plano/orçamento, informe o **Valor a cobrar** no procedimento (selo *Avulso*).
- No **Novo orçamento**, use **+ Importar procedimentos avulsos** (e também
  **+ Importar suplementações não pagas**). Ao salvar, esses itens entram no orçamento
  e os procedimentos passam a ficar **vinculados** a ele.

**Itens importados (travados):** os itens que vêm de **Procedimento** ou **Suplementação**
ficam **marcados** no orçamento e com o **valor travado** — ao tentar alterá-lo, o sistema
avisa que *o ajuste é feito no painel de origem* (Procedimentos ou Suplementação). Para
mudar o valor, edite no painel de origem e reimporte. Cada item importado tem a opção
**Desvincular** (na edição do orçamento) — remove o item e, no caso de procedimento, ele
**volta a ser avulso** (importável de novo). Itens manuais ("Outros serviços") continuam
totalmente editáveis.

### 5.4.1 CRUD do orçamento e pagamentos (aba Financeiro)
- **Editar itens:** adicionar/editar/remover itens e ajustar o **desconto**; o total é
  recalculado. (Itens importados seguem a regra de "valor travado" acima.)
- **Excluir** orçamento: bloqueado quando há **pagamento registrado** (estorne antes).
- **Pagamentos:** cada orçamento lista seus pagamentos com **Editar** (valor/método) e
  **Excluir**; o *Pago × Saldo* é recalculado na hora.

### 5.5 Suplementação
- Em **Nova suplementação**, escolha a **Medicação** no domínio de **Ativos**: o sistema
  preenche automaticamente **Via**, **Fornecedor**, **Lote**, **Validade** e **Valor de Venda**.
- Marque **Pago/Não pago**; use **Editar/Excluir**. As **não pagas** podem ser importadas
  no orçamento.

### 5.6 Manipulação — receita em PDF
- A profissional **designa** uma ou mais fórmulas (pelo nome da biblioteca).
- **Gerar receita (PDF):** documento com o cabeçalho do paciente, a composição em tópicos,
  a posologia e a **assinatura/conselho (com UF)** da profissional.
- Da própria tela é possível **Enviar ao paciente** (vai para a aba **Documentos** do
  portal) e **Enviar ao fornecedor** por WhatsApp (quando a integração estiver ativa).

### 5.7 Exames
- **Requisição em PDF (A4):** cabeçalho com **dados do cliente**, lista de exames do
  painel configurável (Configurações → Exames), **Outros exames** e **Observações**, e
  **duas linhas para o carimbo** da profissional (preenchidas à mão). Botão
  **Gerar PDF / Imprimir** no modal e em cada requisição.
- A **ordem dos exames** no PDF e na requisição segue a ordem definida em
  **Configurações → Exames** (ver item 2.14).
- **Resultados:** o profissional pode **anexar** PDF/imagem no dossiê do paciente (e o
  paciente também pode enviar pelo portal).

### 5.8 Plano de tratamento: itens, sessões e controle de saldo

O plano deixou de ser só um texto: ele tem **itens**, e é por eles que o sistema controla o
tratamento.

- **+ Procedimento / + Suplementação:** cada item traz o **preço do cadastro**
  (procedimento: preço vigente; suplementação: preço do **lote disponível** do Ativo) e você
  define **Sessões** e **Frequência** (Sessão única, Semanal, 2x por semana, Quinzenal,
  Mensal, Bimestral, Trimestral, Semestral, Anual). O modal mostra o **Total dos itens**.
- **Conteúdo** (texto) é opcional quando há ao menos um item — e vice-versa.
- **Data do plano:** editável no modal (use para corrigir a data quando necessário).
- **Controle de sessões:** ao registrar um procedimento/suplementação vinculado a um item,
  o sistema **baixa uma sessão** e mostra o andamento (ex.: `2/5 sessões`). Item **esgotado
  não pode ser vinculado** — nesse caso, crie um **novo orçamento (avulso)**. Excluir o
  registro **devolve** a sessão.
- **PDF / Imprimir:** gera o plano com **cabeçalho da clínica** (nome, CNPJ, responsável
  técnico, contato), a **tabela de itens** (sessões, frequência, valor unitário, subtotal e
  total), o **orçamento vinculado com o desconto e o valor negociado**, e no rodapé os
  **dados do profissional** (nome + conselho) e a **data/hora de geração**.
- **Enviar ao paciente:** o plano vai ao portal para o paciente **dar ciência**
  (fica *Aguardando ciência* → *Consentido*, com autenticação). A equipe também pode
  **Registrar consentimento** quando ele for dado presencialmente.

### 5.9 Pacotes de sessões (pré-pagos)

- **Aba Pacotes → + Novo pacote:** escolha o **tipo** (só **Procedimentos** *ou* só
  **Suplementações**), adicione os **itens**, informe as **Sessões compradas** (cada item é
  realizado essa quantidade de vezes) e o **Desconto** (R$ ou %). O sistema mostra
  subtotal → desconto → **Total do pacote**.
- **Cobrança:** em **Financeiro → Novo orçamento → Pacote (pré-pago)**, escolha o pacote —
  o orçamento entra com **uma linha: o total negociado**, para o paciente **pagar
  antecipadamente**. Os itens **não são cobrados por linha**.
- **Uso das sessões:** ao registrar um procedimento/suplementação, selecione o **Pacote** e
  o **item** — o sistema baixa a sessão, registra a **data** e lista a realização **no
  pacote e no orçamento** ("incluso no pacote").
- **Trava de preço (pacote de suplementação):** os valores das medicações ficam
  **congelados na criação** do pacote. Se o preço mudar depois, a diferença **não é cobrada
  nem estornada** — o paciente pagou antecipado pelo valor da época.
- **Pacote de procedimentos:** as **sessões** são pré-pagas, mas os **produtos de estoque**
  usados em cada atendimento são cobrados **na realização** (ver 5.11).
- Atalho **+ Novo pacote** também aparece dentro dos modais de procedimento e suplementação.

### 5.10 Preço do procedimento e valor avulso

- O preço de cada procedimento vive em **Configurações → Procedimentos**, com **vigência e
  histórico** (ver 2.11).
- Ao **Registrar procedimento**, escolher o tipo **preenche automaticamente** o
  *Valor a cobrar* com o **preço vigente** (editável; há o atalho *usar preço vigente*).
- **Avulso = sem nenhum vínculo** (sem orçamento, sem item de plano e sem item de pacote).
  Só nesse caso existem *Valor a cobrar* e **Recorrência recomendada** — assim uma sessão
  já paga no plano/pacote **nunca é cobrada duas vezes**.
- Registros **vinculados** a item de plano/pacote **não aparecem** em
  *Importar procedimentos avulsos* / *Importar suplementações não pagas* (proteção contra
  cobrança dupla).

### 5.11 Produtos não previstos → orçamento complementar

Quando um procedimento vinculado a um **orçamento/pacote já pago** usa **produtos com valor
de venda**, o modal pergunta: **"os produtos já estavam previstos?"**

- **Sim** (padrão) — nada acontece.
- **Não** — ao salvar, o sistema **propõe** um **orçamento complementar** (em **rascunho**)
  listando os produtos e o total. A equipe revisa e envia em **Financeiro**.
  **Nada é cobrado automaticamente.**

---

## 6. Modelos de Documentos

Crie e edite **termos** (consentimento) e **orientações** (cuidados) — tudo via CRUD.

- **Campos dinâmicos:** cada campo tem **Rótulo** (nome amigável) e **chave** (id técnico).
  No **corpo** você usa `{{chave}}`, substituído pelo valor.
- **Botão "inserir no corpo":** em cada campo, insere o `{{chave}}` correto na posição do
  cursor — evita digitar a chave errada.
- **Orientações** podem ter **lembretes automáticos** (ex.: "após X horas" ou "repetir por
  N dias"), entregues por **aviso no app** e/ou **push**.
- Ao editar um modelo, a **versão** é incrementada; a emissão "congela" a versão usada.

### 6.1 Quem preenche cada campo (Profissional / Paciente / Sistema)
Em cada campo dinâmico você escolhe **"Preenchido por"**:
- **Profissional** — preenchido na **emissão**; o *obrigatório* vale aqui. Para campos de
  número/texto, há a opção **"sugerir valor do orçamento"** (ex.: *Valor dos Serviços*): ao
  emitir, o profissional escolhe **um orçamento do paciente** ou digita um valor livre.
- **Paciente (portal)** — preenchido pelo paciente quando **lê e dá ciência** no portal; o
  *obrigatório* é exigido **nesse momento**, não na emissão. Usa o formato do campo (texto,
  Sim/Não, número, texto longo).
- **Sistema (automático)** — o sistema preenche sozinho a partir de uma **fonte**: Data da
  emissão · Data da ciência · Nome/CPF do paciente · Nome/Conselho/Número/UF do profissional.
  Assim, campos como nome do paciente, dados do profissional logado e datas **não precisam
  ser digitados**.

### 6.2 Emitir documento (ficha do paciente → Documentos)
- O profissional só vê/preenche os **campos do profissional**; o restante é automático ou do
  paciente. O sistema mostra quais campos o **paciente** preencherá no portal.
- Ao emitir, os campos de **Sistema** (dados do paciente/profissional e data da emissão) já
  entram preenchidos; a **data da ciência** é resolvida depois, no aceite do paciente.

### 6.3 Ciência do paciente e autenticidade
No portal, o paciente lê o documento, preenche os campos dele e confirma. Nesse aceite o
sistema grava **data, hora** e um **hash de autenticidade** (vincula o conteúdo aos dados do
paciente e ao instante do aceite), guardado no registro do documento para **auditoria** e
exibido no PDF.

### 6.4 "Exige assinatura do paciente" (flag)
Em **todos** os casos o paciente lê e **confirma** no portal para fechar o ciclo — o flag
**não** decide isso. Ele define a **natureza do aceite**:
- **Marcado** (Termo): aparece **"Assinar"** → status final **Assinado** (registra `assinado_em`).
- **Desmarcado**: aparece **"Confirmar leitura"** → status final **Lido**.

Em ambos são gravados data, hora e o hash. O flag só existe para **Termos**; **Orientações
nunca exigem assinatura**. Ciclo: **Pendente** (emitido) → paciente confirma → **Assinado/Lido**.

---

## 7. Estoque (CRUD)

- **+ Novo produto:** produto, marca, lote, validade, custo, preço de venda, quantidade
  inicial e **estoque mínimo**. A **margem** é calculada automaticamente.
- Cada item tem **+ Entrada**, **Editar** e **Excluir**. (Na edição, a **quantidade atual**
  é somente leitura — ajuste pela "+ Entrada", para preservar a auditoria.)
- **Alertas** de **estoque baixo** e **validade próxima** (≤ 30 dias) aqui e no Dashboard.
- A **baixa automática** acontece ao registrar um procedimento; ao **editar/excluir** um
  procedimento, o estoque é **reconciliado** (devolve os antigos, baixa os novos).

---

## 8. Financeiro (fluxo de caixa)

No topo há o **seletor de Mês/Ano**, que filtra todas as visões. Abas:

### 8.1 Consolidado (balanço)
Receitas recebidas, despesas pagas, **resultado do mês**, pendências (a receber / a pagar)
e **posição patrimonial** (caixa + aplicações + aportes).

### 8.2 Receitas
- **Realizado (Pagos)**, **Saldo do Paciente (A receber)** e **Cartão Parcelado**.
- **Registrar cobrança recebida:** escolha **paciente → orçamento** (saldo pré-preenchido)
  sem precisar entrar na ficha do paciente.
- Cada pagamento tem **Editar** e **Excluir**.

#### Filtros de pesquisa nas abas de Receitas

Cada aba tem filtros rápidos para localizar registros sem precisar rolar a lista:

| Aba | Filtros disponíveis |
|-----|---------------------|
| **Realizado (Pagos)** | Paciente (busca por nome) · Método de pagamento · Status (Pago / Não pago) |
| **Saldo do Paciente** | Paciente (busca por nome) |
| **Cartão Parcelado** | Paciente (busca por nome) |

Os filtros são aplicados na hora, sem recarregar a página.

#### Cartão de crédito parcelado
Ao registrar um pagamento com **Cartão de crédito**, é possível escolher o **número de
parcelas** (1–12×). O sistema então:
- **Quita o saldo do paciente imediatamente** (o orçamento fecha como pago).
- **Distribui as parcelas** nos meses futuros como *a receber da operadora*.
- A mensagem de confirmação avisa: *"Paciente quitado agora; clínica recebe N× (1ª em ~30 dias)"*.

A aba **Cartão parcelado** (dentro de Receitas) exibe as parcelas agrupadas por **mês de
vencimento**, com: nome do paciente, número da parcela (ex.: 2/12), valor e data de vencimento.
Cada parcela tem dois botões:
- **Recebida** — marca a parcela como recebida e lança no caixa do mês.
- **Chargeback** — estorna a transação: o saldo do paciente no orçamento é **reaberto** e
  a parcela volta para pendente. O paciente vê o estorno no portal (badge **"estornada"**)
  e um aviso de alerta é exibido na ficha financeira dele.

#### Como cancelar/excluir um parcelamento no cartão (via interface)

O processo correto depende do estado de cada parcela. **Nunca exclua parcelas diretamente
sem antes desfazer as que já foram marcadas como recebidas** — isso evita inconsistência
no caixa.

**Cenário A — Nenhuma parcela foi marcada como "Recebida" (todas pendentes)**

1. Acesse **Financeiro → Receitas → Cartão parcelado**.
2. Localize o paciente (use o filtro de busca por nome).
3. Clique em **Chargeback** em cada parcela do grupo.
   - O saldo do orçamento do paciente volta a aberto automaticamente.
4. Vá para a aba **Realizado (Pagos)**.
5. As parcelas estornadas aparecem na lista — clique em **Excluir** em cada uma.
6. (Opcional) Se quiser remover o orçamento, acesse a **ficha do paciente → Financeiro →
   Orçamentos** e exclua o orçamento correspondente (só é possível após excluir todos os
   pagamentos vinculados).

**Cenário B — Uma ou mais parcelas já foram marcadas como "Recebida"**

1. Acesse **Financeiro → Receitas → Cartão parcelado**.
2. Clique em **Chargeback** em cada parcela que estiver marcada como recebida.
   - Isso desfaz a entrada no caixa daquele mês e reabre o saldo do paciente.
3. Repita o Chargeback também nas parcelas ainda pendentes.
4. Vá para a aba **Realizado (Pagos)** e exclua todas as parcelas estornadas do grupo.
5. (Opcional) Exclua o orçamento na ficha do paciente.

**Regras importantes**

| Situação | O que fazer |
|----------|-------------|
| Parcela `pendente` | Chargeback → Excluir |
| Parcela `recebida` | Chargeback (desfaz caixa) → Excluir |
| Orçamento com pagamentos | Excluir todos os pagamentos **antes** de excluir o orçamento |
| Excluir apenas uma parcela do grupo | Não recomendado — as demais ficam com numeração inconsistente (ex.: "1/3" sem a "2/3") |

### 8.3 Despesas
- **Realizado (Pagas)** e **Não pagas**, com **Editar**, **Excluir** e marcar pago.
- **Nova despesa:** **Classificação** (Produto / Gasto fixo) na 1ª linha — o **Tipo de
  Despesa** mostra só os tipos daquela classificação. Informe **Valor**, **Qtd. de itens**,
  **Data** e **Forma de pagamento** (Pix/Cartão).
  - **Produto:** pagamento **à vista** ou **parcelado** (Nº de parcelas distribuídas nos
    meses seguintes).
  - **Gasto fixo:** opção de **recorrência** (período + nº de ocorrências).

### 8.4 Caixa & Aportes
Registro de **valores em caixa**, **aplicações** e **aportes financeiros** eventuais.

### 8.5 Relatório
- Período **Mensal / Anual / Intervalo de datas**.
- **Comparativo Receitas × Despesas** (cards + barras), totais, e quebras **por
  classificação**, **por forma de pagamento** e **por tipo de despesa**.
- **Evolução mês a mês** (gráfico de linha receita × despesa do ano).
- **Exportar PDF** — inclui o gráfico de evolução e as tabelas.

---

## 9. Relatórios (menu lateral)

Indicadores do **mês atual** e visão geral:
- **Faturamento:** recebido no mês (por método), a receber, total recebido.
- **Estoque:** valor de custo, valor de venda, itens em baixa, validade próxima.
- **Atendimento:** procedimentos e atendimentos no mês.

### Mapa financeiro mensal (4 colunas)
Selecione **Mês/Ano** e veja, lado a lado, com **totalizadores**:
**Despesas fixas** · **Produtos e materiais** · **Pagamentos das clientes** ·
**A receber das clientes**, mais o **resumo do mês** (recebido, despesas, saldo, a receber).
Botão **Exportar PDF** (paisagem).

---

## 10. Automação e notificações

- Ao **emitir uma orientação**, o sistema agenda os **avisos de cuidado** (no app e, se
  configurado, **push** no aparelho).
- **Lembretes de consulta** são enfileirados automaticamente.
- O paciente vê os avisos em **Início** do portal e pode **ativar notificações**.

---

## 11. Portal do Paciente (o que o paciente vê)

A marca da clínica (logo/nome/cores) aparece também no portal e no app instalado.

- **Início:** avisos/cuidados, **próxima consulta** (data e hora), ativar notificações e
  falar no WhatsApp.
- **Agendamentos:** ver consultas e **solicitar horário** (a clínica confirma). Ao solicitar,
  o paciente escolhe o **profissional** e o sistema exibe a **disponibilidade em tempo real**
  (disponível / ocupado / fora de horário / bloqueado).
- **Anamnese:** preencher a própria ficha (hábitos, queixas, **profissão**, **estilo de trabalho**, **alergias** e histórico de saúde).
- **Documentos:** ler/**assinar** termos e orientações; **abrir as receitas, orçamentos e
  arquivos** enviados pela clínica (PDFs).
- **Exames:** ver as **requisições** da clínica e **enviar/abrir/excluir resultados**.
- **Evolução:** gráfico de medidas e fotos.
- **Relatórios:** escolhe **seções** e **período**, gera um **PDF** (download + guardado),
  limitado pela quantidade definida pelo admin.
- **Financeiro:** orçamentos, saldos e produtos utilizados. Quando há pagamento
  **parcelado no cartão**, as parcelas aparecem com o status de cada uma (paga / estornada);
  parcelas estornadas exibem um aviso de alerta.
- **LGPD:** ler o termo e **dar ciência**, com registro de data/hora.

---

## 12. Gestão de acesso (resumo)

| Situação | Como resolver |
|----------|----------------|
| Novo paciente precisa entrar | O cadastro cria o login (usa o **e-mail**; senão, o CPF); entregue login + senha |
| Paciente esqueceu a senha | Paciente usa "Esqueci minha senha" **ou** Editar → Redefinir acesso |
| Novo profissional | Configurações → Equipe → Provisionar acesso |
| **Trocar o e-mail de login** de um profissional | Configurações → Equipe → **Gerenciar acesso** (preserva o histórico) |
| Forçar nova senha do profissional | Configurações → Equipe → **Gerenciar acesso** → Forçar nova senha |
| Novo papel / mudar nível de acesso | Configurações → **Papéis** |
| Definir o que cada nível acessa | Configurações → **Permissões** (toggles + guard de rota) |
| Forçar troca no 1º acesso | Automático para senhas provisórias (exceto login Google) |

---

## 13. Dicas finais

- O app **republica sozinho** a cada atualização; **recarregue a página** (Ctrl+Shift+R)
  para ver novidades. No celular, use **"Adicionar à tela inicial"** para instalar.
- Os dados são protegidos por permissões: **paciente vê só o que é dele**; a equipe vê os
  pacientes da clínica; **Configurações é só do admin**.
- **PDFs** (documentos, receitas, orçamentos, exames, relatórios) servem como comprovante
  e seguem a identidade visual da clínica.
- Para os relatórios financeiros baterem, mantenha os **Tipos de Despesa classificados**
  (Produto/Gasto fixo) e registre os pagamentos/recebimentos no mês correto.

---

---

## 14. Administrativo (Controles de qualidade e biossegurança)

O módulo **Administrativo** reúne os registros obrigatórios de qualidade da clínica —
temperatura do refrigerador, higienização de equipamentos, limpeza de ambientes, etc.

### 14.1 Navegar pelos formulários
- No menu lateral, clique em **Administrativo**.
- Selecione o **formulário** no painel esquerdo (ex.: "Temperatura do Refrigerador").
- A lista de registros é exibida com **filtros por período** (Tudo / Mês-Ano / Faixa de datas).

### 14.2 Criar um registro
1. Clique em **+ Novo registro**.
2. Preencha todos os campos (data, hora, valores numéricos, responsável etc.).
3. Clique em **Salvar** — o registro aparece na lista imediatamente.

> Campos numéricos (ex.: temperatura máxima, mínima) devem ser preenchidos com número.
> Se um campo for deixado em branco, a coluna exibe "—" na lista.

### 14.3 Editar e excluir
- Clique em **Editar** na linha do registro para corrigir qualquer campo.
- Clique em **Excluir** para remover o registro (ação irreversível).

### 14.4 Exportar PDF
- Clique em **PDF** na barra de filtros para gerar o relatório do período selecionado,
  com cabeçalho da clínica e assinatura do responsável técnico.

### 14.5 Personalizar formulários (Configurações → Formulários (Admin))
O admin pode **personalizar** qualquer formulário padrão:
- Renomear campos, alterar a obrigatoriedade, adicionar opções de seleção ou remover campos.
- A personalização **substitui completamente** a definição padrão daquele formulário;
  se precisar voltar ao padrão, use o botão **Restaurar padrão**.
- Os dados já gravados nos registros anteriores **não são apagados** — a personalização
  afeta apenas a exibição e o formulário de criação/edição.

**Tipos de campo disponíveis:** Texto, Texto longo, Número, Data, Hora, Sim/Não,
Lista (uma opção), Lista (várias), Upload de arquivo, **Ativo (produto)**, **Profissional**,
**Paciente** e **Registro de outro formulário**.

#### Campo "Registro de outro formulário" (relacionar registros)
Faz um campo **listar os registros de outro formulário**, para o usuário **selecionar** em
vez de digitar. Ao escolher esse tipo, defina:
1. **Formulário referenciado** — a lista **exclui o formulário atual** (evita
   auto-referência).
2. **Campo exibido** — qual campo do formulário de origem aparece na lista.

*Exemplo:* no formulário **Esterilização**, mude o campo **Equipamento** para
*Registro de outro formulário → Equipamentos* (campo exibido: *Nome do aparelho*). A partir
daí o usuário escolhe o equipamento já cadastrado.

> O campo guarda o **texto** selecionado (como já ocorre com *Ativo* e *Profissional*).
> Assim, excluir ou renomear o registro de origem **não apaga nem quebra** os registros que
> já o citaram. Registros antigos preservam o que foi digitado.

---

## 15. Assistente (comandos por conversa)

O **Assistente** (ícone no topo do menu) entende pedidos em português e executa operações reais
do sistema pela conversa, **com o mesmo login** e as mesmas permissões da equipe.

**Princípios de segurança:**
- Só responde à **equipe autenticada** e sempre no escopo da própria clínica.
- Antes de **gravar** qualquer coisa (agendar, lançar despesa, registrar recebimento, marcar
  despesa paga, criar lead, agendar recorrência), ele **confirma os detalhes** e só age após um "sim".
- **Não move dinheiro nem concede crédito/cashback/recompensa de indicação** — isso continua sendo
  feito manualmente no Financeiro, por decisão de segurança.
- Revalida horário ao agendar (não cria conflito) e nunca inventa IDs de paciente.

### 15.1 O que dá para pedir (por área)

| Área | Exemplos de comando |
|---|---|
| **Agenda** | "Qual a agenda de hoje?" · "Minhas consultas de amanhã" · "A clínica tem o quê na sexta?" · "Qual meu próximo atendimento?" |
| **Agendar** | "Agende a Maria Silva quinta às 14h para avaliação" · "Tem horário livre comigo amanhã de manhã?" |
| **Pacientes** | "Busque a paciente Ana" · "Qual o telefone da Neli?" |
| **Financeiro** | "Quanto recebi este mês?" · "Quanto tenho a receber de cartão?" · "Registre um recebimento de R$ 200 no PIX da Ana no orçamento em aberto" · "Lance uma despesa de R$ 450 de aluguel" · "Marque a despesa de energia como paga" |
| **Retornos (recorrência)** | "Tem retornos recomendados pendentes?" · "Agende o retorno da paciente X" |
| **Comercial (CRM)** | "Quais leads estão em avaliação?" · "Quantos leads novos temos?" · "Cadastre um lead: Fulana, veio do Instagram, interesse em botox" · "Quais follow-ups tenho para hoje?" · "Tem lead parado?" |
| **Relacionamento** | "Quem faz aniversário este mês?" · "Aniversariantes de agosto" · "Qual o NPS da clínica?" |
| **Administrativo** | "Registre uma intercorrência para o paciente X" · "Quais formulários administrativos existem?" |
| **Alertas** | "Tem algum alerta?" (estoque baixo, validade próxima, agendamentos a regularizar) |

### 15.2 O que o assistente NÃO faz (por segurança)
- Conceder **crédito**, **cashback** ou **recompensa de indicação** (feito manualmente no Financeiro).
- **Excluir** dados (orçamentos, pagamentos, pacientes) — ações irreversíveis ficam nas telas.
- Alterar configurações, permissões ou preços de forma automática.

> Dica: seja específico (nome do paciente, data, valor). Se houver mais de um paciente com o mesmo
> nome, o assistente pergunta qual antes de prosseguir.

---

## 16. Gestão interna: Reuniões e Atividades

Duas telas no grupo **GESTÃO** para a operação da equipe. **Nada aqui aparece no Portal do
Paciente.**

### 16.1 Reuniões Internas

Agendamento, convocação e **ata** das reuniões da clínica.

- **+ Nova reunião:** **Título**, **Data**, **Hora**, **Status** (Agendada / Realizada /
  Cancelada), **Tópicos** e **Participantes** (marque quem vai — há o atalho **Todos**).
- **Ata:** campo de texto livre, preenchido/ajustado pelo responsável.
- **PDF da ata:** cabeçalho da clínica, participantes, tópicos e a ata.
- **Convocação:** os participantes veem a reunião na **Agenda → aba Atividades do dia**
  (seção *Reuniões do dia*), com o botão **Confirmar presença** e link para a ata.
- **Minha participação** (para quem foi convocado, na tela da reunião):
  **Confirmar presença**, **Dar ciência** e **Manifestação** (registrar pontos/observações).
- **Atividades desta reunião:** gere as tarefas decididas na reunião informando
  **título, responsável e data acordada**. Elas aparecem também em **Atividades Internas**
  com a origem **Reunião**. Excluir a reunião **preserva** as atividades geradas.
- **Quem pode criar/convocar:** definido pela permissão **"Convocar / gerenciar reuniões"**
  (Configurações → Permissões, grupo **Ações**). O **Admin** sempre pode; os demais níveis
  são liberados pelo admin. Quem não tem a permissão **visualiza** a reunião e a ata e pode
  **gerar o PDF**.

### 16.2 Atividades Internas

Controle central das tarefas da equipe — vindas de reuniões, designadas pelo Admin ou
criadas pelo próprio membro para o seu dia a dia.

- **+ Nova atividade:** **Título**, **Descrição**, **Data**, **Hora**, **Responsável**,
  **Status** e **Data efetivada**.
- **Status:** **Pendente**, **Executado** (registra a data efetivada) ou **Redirecionado**
  (quando a tarefa é repassada a outro responsável e/ou remarcada). Há um seletor de status
  direto na lista e o atalho de filtro por status no topo.
- **Origem** de cada atividade: **Admin**, **Membro** ou **Reunião**.
- **Quem pode o quê:**

| Perfil | Pode |
|--------|------|
| **Admin** | Criar, editar e excluir **todas**; ver o histórico de ajustes |
| **Membro** | Ver as **atribuídas a si** e as **que criou**; editar/excluir **só as que criou** |
| **Responsável** | Mesmo sem ser o criador, pode **alterar o status** (executado/redirecionado) da tarefa que lhe foi atribuída |

- **Log de ajustes:** as atividades criadas pelo **Admin** guardam o **histórico**
  (campo alterado, de → para, quem alterou e quando), visível na edição.
- **Vínculo com o Administrativo:** uma atividade pode apontar para um **registro
  administrativo** (ex.: a tarefa "medir temperatura" ligada ao registro do formulário
  *Temperatura do Refrigerador*). Escolha **Formulário → Registro**; o card mostra
  *🔗 registro vinculado*. Excluir o registro apenas **desfaz o vínculo**.
- **Na Agenda:** a aba **Atividades do dia** mostra (somente leitura) as atividades da data
  escolhida — hora, título, status, origem e responsável — com link **Gerenciar atividades**.

---

## 17. Relacionamento (aniversariantes, inativos e NPS)

Menu **Relacionamento**, com três abas.

### 17.1 Aniversariantes
Lista os aniversariantes do mês (abre no mês atual; troque o mês para planejar). Quem faz
aniversário **hoje** aparece destacado. O botão **Parabenizar** abre o WhatsApp com a
mensagem pronta.

### 17.2 Inativos
Pacientes que não voltam há um tempo e **não têm agendamento futuro** — com a data do último
atendimento e um botão que abre o WhatsApp com o convite de retorno.

### 17.3 NPS (pesquisa de satisfação)

**Onde o paciente responde:** no **portal**, na tela inicial. A pesquisa aparece quando ele
tem o **nº de atendimentos realizados** configurado (2.16) e **não respondeu** dentro do
intervalo definido. Ele dá a **nota de 0 a 10**, responde as **perguntas adicionais** (se
houver) e pode deixar um **comentário**.

**Como o NPS é calculado:** `% promotores (9–10) − % detratores (0–6)`. Os **passivos (7–8)**
entram no total, mas não somam nem subtraem.

**O painel (aba NPS):**
- **Período:** campos *De/Até* e os atalhos **30 dias · 90 dias · 12 meses · Tudo**.
- **Indicadores:** NPS, Respostas, **Promotores**, **Passivos** e **Detratores** — com a
  quantidade e o **percentual** de cada faixa.
- **Evolução mensal:** o NPS e o nº de respostas mês a mês, em barras.
- **Respostas:** tabela com data, paciente, nota (colorida por faixa), comentário e as
  respostas de **cada pergunta adicional**.
- **Exportar:** **CSV** (abre no Excel com os acentos corretos) e **PDF** (indicadores +
  evolução + respostas, com o cabeçalho da clínica).
- Se a pesquisa estiver **desativada** em Configurações, o painel avisa.

**Convidar para a pesquisa:** o bloco no fim da aba lista os pacientes **já atendidos e sem
resposta** dentro da periodicidade. **Convidar** abre o WhatsApp com a mensagem pronta — a
resposta continua sendo dada no portal (então a nota entra no mesmo cálculo).

> Em **Relatórios** há também o resumo dos **últimos 90 dias** (NPS, respostas, promotores,
> detratores e os comentários recentes), com link para este painel completo.

---

*Este manual cobre as funcionalidades desenvolvidas até **agosto de 2026**: recorrência de retornos
(com data-limite), **NPS configurável** (textos, periodicidade, gatilho e perguntas próprias, com painel
e exportação), indicação, fidelidade/cashback, relacionamento, gestão financeira, agenda
semanal, agendamento online, CRM comercial, o módulo **Administrativo** (formulários configuráveis,
inclusive campos que referenciam outros formulários), o módulo **clínico-financeiro** (preço de
procedimento com vigência e histórico, planos com itens e controle de sessões, pacotes pré-pagos com
trava de preço, orçamento complementar de produtos) e a **gestão interna** (Reuniões com ata/PDF e
Atividades Internas). Itens em evolução: **transcrição de áudio da reunião por IA** para compor a
ata, cobrança PIX automática, **envio por WhatsApp** e a operação **multi-clínica**
(ver `docs/ROADMAP-multiclinica.md`).*
