# Dossiê de mercado e roadmap recomendado

> Pesquisa de mercado (agosto/2026) das soluções brasileiras de gestão para clínicas de
> estética, comparação com a nossa solução e o **roadmap recomendado** — nada aqui está em
> execução; é o material de decisão para as próximas ondas de produto.

---

## 1. Panorama do mercado (agosto/2026)

| Player | Posicionamento |
|---|---|
| **Belle Software** | Referência em estética: perimetria, fotos antes/depois, álbum do cliente, **parâmetros de laser**, avaliações prontas e personalizadas, automação de WhatsApp, **assinatura eletrônica** e **IA que transcreve áudio e resume o prontuário** |
| **Clinicorp** | Odonto + estética avançada; +100 mil usuários, +70 funcionalidades, **comissão por procedimento**, planos com antes/depois, CRM e **NFS-e** |
| **Feegow** | +200 funcionalidades, **IA que documenta durante o atendimento**, convênios/TISS |
| **IterClinic** | Focado em procedimentos estéticos (não consulta médica adaptada) |
| **Trinks · Booksy** | **Marketplace de clientes** (canal de aquisição) + agenda |
| **Agendiva · Simples Agenda** | Entrada de preço (**a partir de R$ 39,90/mês**); Agendiva organiza anamnese ANVISA e validade de produtos |
| **Esthetic Manager, Atendente.ai, YouAgent, Nextech, iZap** | Onda de **agentes de IA no WhatsApp**: atendem, qualificam e agendam 24/7 |

**Leitura:** agenda, prontuário e financeiro estão **saturados e maduros**. A diferenciação
recente do mercado migrou para **IA de aquisição** (chatbot que capta e agenda). Compliance
sanitário aparece pouco — POPs em geral são vendidos como **PDF por terceiros**.

## 2. Onde já estamos à frente

1. **Compliance sanitário de verdade** — módulo Administrativo com ~14 formulários
   configuráveis (esterilização, calibração, temperatura do refrigerador, pragas, EPIs,
   prestadores, intercorrências numeradas), PDF por período e um **construtor de formulários**
   que relaciona registros entre si.
2. **Assistente de IA voltado para dentro** — a **equipe opera o sistema por conversa**
   (agenda, financeiro, leads, alertas). O mercado colocou IA no paciente; eixo diferente.
3. **Profundidade clínico-financeira** — preço com vigência/histórico/reajuste, plano com
   **sessões e frequência por item** e saldo controlado, **pacote pré-pago com trava de
   preço**, orçamento complementar **proposto**, anti-dupla-cobrança e **verificação de
   consistência**.
4. **Estoque por lote/validade** com baixa e estorno automáticos; preço por lote.
5. **Gestão interna** — reuniões com ata/PDF/ciência/convocação + atividades com responsável
   e log. Não encontrado em software de clínica (só em plataformas de franquia, ex.: Sults).
6. **Fidelidade + indicação + NPS configurável** num fluxo só, com confirmação humana no
   dinheiro.

## 3. Lacunas (onde estamos atrás)

| Lacuna | Quem tem | Peso |
|---|---|---|
| **NFS-e / emissão fiscal** | Clinicorp | 🔴 alto — objeção comercial concreta |
| **WhatsApp oficial ativo** | Belle e quase todos | 🔴 alto — o nosso está preparado, não ligado |
| **Chatbot 24/7 que capta e agenda** | onda de IA | 🟠 médio-alto (aquisição) |
| **IA no prontuário (ditar evolução)** | Belle, Feegow | 🟠 médio |
| **Assinatura eletrônica com validade jurídica** | Belle | 🟠 médio (temos ciência + hash) |
| **Marketplace de pacientes** | Trinks, Booksy | 🟡 canal, não produto |
| **Parâmetros de equipamento** (laser: fluência, ponteira) | Belle | 🟡 baixo esforço, alto valor percebido |
| **Multi-unidade / franquia** | vários | 🟡 já previsto em `ROADMAP-multiclinica.md` |

## 4. Espaço criativo (não encontrado nos players pesquisados)

1. **Dossiê de fiscalização em um clique** — gerar o pacote ANVISA (POPs + registros do
   período + PGRSS) com alertas de vencimento (calibração, validade, treinamento).
   *Argumento de venda: "clínica pronta para a vigilância".*
2. **Rastreabilidade lote → paciente (recall)** — se um lote for recolhido, listar **quem
   recebeu**. Os dados já existem (lote na suplementação e no procedimento).
3. **Auditoria de receita** — evoluir a verificação de consistência para achar **dinheiro
   perdido**: procedimento executado sem cobrança, sessão consumida sem orçamento, produto
   usado fora do orçamento.
4. **Margem real por procedimento** — custo dos insumos (custo por lote) + tempo de sala +
   comissão ⇒ **lucro por procedimento**. O mercado calcula comissão; quase ninguém calcula
   margem.
5. **Score de risco de falta (no-show)** — prever quem tende a faltar e reforçar
   confirmação/encaixe.
6. **Compra preditiva de estoque** — sugerir reposição por consumo histórico + validade
   (evitar perda), não só alerta de mínimo.
7. **Trilha de treinamento da equipe com ciência de POPs** — encaixa na gestão interna já
   construída (atividades + ciência).

## 5. Roadmap recomendado

Ordem sugerida por **impacto comercial ÷ esforço**. Nada iniciado.

### Onda 1 — destravar vendas
| # | Item | Por quê | Notas técnicas |
|---|---|---|---|
| 1.1 | **Ligar o WhatsApp oficial** | Lacuna mais citada; lembrete automático reduz falta | Passos do cliente: conta Meta Business, número dedicado, **templates aprovados**, token. Nossos: criar `send-whatsapp`, publicar `send-notifications`, trocar canal dos lembretes de `in_app` p/ `whatsapp`, tela de teste de envio |
| 1.2 | **NFS-e** | Objeção comercial direta | Integração com prefeitura/gateway fiscal; exige definição de município e regime |
| 1.3 | **Parâmetros de equipamento no procedimento** | Barato, alto valor percebido em estética | Campos estruturados por tipo de procedimento (reusar o construtor de formulários) |

### Onda 2 — diferenciação difícil de copiar
| # | Item | Por quê |
|---|---|---|
| 2.1 | **Dossiê de fiscalização (ANVISA)** | Ninguém entrega; usa o que já temos |
| 2.2 | **Rastreabilidade lote → paciente (recall)** | Obrigação sanitária; dados já existem |
| 2.3 | **Auditoria de receita** | Vende sozinho ("o sistema achou R$ X") |
| 2.4 | **Margem real por procedimento** | Decisão de preço com dado real |

### Onda 3 — IA e retenção
| # | Item | Observação |
|---|---|---|
| 3.1 | **Transcrição de áudio → ata da reunião** | Já especificado (Fase 3a da gestão interna); **custo de API por áudio** |
| 3.2 | **Ditar a evolução do atendimento** | Fecha lacuna vs. Belle/Feegow; mesma infra do 3.1 |
| 3.3 | **Chatbot 24/7 de captação** | Onda do mercado; exige WhatsApp oficial (1.1) primeiro |
| 3.4 | **Score de no-show** | Precisa de histórico acumulado para treinar |
| 3.5 | **Compra preditiva de estoque** | Usa consumo + validade já registrados |

### Onda 4 — escala
| # | Item |
|---|---|
| 4.1 | **Multi-clínica / franquia** (ver `ROADMAP-multiclinica.md`) |
| 4.2 | **Trilha de treinamento + ciência de POPs** |
| 4.3 | **Assinatura eletrônica com validade jurídica** |

## 6. Riscos e cuidados

- **WhatsApp:** fora da janela de 24h só se envia **template aprovado**; a Meta cobra **por
  conversa**. Registrar **aceite do paciente** (LGPD) e permitir descadastro.
- **IA em prontuário/imagem:** cuidado com publicidade e normas de conselho (simulação de
  resultado é área sensível).
- **Compliance:** o dossiê ajuda, mas **não substitui** responsabilidade técnica.

## 7. Fontes

[Agendiva — comparativo 2026](https://agendiva.com.br/melhores-sistemas-para-clinica-de-estetica) ·
[Clinora — 9 melhores sistemas](https://clinora.com.br/os-9-melhores-sistemas-para-clinicas-de-estetica-em-2026/) ·
[IterClinic — 6 melhores testados](https://www.iterclinic.com/blog/os-6-melhores-sistemas-de-gestao-para-clinica-estetica-no-brasil-testados-em-2026) ·
[Belle Software](https://www.bellesoftware.com.br/software-de-harmonizacao-facial-para-clinicas-de-estetica/) ·
[Clinicorp](https://www.clinicorp.com/melhor-software-para-clinica-de-estetica) ·
[Feegow](https://feegowclinic.com.br/) ·
[Cloudia](https://cloudia.com.br/softwares-para-clinicas-de-estetica/) ·
[Agendiva — RDC 222 ANVISA](https://agendiva.com.br/blog/rdc-222-anvisa-estetica-guia-completo) ·
[Agendiva — POP biossegurança](https://agendiva.com.br/blog/pop-biosseguranca-esteticista-modelo) ·
[Esthetic Manager](https://estheticmanager.com.br/) ·
[Atendente.ai](https://www.atendente.ai/estetica) ·
[YouAgent](https://www.youagent.com.br/agente-de-ia-para-estetica) ·
[Sults](https://www.sults.com.br/blog/gestao-de-clinica/)

---

*Pesquisa e consolidação: agosto/2026. Revisar a cada ~6 meses — o mercado de IA para
clínicas está mudando rápido.*
