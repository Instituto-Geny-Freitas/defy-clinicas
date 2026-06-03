// =============================================================================
// Edge Function: treatment-plan-suggest
// Sugere o texto de um plano de tratamento com base no contexto clínico do
// paciente (anamnese + última avaliação), via LLM (OpenAI por padrão).
//
// Autorização: equipe ativa. Corpo: { patient_id: string, instrucao?: string }
// Segredos: OPENAI_API_KEY (obrigatório p/ funcionar), OPENAI_MODEL (opcional)
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetados)
// Deploy: supabase functions deploy treatment-plan-suggest
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(token)
    if (!u?.user) return json({ error: 'não autenticado' }, 401)
    const { data: prof } = await admin.from('professionals').select('id').eq('auth_user_id', u.user.id).eq('ativo', true).maybeSingle()
    if (!prof) return json({ error: 'apenas equipe' }, 403)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'IA não configurada. Defina o segredo OPENAI_API_KEY.' }, 400)

    const { patient_id, instrucao } = await req.json()
    const [{ data: pac }, { data: anam }, { data: aval }] = await Promise.all([
      admin.from('patients').select('nome, nascimento').eq('id', patient_id).maybeSingle(),
      admin.from('anamnesis').select('dados').eq('patient_id', patient_id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('assessments').select('tipo, dados, tratamento_proposto').eq('patient_id', patient_id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const contexto = JSON.stringify({ paciente: pac, anamnese: anam?.dados ?? {}, avaliacao: aval ?? {} }).slice(0, 6000)
    const sistema = 'Você é um assistente de uma clínica de estética. Redija um PLANO DE TRATAMENTO objetivo, profissional e seguro em português do Brasil, baseado nos dados fornecidos. Não invente diagnósticos médicos; foque em condutas estéticas, recursos, número de sessões sugerido e orientações de home care. Texto corrido, pronto para revisão do profissional.'
    const usuario = `Dados do paciente (JSON):\n${contexto}\n\nInstrução adicional do profissional: ${instrucao || '(nenhuma)'}\n\nGere o plano de tratamento.`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
        temperature: 0.5,
      }),
    })
    if (!r.ok) return json({ error: `Falha na IA (${r.status}): ${(await r.text()).slice(0, 200)}` }, 400)
    const data = await r.json()
    const texto = data?.choices?.[0]?.message?.content ?? ''
    return json({ texto })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
