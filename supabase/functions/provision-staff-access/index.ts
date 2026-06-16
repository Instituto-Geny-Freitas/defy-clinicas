// =============================================================================
// Edge Function: provision-staff-access
// Cria/redefine o login de um PROFISSIONAL com senha provisória (força troca no
// 1º acesso). Apenas ADMIN pode chamar. Login da equipe é sempre por e-mail.
//
// Corpo: { professional_id: string, password: string }
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy provision-staff-access
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(token)
    if (!u?.user) return json({ error: 'não autenticado' }, 401)
    // Só admin provisiona equipe.
    const { data: caller } = await admin
      .from('professionals')
      .select('role')
      .eq('auth_user_id', u.user.id)
      .eq('ativo', true)
      .maybeSingle()
    if (caller?.role !== 'admin') return json({ error: 'apenas administradores podem provisionar acesso da equipe' }, 403)

    const { professional_id, password } = await req.json()
    if (!password || String(password).length < 6) return json({ error: 'senha mínima de 6 caracteres' }, 400)
    const { data: prof } = await admin.from('professionals').select('id, email, auth_user_id').eq('id', professional_id).single()
    if (!prof) return json({ error: 'profissional não encontrado' }, 404)
    if (!prof.email) return json({ error: 'profissional sem e-mail (necessário para o login)' }, 400)

    if (prof.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(prof.auth_user_id, { password })
      if (error) return json({ error: error.message }, 400)
      await admin.from('professionals').update({ senha_provisoria: true }).eq('id', professional_id)
      return json({ ok: true, mode: 'reset', login: prof.email })
    }

    const { data: created, error } = await admin.auth.admin.createUser({ email: prof.email, password, email_confirm: true })
    if (error) return json({ error: `Não foi possível criar o acesso: ${error.message}` }, 400)
    await admin.from('professionals').update({ auth_user_id: created.user.id, senha_provisoria: true }).eq('id', professional_id)
    return json({ ok: true, mode: 'created', login: prof.email })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
