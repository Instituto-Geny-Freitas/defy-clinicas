// =============================================================================
// Edge Function: assistant
// Assistente conversacional do profissional (chat in-app). Recebe o histórico
// da conversa e executa um loop de "function calling" (OpenAI) onde cada
// ferramenta mapeia uma operação real do sistema, escopada ao profissional
// autenticado (agenda, financeiro, regularização, registros administrativos).
//
// Autorização: profissional ativo (mesmo login do sistema). O front chama via
// supabase.functions.invoke('assistant', { body }) — o JWT vai automático.
//
// Segredos: OPENAI_API_KEY (obrigatório), OPENAI_MODEL (opcional, gpt-4o-mini)
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetados)
// Deploy: supabase functions deploy assistant
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const TZ = 'America/Sao_Paulo'

// --- Contexto do profissional autenticado -----------------------------------
interface Prof { id: string; clinic_id: string; nome: string; role: string }

/** Formata um ISO (UTC) para data/hora local pt-BR (fuso da clínica). */
function localBR(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// --- Definição das ferramentas expostas ao modelo ----------------------------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'listar_agenda',
      description: 'Lista os agendamentos em um intervalo de datas. Use para "agenda de hoje", "consultas da semana", etc.',
      parameters: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Data inicial YYYY-MM-DD (fuso America/Sao_Paulo). Padrão: hoje.' },
          ate: { type: 'string', description: 'Data final YYYY-MM-DD. Padrão: igual a "de".' },
          escopo: { type: 'string', enum: ['minha', 'clinica'], description: 'minha = só do profissional logado; clinica = de toda a equipe. Padrão minha.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proxima_agenda',
      description: 'Retorna o próximo agendamento futuro do profissional logado (a consulta mais próxima).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_paciente',
      description: 'Busca pacientes ativos por nome (parcial). Use antes de agendar para confirmar qual paciente. Se retornar mais de um, pergunte ao profissional qual é o correto.',
      parameters: {
        type: 'object',
        properties: { nome: { type: 'string', description: 'Nome ou parte do nome do paciente.' } },
        required: ['nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checar_disponibilidade',
      description: 'Verifica se um horário está livre na agenda do profissional logado antes de agendar.',
      parameters: {
        type: 'object',
        properties: {
          inicio: { type: 'string', description: 'Início em ISO 8601 com fuso, ex.: 2026-07-15T14:00:00-03:00' },
          fim: { type: 'string', description: 'Fim em ISO 8601 (opcional; padrão +30min).' },
        },
        required: ['inicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_agendamento',
      description: 'Cria um agendamento para um paciente já identificado (patient_id). Confirme o paciente, a data e a hora com o profissional ANTES de chamar. A função checa o horário automaticamente e recusa se estiver indisponível.',
      parameters: {
        type: 'object',
        properties: {
          patient_id: { type: 'string', description: 'ID do paciente (obtido via buscar_paciente).' },
          inicio: { type: 'string', description: 'Início ISO 8601 com fuso -03:00.' },
          fim: { type: 'string', description: 'Fim ISO 8601 (opcional).' },
          procedimento: { type: 'string', description: 'Procedimento/motivo (opcional).' },
          observacoes: { type: 'string', description: 'Observações (opcional).' },
        },
        required: ['patient_id', 'inicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumo_financeiro',
      description: 'Totais financeiros em um intervalo. tipo: receitas (recebido/caixa), a_receber (parcelas de cartão pendentes), despesas.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receitas', 'a_receber', 'despesas'] },
          de: { type: 'string', description: 'Data inicial YYYY-MM-DD.' },
          ate: { type: 'string', description: 'Data final YYYY-MM-DD.' },
        },
        required: ['tipo', 'de', 'ate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_regularizar',
      description: 'Lista os agendamentos prévios sem cadastro (avulsos) que precisam ser regularizados/vinculados a um paciente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_alertas',
      description: 'Alertas operacionais: produtos com estoque baixo, produtos com validade próxima e quantidade de agendamentos a regularizar.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'preencher_registro_admin',
      description: 'Cria um registro em um formulário da Área Administrativa. Use listar_formularios_admin para descobrir a chave e os campos. Preencha "dados" com as chaves dos campos do formulário.',
      parameters: {
        type: 'object',
        properties: {
          form_chave: { type: 'string', description: 'Chave do formulário (ex.: intercorrencia).' },
          dados: { type: 'object', description: 'Objeto com os valores dos campos (key -> valor).' },
          patient_id: { type: 'string', description: 'ID do paciente, se o formulário for vinculado a paciente (opcional).' },
          ref_data: { type: 'string', description: 'Data principal do registro YYYY-MM-DD (opcional; padrão hoje).' },
        },
        required: ['form_chave', 'dados'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_formularios_admin',
      description: 'Lista os formulários administrativos disponíveis e seus campos (para saber o que preencher em preencher_registro_admin).',
      parameters: { type: 'object', properties: {} },
    },
  },
]

// --- Implementação das ferramentas -------------------------------------------
// `forms` são as definições enviadas pelo front (DEFAULT_FORMS + overrides).
interface FormField { key: string; label: string; tipo: string; obrigatorio?: boolean; opcoes?: string[]; suffix?: string }
interface FormDef { chave: string; titulo: string; grupo?: string; vinculo?: string; numerado?: boolean; numeradoEscopo?: string; campos: FormField[] }

async function runTool(name: string, args: Record<string, unknown>, prof: Prof, forms: FormDef[]): Promise<unknown> {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD local

  switch (name) {
    case 'listar_agenda': {
      const de = (args.de as string) || hoje
      const ate = (args.ate as string) || de
      const desdeISO = `${de}T00:00:00-03:00`
      const ateISO = `${ate}T23:59:59-03:00`
      let q = admin
        .from('appointments')
        .select('id, inicio, fim, status, procedimento, nome_avulso, professional_id, patients(nome), professionals(nome)')
        .eq('clinic_id', prof.clinic_id)
        .gte('inicio', desdeISO)
        .lte('inicio', ateISO)
        .order('inicio', { ascending: true })
      if ((args.escopo as string) !== 'clinica') q = q.eq('professional_id', prof.id)
      const { data, error } = await q
      if (error) return { erro: error.message }
      return (data ?? []).map((a: Record<string, any>) => ({
        id: a.id,
        quando: localBR(a.inicio),
        status: a.status,
        paciente: a.patients?.nome ?? a.nome_avulso ?? '(sem cadastro)',
        profissional: a.professionals?.nome ?? null,
        procedimento: a.procedimento,
      }))
    }

    case 'proxima_agenda': {
      const agoraISO = new Date().toISOString()
      const { data, error } = await admin
        .from('appointments')
        .select('id, inicio, status, procedimento, nome_avulso, patients(nome)')
        .eq('clinic_id', prof.clinic_id)
        .eq('professional_id', prof.id)
        .gte('inicio', agoraISO)
        .not('status', 'in', '(cancelado)')
        .order('inicio', { ascending: true })
        .limit(1)
      if (error) return { erro: error.message }
      if (!data || data.length === 0) return { mensagem: 'Nenhum agendamento futuro.' }
      const a: Record<string, any> = data[0]
      return { id: a.id, quando: localBR(a.inicio), status: a.status, paciente: a.patients?.nome ?? a.nome_avulso, procedimento: a.procedimento }
    }

    case 'buscar_paciente': {
      const termo = String(args.nome ?? '').trim()
      if (!termo) return { erro: 'Informe o nome.' }
      const { data, error } = await admin
        .from('patients')
        .select('id, nome, cpf, whatsapp, nascimento')
        .eq('clinic_id', prof.clinic_id)
        .eq('ativo', true)
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(10)
      if (error) return { erro: error.message }
      return { encontrados: data?.length ?? 0, pacientes: data ?? [] }
    }

    case 'checar_disponibilidade': {
      const inicio = args.inicio as string
      const { data, error } = await admin.rpc('check_slot', { p_prof: prof.id, p_inicio: inicio, p_fim: (args.fim as string) ?? null })
      if (error) return { erro: error.message }
      const msg: Record<string, string> = {
        ok: 'Horário disponível.', ocupado: 'Horário já reservado.',
        fora_horario: 'Fora do horário de atendimento do profissional.', bloqueado: 'Profissional indisponível nesta data.',
      }
      return { status: data, mensagem: msg[data as string] ?? String(data) }
    }

    case 'criar_agendamento': {
      const inicio = args.inicio as string
      const fim = (args.fim as string) ?? null
      // Checagem de disponibilidade obrigatória antes de gravar
      const { data: slot } = await admin.rpc('check_slot', { p_prof: prof.id, p_inicio: inicio, p_fim: fim })
      if (slot && slot !== 'ok') {
        const msg: Record<string, string> = { ocupado: 'Horário já reservado.', fora_horario: 'Fora do horário de atendimento.', bloqueado: 'Profissional indisponível nesta data.' }
        return { criado: false, motivo: msg[slot as string] ?? String(slot) }
      }
      const { data, error } = await admin
        .from('appointments')
        .insert({
          clinic_id: prof.clinic_id, patient_id: args.patient_id, professional_id: prof.id,
          procedimento: (args.procedimento as string) ?? null, inicio, fim,
          observacoes: (args.observacoes as string) ?? null, status: 'agendado', origem: 'profissional',
        })
        .select('id, inicio')
        .single()
      if (error) return { criado: false, erro: error.message }
      return { criado: true, id: data.id, quando: localBR(data.inicio) }
    }

    case 'resumo_financeiro': {
      const de = args.de as string
      const ate = args.ate as string
      const tipo = args.tipo as string
      if (tipo === 'receitas') {
        const { data, error } = await admin
          .from('payments')
          .select('valor, pago_em, created_at')
          .eq('clinic_id', prof.clinic_id)
          .eq('status', 'pago')
        if (error) return { erro: error.message }
        const dentro = (data ?? []).filter((p: Record<string, any>) => {
          const d = (p.pago_em ?? p.created_at ?? '').slice(0, 10)
          return d >= de && d <= ate
        })
        const total = dentro.reduce((s: number, p: Record<string, any>) => s + Number(p.valor), 0)
        return { tipo, de, ate, total, lancamentos: dentro.length }
      }
      if (tipo === 'a_receber') {
        const { data, error } = await admin
          .from('payments')
          .select('valor, vencimento, parcela, total_parcelas, patients(nome)')
          .eq('clinic_id', prof.clinic_id)
          .eq('status', 'pendente')
          .gte('vencimento', de)
          .lte('vencimento', ate)
          .order('vencimento')
        if (error) return { erro: error.message }
        const total = (data ?? []).reduce((s: number, p: Record<string, any>) => s + Number(p.valor), 0)
        return { tipo, de, ate, total, parcelas: (data ?? []).map((p: Record<string, any>) => ({ paciente: p.patients?.nome, valor: Number(p.valor), vencimento: p.vencimento, parcela: `${p.parcela}/${p.total_parcelas}` })) }
      }
      // despesas
      const { data, error } = await admin
        .from('expenses')
        .select('valor, data, pago, descricao')
        .eq('clinic_id', prof.clinic_id)
        .gte('data', de)
        .lte('data', ate)
      if (error) return { erro: error.message }
      const total = (data ?? []).reduce((s: number, e: Record<string, any>) => s + Number(e.valor), 0)
      const pagas = (data ?? []).filter((e: Record<string, any>) => e.pago).reduce((s: number, e: Record<string, any>) => s + Number(e.valor), 0)
      return { tipo, de, ate, total, pagas, em_aberto: total - pagas, lancamentos: data?.length ?? 0 }
    }

    case 'listar_regularizar': {
      const { data, error } = await admin
        .from('appointments')
        .select('id, inicio, nome_avulso, telefone_avulso, procedimento')
        .eq('clinic_id', prof.clinic_id)
        .is('patient_id', null)
        .order('inicio', { ascending: true })
        .limit(50)
      if (error) return { erro: error.message }
      // Agrupa por nome para não repetir a mesma pessoa várias vezes
      const porNome = new Map<string, { nome: string; telefone: string | null; ocorrencias: number; proximo: string }>()
      for (const a of (data ?? []) as Record<string, any>[]) {
        const nome = a.nome_avulso ?? '(sem nome)'
        const ex = porNome.get(nome)
        if (ex) ex.ocorrencias++
        else porNome.set(nome, { nome, telefone: a.telefone_avulso, ocorrencias: 1, proximo: localBR(a.inicio) })
      }
      return { total_pessoas: porNome.size, pessoas: [...porNome.values()] }
    }

    case 'listar_alertas': {
      const { data: inv } = await admin
        .from('inventory')
        .select('produto, qtd_atual, qtd_minima, validade')
        .eq('clinic_id', prof.clinic_id)
      const hojeD = new Date(hoje)
      const em30 = new Date(hojeD); em30.setDate(em30.getDate() + 30)
      const baixo = (inv ?? []).filter((i: Record<string, any>) => Number(i.qtd_atual) <= Number(i.qtd_minima ?? 0))
        .map((i: Record<string, any>) => ({ produto: i.produto, qtd: i.qtd_atual, minimo: i.qtd_minima }))
      const validade = (inv ?? []).filter((i: Record<string, any>) => i.validade && new Date(i.validade) <= em30)
        .map((i: Record<string, any>) => ({ produto: i.produto, validade: i.validade }))
      const { count } = await admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', prof.clinic_id)
        .is('patient_id', null)
      return { estoque_baixo: baixo, validade_proxima: validade, agendamentos_a_regularizar: count ?? 0 }
    }

    case 'listar_formularios_admin': {
      return forms.map((f) => ({
        chave: f.chave, titulo: f.titulo, grupo: f.grupo, vinculo: f.vinculo,
        campos: f.campos.map((c) => ({ key: c.key, label: c.label, tipo: c.tipo, obrigatorio: c.obrigatorio, opcoes: c.opcoes })),
      }))
    }

    case 'preencher_registro_admin': {
      const chave = args.form_chave as string
      const def = forms.find((f) => f.chave === chave)
      if (!def) return { criado: false, erro: `Formulário "${chave}" não encontrado.` }
      const dados = (args.dados as Record<string, unknown>) ?? {}
      const refData = (args.ref_data as string) ?? hoje
      let seq: string | null = null
      if (def.numerado) {
        const ano = Number(refData.slice(0, 4))
        const { data: n, error: eSeq } = await admin.rpc('next_admin_seq', { p_clinic: prof.clinic_id, p_escopo: def.numeradoEscopo ?? chave, p_ano: ano })
        if (eSeq) return { criado: false, erro: eSeq.message }
        const { data: cli } = await admin.from('clinics').select('dados_empresa').eq('id', prof.clinic_id).maybeSingle()
        const codigo = (cli?.dados_empresa?.codigo as string) ?? 'CLI'
        seq = `${String(n).padStart(5, '0')}/${ano}/${codigo}`
      }
      const { error } = await admin.from('admin_records').insert({
        clinic_id: prof.clinic_id, form_chave: chave, patient_id: (args.patient_id as string) ?? null,
        ref_data: refData, seq, dados, created_by: prof.id, created_by_nome: prof.nome,
      })
      if (error) return { criado: false, erro: error.message }
      return { criado: true, formulario: def.titulo, seq }
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` }
  }
}

// --- Loop de conversa (function calling) -------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(token)
    if (!u?.user) return json({ error: 'não autenticado' }, 401)
    const { data: prof } = await admin
      .from('professionals')
      .select('id, clinic_id, nome, role')
      .eq('auth_user_id', u.user.id)
      .eq('ativo', true)
      .maybeSingle()
    if (!prof) return json({ error: 'apenas equipe' }, 403)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'IA não configurada. Defina o segredo OPENAI_API_KEY.' }, 400)

    const body = await req.json()
    const historico: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : []
    const forms: FormDef[] = Array.isArray(body.forms) ? body.forms : []

    const agoraLocal = new Date().toLocaleString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

    const sistema = [
      `Você é o assistente interno do sistema da clínica "Instituto Geny Freitas". Fale português do Brasil, de forma breve, cordial e objetiva.`,
      `Você conversa com a profissional ${(prof as Prof).nome} (perfil: ${(prof as Prof).role}).`,
      `Agora é ${agoraLocal} (fuso America/Sao_Paulo, UTC-03:00). A data de hoje é ${hoje}.`,
      `Ao interpretar horários informados pela profissional, use SEMPRE o fuso America/Sao_Paulo e gere datas em ISO 8601 com offset -03:00 (ex.: 2026-07-15T14:00:00-03:00).`,
      `Você só pode ajudar com assuntos do sistema (agenda, pacientes, financeiro, regularização de agendamentos, alertas e registros administrativos). Recuse educadamente pedidos fora desse escopo.`,
      `Regras de agendamento: 1) identifique o paciente com buscar_paciente; se houver mais de um com o mesmo nome, PERGUNTE qual antes de prosseguir; 2) confirme data e horário; 3) só então chame criar_agendamento (ela revalida o horário). Nunca invente IDs de paciente.`,
      `Antes de executar ações que gravam dados (criar agendamento, preencher registro administrativo), confirme os detalhes com a profissional em uma frase.`,
      `Ao mostrar listas, seja conciso: use tópicos curtos. Valores monetários em R$ com duas casas.`,
    ].join(' ')

    const messages: Record<string, unknown>[] = [
      { role: 'system', content: sistema },
      ...historico.map((m) => ({ role: m.role, content: m.content })),
    ]

    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
    let reply = ''
    // Até 6 rodadas para acomodar cadeias de ferramentas (buscar → checar → criar).
    for (let i = 0; i < 6; i++) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.2 }),
      })
      if (!r.ok) return json({ error: `Falha na IA (${r.status}): ${(await r.text()).slice(0, 300)}` }, 400)
      const data = await r.json()
      const msg = data?.choices?.[0]?.message
      if (!msg) return json({ error: 'Resposta vazia da IA.' }, 400)
      messages.push(msg)

      const toolCalls = msg.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined
      if (!toolCalls || toolCalls.length === 0) {
        reply = msg.content ?? ''
        break
      }
      // Executa cada ferramenta e devolve o resultado ao modelo
      for (const tc of toolCalls) {
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(tc.function.arguments || '{}') } catch { /* ignore */ }
        let resultado: unknown
        try { resultado = await runTool(tc.function.name, parsed, prof as Prof, forms) }
        catch (e) { resultado = { erro: String(e) } }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) })
      }
    }

    if (!reply) reply = 'Desculpe, não consegui concluir. Pode reformular?'
    return json({ reply })
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}` : String(e)
    console.error('[assistant] erro:', e)
    return json({ error: `Erro interno: ${msg}` }, 500)
  }
})
