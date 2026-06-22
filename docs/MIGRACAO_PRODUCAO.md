# Guia de Migração para Produção

## Visão geral — o que vamos fazer (leia primeiro)

Este guia leva o sistema do **Instituto Geny Freitas** do ambiente de testes para
a **produção definitiva**, agora pago e mantido pela **própria clínica**. Ao final:

- O **banco de dados e os logins** (pacientes, profissionais, senhas) continuam
  funcionando, **sem perder nada**.
- O site mudará de **defy-clinicas.vercel.app** para
  **institutogenyfreitas.vercel.app**.
- As contas dos serviços (Supabase, Vercel, Claude) ficarão no nome/cartão da
  **clínica**.
- O **código no GitHub permanece no mesmo repositório** de hoje.
- Você continuará usando o **Claude** no seu próprio computador, com a **mesma
  pasta** `C:\desenv\ClinicaGeny`, apenas entrando com o usuário e senha da clínica.

> **A decisão mais importante deste guia.** Existem dois caminhos para o banco de
> dados (Supabase):
>
> - **Caminho A — TRANSFERIR o projeto atual para a clínica (RECOMENDADO).** É o
>   mais seguro: **nenhum dado é movido**, os logins e senhas continuam idênticos,
>   e as credenciais (endereço e chave) **não mudam**. Risco quase zero.
> - **Caminho B — CRIAR um banco novo do zero e copiar os dados.** Só use se a
>   transferência não for possível. Exige copiar usuários e senhas com cuidado e
>   tem mais risco. Está no **Apêndice B**, com avisos.
>
> **Recomendação:** siga o **Caminho A**. Todo o corpo deste guia assume ele.

### Como o sistema é montado (em linguagem simples)

| Peça | Para que serve | Quem vai pagar agora |
|------|----------------|----------------------|
| Supabase | O "cofre": banco de dados, logins/senhas e arquivos | Clínica |
| Vercel | A "vitrine": publica o site na internet (o endereço .vercel.app) | Clínica |
| GitHub | O "arquivo do código-fonte" (a receita do sistema) | Permanece como está |
| Claude (Anthropic) | A ferramenta no seu PC que edita e publica o sistema | Clínica |

Pense assim: o **GitHub** guarda a receita, a **Vercel** monta o prato e serve ao
público, e o **Supabase** é a despensa com todos os ingredientes (os dados). O
**Claude** é o cozinheiro que você comanda no seu computador.

---

## Antes de começar — o que ter em mãos

- [ ] **E-mail oficial da clínica** (ex.: `contato@institutogenyfreitas.com.br`
      ou um Gmail da clínica). Será o "dono" de todas as contas.
- [ ] **Acesso a esse e-mail** (para confirmar cadastros e receber códigos).
- [ ] **Cartão de crédito da clínica** (Supabase, Vercel e Claude pedem cartão
      para os planos pagos; alguns têm período/uso gratuito, mas peça o cartão
      para evitar travas).
- [ ] **Seu computador** com a pasta `C:\desenv\ClinicaGeny` (onde o sistema já está).
- [ ] **1 a 2 horas** sem pressa. Faça em um horário de baixo movimento da clínica.
- [ ] Um caderno ou a **Ficha de Credenciais** (Apêndice A) para anotar logins e chaves.

> **Regra de ouro de segurança.** Existem dois tipos de "chave":
> **públicas** (podem ir no site/`.env.local`) e **secretas** (NUNCA vão no site).
> Sempre que este guia disser "**segredo**", trate como a senha do cofre: não cole
> no código, não mande por e-mail/WhatsApp comum, não tire print. Em caso de dúvida,
> **não compartilhe**.

---

## Parte 1 — Claude no seu computador (mesma pasta C:)

Objetivo: entrar no Claude com a conta da **clínica**, mas continuar trabalhando na
**mesma pasta** `C:\desenv\ClinicaGeny`. Nada da pasta é movido ou apagado.

1. Abra o navegador e vá a **https://claude.ai**.
2. Clique em **Sign up** (Cadastrar) e crie a conta usando o **e-mail da clínica**.
   Defina uma **senha forte** e guarde-a na Ficha de Credenciais.
3. Confirme o e-mail (a Anthropic envia um link/código de confirmação).
4. Contrate um **plano que inclua o Claude Code** (a ferramenta de terminal). Os
   planos pessoais **Pro** ou **Max** servem; para uso de empresa, o plano **Team**
   também. Pague com o cartão da clínica.
5. **Instalar o Claude Code no seu PC** (Windows):
   - Se você já usa o Claude no seu computador hoje (você está usando agora), **não
     precisa reinstalar nada** — só vai trocar a conta logada.
   - Para garantir, abra o programa do Claude (Claude Code/Desktop) e, no menu de
     conta, escolha **Sair** (Logout) da conta antiga.
   - Clique em **Entrar** (Login) e use **o e-mail e senha da clínica** criados acima.
6. **Apontar para a mesma pasta:** abra o Claude na pasta de sempre. No app de
   terminal, isso é simplesmente abrir o projeto em `C:\desenv\ClinicaGeny`. A pasta,
   o código e o histórico do Git **continuam exatamente onde estão** — você só mudou
   quem está pagando/logado.

> **Resultado:** mesma máquina, mesma pasta, mesmo código. Muda apenas a conta
> (agora da clínica) e a fatura (agora no cartão da clínica).

---

## Parte 2 — Supabase (o cofre de dados e logins)

Aqui está o coração da operação "sem perder dados". Vamos **transferir** o projeto
que já existe para uma organização criada pela clínica. **Os dados não saem do
lugar** — apenas a "conta dona" e a cobrança mudam.

### 2.1 — Criar a conta e a organização da clínica

1. Acesse **https://supabase.com** e clique em **Start your project** / **Sign in**.
2. Crie a conta com o **e-mail da clínica** (pode usar "Continue with GitHub" se a
   clínica tiver um GitHub próprio, mas o mais simples é e-mail + senha). Guarde na Ficha.
3. Confirme o e-mail.
4. Dentro do painel, crie uma **Organização** (Organization) chamada, por exemplo,
   **Instituto Geny Freitas**.
5. Escolha o **plano** dessa organização (o plano pago **Pro** é o recomendado para
   produção: ativa **backups automáticos** e remove pausas por inatividade). Informe
   o **cartão da clínica**.

### 2.2 — Transferir o projeto existente para a clínica (sem perder dados)

> Quem faz este passo é **quem é dono do projeto hoje** (você/desenvolvedor). A
> transferência precisa que **as duas contas** (a atual e a da clínica) estejam na
> mesma tela de organizações, então normalmente você **convida a conta da clínica**
> como membro, ou usa a transferência entre organizações.

1. Logado na conta **atual** (a que tem o projeto hoje), abra o **projeto do
   Instituto Geny**.
2. Vá em **Project Settings** (engrenagem) → **General**.
3. Procure a opção **Transfer project** (Transferir projeto).
4. Selecione a **organização da clínica** (criada em 2.1) como destino e confirme.
   - Se o botão estiver bloqueado, geralmente é porque a organização de **destino**
     precisa estar em um **plano pago** — conclua o passo 2.1 (plano Pro) antes.
5. A clínica (na conta dela) **aceita a transferência** quando solicitado.

> **O que NÃO muda na transferência:** o **endereço do projeto**
> (`https://....supabase.co`), a **chave pública (anon key)**, todos os **pacientes,
> profissionais, senhas, agendamentos, documentos e arquivos**. Por isso este caminho
> é seguro: nada é recriado.

### 2.3 — Anotar as credenciais públicas (para o `.env.local` e a Vercel)

1. No projeto (já na conta da clínica), vá em **Project Settings → API**.
2. Copie os dois valores **públicos** e anote na Ficha de Credenciais:

| Onde no painel | O que copiar | Vai para a variável |
|----------------|--------------|---------------------|
| Project URL | `https://SEU-PROJETO.supabase.co` | `VITE_SUPABASE_URL` |
| Project API keys → **anon public** | a chave longa marcada como **anon / public** | `VITE_SUPABASE_ANON_KEY` |

> **Importante:** na mesma tela existe a chave **service_role**. Ela é **SEGREDA**.
> **Não** copie para o site, **não** coloque no `.env.local`, **não** compartilhe.
> Ela só é usada dentro do Supabase (Edge Functions), nunca no navegador.

> Como estamos **transferindo** o mesmo projeto, esses dois valores são **os mesmos**
> que o sistema já usa. Se você já tem o `.env.local` preenchido e funcionando, eles
> não mudam. Confira mesmo assim.

### 2.4 — Rotacionar (trocar) os segredos que já foram expostos

Durante o desenvolvimento, alguns **segredos** apareceram em conversas/telas. Por
segurança, **troque-os** assim que a clínica assumir o projeto. Isso **não afeta os
logins dos usuários**.

1. **Senha do banco (database password):** Project Settings → **Database** →
   **Reset database password**. Gere uma nova, guarde na Ficha (segredo).
2. **service_role key:** Project Settings → **API** → **Reset/Roll** a chave
   `service_role` (se houver a opção de rotacionar). Atualize quem usa (Edge Functions).
3. **Google Client Secret** (se o login com Google estiver ativo): será trocado na
   **Parte 5**, no Google Cloud.

> **Por que isso importa.** São as "chaves-mestras". Trocá-las garante que ninguém de
> fora (nem ferramentas antigas) continue com acesso administrativo ao cofre.

### 2.5 — Conferir backups (proteção contra perda)

1. No plano **Pro**, o Supabase faz **backups diários automáticos**. Confirme em
   **Database → Backups**.
2. (Opcional, recomendado no dia da virada) Faça um **backup manual** antes de mexer
   em qualquer configuração, para ter um ponto de retorno.

---

## Parte 3 — GitHub (o código permanece)

O código **continua no repositório atual** (`IADefySolutions/defy-clinicas`). Você
não precisa mover nada. Só precisamos garantir que a **nova conta da Vercel** (da
clínica) consiga **ler** esse repositório para publicar o site.

Há duas formas de fazer isso na Parte 4:

- **Forma simples (recomendada):** dar à Vercel da clínica permissão de acesso a
  esse repositório específico durante a importação (a Vercel abre uma janela do
  GitHub pedindo isso).
- **Alternativa:** convidar o e-mail/conta da clínica como **colaborador** do
  repositório no GitHub (Settings → Collaborators), caso a importação exija.

> Você **não** precisa criar um repositório novo nem copiar arquivos. O GitHub fica
> exatamente como está hoje.

---

## Parte 4 — Vercel (publicar o site no novo endereço)

Objetivo: criar a conta da clínica na Vercel, publicar a partir do **mesmo GitHub**,
e nomear o projeto **institutogenyfreitas** para gerar o endereço
`https://institutogenyfreitas.vercel.app`.

### 4.1 — Criar a conta da clínica na Vercel

1. Acesse **https://vercel.com** → **Sign Up**.
2. Cadastre com o **e-mail da clínica** (ou "Continue with GitHub" se preferir).
3. Confirme o e-mail e escolha o plano (o **Hobby/Free** publica sites; para uso
   comercial a Vercel recomenda o **Pro** — confirme com o cartão da clínica).

### 4.2 — Importar o projeto do GitHub

1. No painel da Vercel: **Add New… → Project**.
2. Em **Import Git Repository**, conecte o GitHub e **autorize o acesso** ao
   repositório `defy-clinicas` (é aqui que a janela do GitHub aparece — veja Parte 3).
3. Clique em **Import** no repositório.

### 4.3 — Configurar o build (campos exatos)

Preencha exatamente assim:

| Campo | Valor |
|-------|-------|
| Project Name | `institutogenyfreitas` |
| Framework Preset | Vite |
| Root Directory | `app` (clique em **Edit** e selecione a pasta `app`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 20 ou superior |

> **Atenção ao nome do projeto.** Na Vercel, **o nome do projeto vira o endereço**.
> `institutogenyfreitas` → `institutogenyfreitas.vercel.app`. Se o nome já estiver em
> uso por outra pessoa, a Vercel avisa; nesse caso escolha uma variação (ex.:
> `institutogenyfreitas-app`) e ajuste o endereço nas Partes 5 e 6.

### 4.4 — Variáveis de ambiente na Vercel (as 4 chaves)

Antes de clicar em **Deploy**, abra **Environment Variables** e adicione as quatro
variáveis abaixo (marque para **Production** e **Preview**). São os **mesmos valores**
do seu `.env.local`:

| Variável | Valor | Tipo |
|----------|-------|------|
| `VITE_SUPABASE_URL` | endereço do Supabase (Parte 2.3) | público |
| `VITE_SUPABASE_ANON_KEY` | chave **anon/public** (Parte 2.3) | público |
| `VITE_CPF_EMAIL_DOMAIN` | **mantenha o mesmo valor atual** (ex.: `geny.local`) | público |
| `VITE_VAPID_PUBLIC_KEY` | chave **pública** de notificações (a mesma de hoje) | público |

> **NÃO ALTERE o `VITE_CPF_EMAIL_DOMAIN`.** Esse valor faz parte do "endereço interno"
> que identifica o login por **CPF**. Se ele mudar, os pacientes que entram por CPF
> **não conseguirão mais logar**. Copie exatamente o valor que já está em uso hoje.

### 4.5 — Publicar

1. Clique em **Deploy**. Aguarde a build terminar (1–3 minutos).
2. A Vercel mostra o endereço final: `https://institutogenyfreitas.vercel.app`.
3. **Ainda não divulgue** — falta ajustar o login (Parte 5) e testar (Parte 7).

---

## Parte 5 — Mudança de domínio: ajustes de login (Supabase + Google)

Trocamos o endereço do site. Agora precisamos avisar o **Supabase** e o **Google**
sobre o novo endereço, senão o **login para de funcionar** no domínio novo.

### 5.1 — Supabase: URLs de autenticação

1. No projeto Supabase (conta da clínica): **Authentication → URL Configuration**.
2. Em **Site URL**, coloque: `https://institutogenyfreitas.vercel.app`
3. Em **Redirect URLs**, adicione (uma por linha):
   - `https://institutogenyfreitas.vercel.app`
   - `https://institutogenyfreitas.vercel.app/**`
4. (Opcional) **Remova** o endereço antigo `https://defy-clinicas.vercel.app` quando
   confirmar que o novo funciona.
5. **Save**.

### 5.2 — Google (somente se o login "Entrar com Google" estiver ativo)

1. Acesse **https://console.cloud.google.com** com o e-mail que administra o login
   Google do sistema (idealmente migre para o e-mail da clínica).
2. Vá em **APIs & Services → Credentials** e abra o **OAuth Client** do sistema.
3. Em **Authorized JavaScript origins**, adicione:
   `https://institutogenyfreitas.vercel.app`
4. Em **Authorized redirect URIs**, confirme que existe o endereço de retorno do
   **Supabase** (não muda, pois é o mesmo projeto):
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`
5. **Save**. (A propagação pode levar alguns minutos.)
6. **Trocar o Client Secret (segredo):** ainda em Credentials, gere um **novo Client
   Secret**, copie-o e cole no Supabase em **Authentication → Providers → Google**
   (campo *Client Secret*). Assim o segredo antigo, que ficou exposto, deixa de valer.

> Se a clínica **não usa** o botão "Entrar com Google" (só CPF e e-mail/senha), você
> pode **pular a Parte 5.2** inteira.

---

## Parte 6 — Configurar o `.env.local` no seu computador

O `.env.local` é o arquivo do **seu PC** que permite rodar e publicar o sistema
localmente (o Claude usa isso quando você testa antes de subir). Ele fica em
`C:\desenv\ClinicaGeny\app\.env.local` e **nunca** vai para o GitHub (já está
protegido no `.gitignore`).

Preencha-o com **os mesmos quatro valores** que você colocou na Vercel (Parte 4.4):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=cole-aqui-a-chave-anon-publica
VITE_CPF_EMAIL_DOMAIN=geny.local        # MANTENHA o valor atual, não invente outro
VITE_VAPID_PUBLIC_KEY=cole-aqui-a-chave-publica-de-notificacoes
```

> **Só valores públicos aqui.** Repetindo, porque é importante: **nunca** coloque no
> `.env.local` a `service_role`, a senha do banco ou o Google Client Secret. Esses são
> segredos e moram apenas dentro do Supabase.

Para me enviar esses valores (e eu configuro o arquivo para você), basta colar no chat
**apenas** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CPF_EMAIL_DOMAIN` e
`VITE_VAPID_PUBLIC_KEY`. **Não** cole segredos.

---

## Parte 7 — Testes finais (antes de divulgar)

Abra `https://institutogenyfreitas.vercel.app` e confira, na ordem:

- [ ] **Página de login abre** normalmente (logo e nome da clínica aparecem).
- [ ] **Login do administrador/profissional** (e-mail e senha existentes) funciona.
- [ ] **Login de um paciente** já cadastrado (por CPF e/ou e-mail) funciona — isso
      prova que **os dados e senhas foram preservados**.
- [ ] **Agenda** lista os agendamentos já existentes.
- [ ] **Financeiro** abre e mostra os lançamentos.
- [ ] **Documentos** de um paciente abrem e geram PDF.
- [ ] (Se usa Google) **"Entrar com Google"** conclui o login no novo endereço.
- [ ] **Instalar como app** (no celular: "Adicionar à tela inicial") funciona.

> Se algum login falhar **só no endereço novo**, quase sempre é a **Parte 5** (URLs de
> autenticação). Reveja Site URL/Redirect URLs e, no Google, as origens autorizadas.

---

## Parte 8 — Plano de retorno (se algo der errado)

Como **não recriamos** o banco, o risco é baixo. Ainda assim:

1. **Login não funciona no domínio novo:** revise a **Parte 5** (Supabase URL
   Configuration e Google). O endereço antigo continua no ar enquanto você ajusta.
2. **Site não carrega/erro de build na Vercel:** confira a **Parte 4.3** (Root
   Directory = `app`) e a **Parte 4.4** (as 4 variáveis). Refaça o **Deploy**.
3. **Quero voltar atrás por completo:** o endereço antigo
   `https://defy-clinicas.vercel.app` permanece publicado até você decidir desligá-lo.
   Mantenha-o por alguns dias como rede de segurança.
4. **Problema no banco:** restaure o **backup** (Parte 2.5).

> **Desligue o site antigo só depois** de alguns dias com o novo funcionando 100%.

---

## Apêndice A — Ficha de Credenciais (preencha e guarde em local seguro)

> Guarde este apêndice **fora** do computador comum (gerenciador de senhas ou papel em
> local trancado). Os campos marcados **(SEGREDO)** nunca vão para o site/`.env.local`.

**Claude (Anthropic)**
- E-mail: ____________________________
- Senha: ____________________________ (SEGREDO)
- Plano contratado: __________________

**Supabase**
- E-mail / Senha: ____________________ / ____________ (SEGREDO)
- Organização: _______________________
- Project URL (`VITE_SUPABASE_URL`): __________________________________
- anon public key (`VITE_SUPABASE_ANON_KEY`): _________________________
- Database password (SEGREDO): _______________________________________
- service_role key (SEGREDO — nunca no site): ________________________

**Vercel**
- E-mail / Senha: ____________________ / ____________ (SEGREDO)
- Nome do projeto: institutogenyfreitas
- Endereço: https://institutogenyfreitas.vercel.app

**Variáveis públicas do app (`.env.local` e Vercel)**
- `VITE_SUPABASE_URL`: ________________________________________________
- `VITE_SUPABASE_ANON_KEY`: ___________________________________________
- `VITE_CPF_EMAIL_DOMAIN`: ____________ (mantém o atual, ex.: geny.local)
- `VITE_VAPID_PUBLIC_KEY`: ____________________________________________

**Google OAuth (se usado)**
- Conta Google admin: ________________________________________________
- Client ID: _________________________________________________________
- Client Secret (SEGREDO): ___________________________________________

---

## Apêndice B — (Avançado) Banco novo do zero, com migração de dados

Use **apenas** se a transferência (Caminho A) não for possível. **Tem mais risco**;
faça com calma e fora do horário de atendimento.

1. **Backup completo** do projeto atual: copie os dados (`pg_dump`) **incluindo o
   schema `auth`** — é nele que ficam os usuários e as senhas (em formato protegido).
   Sem o schema `auth`, **os logins se perdem**.
2. **Crie o projeto novo** na organização da clínica (Supabase → New Project). Anote o
   **novo** Project URL e a **nova** anon key (serão **diferentes** dos atuais).
3. **Aplique a estrutura** do sistema no projeto novo executando o arquivo
   `supabase/_apply_all.sql` no **SQL Editor**.
4. **Restaure os dados** do backup (incluindo `auth.users`), respeitando a ordem das
   tabelas e as chaves estrangeiras.
5. **Atualize** o `.env.local` e as variáveis da Vercel com a **nova** URL e a **nova**
   anon key (aqui os valores **mudam**, ao contrário do Caminho A).
6. **Reconfigure** as URLs de autenticação e o Google (Parte 5) no projeto novo.
7. **Teste exaustivamente** logins antigos (CPF e e-mail/senha) antes de desligar o
   projeto velho.

> **Por que o Caminho A é melhor:** ele evita os passos 1, 4 e 5 — justamente os de
> maior risco de perder usuários/senhas. Transferir é "trocar o dono"; recriar é
> "mudar de casa carregando o cofre aberto".

---

## Apêndice C — Segurança e LGPD (boas práticas)

- **Backups automáticos ligados** (Supabase Pro) e um backup manual antes de mudanças.
- **Segredos rotacionados** após a virada (Parte 2.4 e 5.2). Nunca em e-mail/WhatsApp.
- **Acesso por papéis**: revise em Configurações quem é Admin, Secretaria e
  Profissional (o sistema já tem matriz de permissões + bloqueio de rotas).
- **Dados de pacientes** são sensíveis (LGPD): PDFs com dados pessoais **não** devem
  ser commitados no GitHub (já bloqueado por `.gitignore`).
- **Senhas fortes e únicas** para cada serviço, guardadas em gerenciador de senhas.
- **Confirmação em duas etapas (2FA)** nas contas Supabase, Vercel, GitHub e Google,
  quando disponível.
