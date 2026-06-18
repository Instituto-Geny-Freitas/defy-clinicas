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
- **Filtro por profissional** e **busca por data** (campo de data ou **Ver calendário**,
  com os dias que têm agendamento marcados).
- Em cada agendamento: **Confirmar**, **Remarcar**, **Realizado** ou **Cancelar**.
- **Lembretes automáticos** de consulta são enviados conforme configurado.

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
  painel padrão, **Outros exames** e **Observações**, e **duas linhas para o carimbo** da
  profissional (preenchidas à mão). Botão **Gerar PDF / Imprimir** no modal e em cada requisição.
- **Resultados:** o profissional pode **anexar** PDF/imagem no dossiê do paciente (e o
  paciente também pode enviar pelo portal).

---

## 6. Modelos de Documentos

Crie e edite **termos** (consentimento) e **orientações** (cuidados) — tudo via CRUD.

- **Campos dinâmicos:** cada campo tem **Rótulo** (nome amigável) e **chave** (id técnico).
  No **corpo** você usa `{{chave}}`, substituído pelo valor na emissão.
- **Botão "inserir no corpo":** em cada campo, insere o `{{chave}}` correto na posição do
  cursor — evita digitar a chave errada.
- **Orientações** podem ter **lembretes automáticos** (ex.: "após X horas" ou "repetir por
  N dias"), entregues por **aviso no app** e/ou **push**.
- Ao editar um modelo, a **versão** é incrementada; a emissão "congela" a versão usada.

> Os valores dos campos **não** são informados no editor de modelo — apenas na **emissão**
> (ficha do paciente → Documentos → Emitir documento).

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
- **Agendamentos:** ver consultas e **solicitar horário** (a clínica confirma).
- **Anamnese:** preencher a própria ficha (inclui **estilo de trabalho**).
- **Documentos:** ler/**assinar** termos e orientações; **abrir as receitas, orçamentos e
  arquivos** enviados pela clínica (PDFs).
- **Exames:** ver as **requisições** da clínica e **enviar/abrir/excluir resultados**.
- **Evolução:** gráfico de medidas e fotos.
- **Relatórios:** escolhe **seções** e **período**, gera um **PDF** (download + guardado),
  limitado pela quantidade definida pelo admin.
- **Financeiro:** orçamentos, saldos e produtos utilizados.
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

*Este manual cobre as funcionalidades desenvolvidas até o momento. Itens em evolução:
cobrança PIX automática e **envio por WhatsApp** ao fornecedor (dependem de contas/contratos
externos; o sistema já está preparado para ativá-los nas Integrações).*
