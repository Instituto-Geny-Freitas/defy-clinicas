# Manual do Administrador — Sistema da Clínica (Instituto Geny Freitas)

Guia de navegação e uso da **Área da Clínica** e do **Portal do Paciente**.
Aplicação web responsiva (PWA): funciona no computador e no celular, e pode ser
"instalada" na tela inicial do aparelho, já com a **logo, o nome e as cores** da
clínica (identidade visual).

> **Acesso:** `https://defy-clinicas.vercel.app`

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

Acesse **Configurações** (menu lateral, somente admin). As abas são:

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
- **CRUD completo** (criar/editar/excluir). Cada ativo tem: código, nome, categoria,
  **apresentação/Via** (domínio), **fornecedor** (domínio), **lote**, **validade**,
  **preço de aquisição**, **margem (%)** e **preço de venda** (calculado pela margem).

### 2.8 Vias
- Domínio das **vias de administração / local** (ex.: Oral, Endovenosa). CRUD.

### 2.9 Fornecedores
- Cadastro de **fornecedores** (nome, contato e **telefone/WhatsApp**). CRUD. Usado nos
  ativos, na suplementação e no envio de receitas.

### 2.10 Fórmulas (biblioteca)
- Biblioteca de **fórmulas manipuladas** (nome, forma, composição e posologia). O admin
  monta as fórmulas aqui; na ficha do paciente a profissional apenas **designa** pelo nome.

### 2.11 Procedimentos
- Lista dos **tipos de procedimento** (ex.: Skinbooster PDRN, Toxina botulínica…),
  usada como domínio ao registrar um atendimento. CRUD.

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

---

## 3. Navegação geral (Área da Clínica)

Menu lateral (no celular, abre pelo menu):

| Item | Para quê |
|------|----------|
| **Dashboard** | Visão do dia: pacientes, consultas de hoje, documentos pendentes, a receber e alertas de estoque |
| **Agenda** | Agendamentos, calendário e busca por data |
| **Pacientes** | Cadastro e prontuário completo |
| **Modelos de Documentos** | Criar/editar termos e orientações |
| **Estoque** | Produtos, lotes, validade, margem |
| **Financeiro** | Fluxo de caixa: receitas, despesas, caixa, balanço e relatório |
| **Relatórios** | Faturamento, estoque, atendimentos e **Mapa financeiro mensal** |
| **Configurações** | Ajustes da clínica (só admin) |

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

---

## 5. Pacientes (o coração do sistema)

### 5.1 Lista e cadastro (CRUD)
- Busque por nome. Cada paciente na lista tem **Abrir**, **Editar** e **Excluir**
  (o excluir preserva o histórico e apenas tira o paciente da lista).
- **+ Novo paciente** abre o cadastro:
  - Dados pessoais (nome, nascimento — **idade automática**, CPF, WhatsApp, e-mail,
    profissão, estilo de trabalho, alergias).
  - **Regularizar agendamento prévio:** se houver agendamentos "sem cadastro", aparece a
    opção de **vinculá-los** a este novo paciente.
  - **Acesso ao sistema:** defina a **senha provisória**. Ao salvar, o sistema cria o
    login (usando o **e-mail** cadastrado; se não houver, usa o CPF) e mostra **login + senha**.
  - **Consentimento LGPD** e **Limite de relatórios** (ao editar).

### 5.2 Ficha do paciente (abas)
Clique num paciente para abrir a ficha. No topo, **Editar** abre o cadastro.

| Aba | O que faz |
|-----|-----------|
| **Resumo** | Dados pessoais, idade, status do consentimento LGPD |
| **Agenda** | Agendamentos **deste paciente** + calendário só dele; realizados/cancelados ficam no fim da lista |
| **Anamnese** | Ficha clínica (também preenchida pelo paciente). O **Estilo de trabalho** preenchido aqui reflete no Resumo |
| **Avaliações** | Fichas Dermato Funcional, Capilar e Corporal (escalas e perimetria) |
| **Plano** | Plano de tratamento — texto livre, **textos-padrão** e **Sugerir com IA**. Editar/excluir |
| **Procedimentos** | Registra o atendimento; **Editar/Excluir**, **CRUD de produtos** (baixa/estorno de estoque), vínculo a Orçamento ou **valor avulso** |
| **Medidas** | Peso, IMC, gordura etc. por sessão, com **gráfico de evolução** |
| **Suplementação** | Medicação pelo **domínio de Ativos** (preenche fornecedor/lote/validade/valor de venda), indicador **Pago/Não pago**, **Editar/Excluir** |
| **Manipulação** | **Designar fórmulas** da biblioteca e **gerar a receita em PDF** (enviar ao paciente e ao fornecedor) |
| **Exames** | **Requisição em PDF (A4)**, **anexar resultados** no dossiê |
| **Fotos** | Fotos clínicas antes/depois/evolução (bucket privado) |
| **Documentos** | Emitir termos/orientações, **assinar**, **gerar PDF** e **editar** |
| **Financeiro** | Orçamentos (vinculados a um Plano), pagamentos, saldo e **gerar/enviar orçamento em PDF** ao paciente |
| **Relatórios** | Relatórios que o **paciente gerou** — visualizar e baixar |

### 5.3 Encadeamento Plano → Orçamento → Procedimento
1. **Crie o Plano** (aba Plano).
2. **Crie o Orçamento** (aba Financeiro) e **vincule-o ao Plano**.
3. Ao **Registrar o Procedimento**, escolha o **Plano** e o **Orçamento**; ou deixe
   **sem orçamento** e informe um **Valor a cobrar** (procedimento **avulso**).

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
- **Realizado (Pagos)** e **Não pagos (A receber)**.
- **Registrar cobrança recebida:** escolha **paciente → orçamento** (saldo pré-preenchido)
  sem precisar entrar na ficha do paciente.
- Cada pagamento tem **Editar** e **Excluir**.

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
- **Anamnese:** preencher a própria ficha (inclui **estilo de trabalho**).
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

*Este manual cobre as funcionalidades desenvolvidas até **junho de 2026**. Itens em evolução:
cobrança PIX automática e **envio por WhatsApp** ao fornecedor (dependem de contas/contratos
externos; o sistema já está preparado para ativá-los nas Integrações).*
