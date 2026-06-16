// =============================================================================
// Edge Function: provision-patient-access
// Cria o usuário de login do paciente com uma senha provisória definida pela
// clínica, vincula ao cadastro e marca senha_provisoria = true (força troca no
// 1º acesso). Exige admin.createUser → roda com service_role (server-side).
//
// Autorização: só membros ATIVOS da equipe (professionals) podem chamar.
// Corpo: { patient_id: string, password: string }
//
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CPF_EMAIL_DOMAIN (opcional)
// Deploy: supabase functions deploy provision-patient-access
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // 1) Autoriza: o chamador precisa ser equipe ativa.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(token)
    if (!u?.user) return json({ error: 'não autenticado' }, 401)
    const { data: prof } = await admin
      .from('professionals')
      .select('id')
      .eq('auth_user_id', u.user.id)
      .eq('ativo', true)
      .maybeSingle()
    if (!prof) return json({ error: 'apenas equipe pode provisionar acesso' }, 403)

    // 2) Lê o paciente e decide o e-mail de login (CPF sintético ou e-mail real).
    const { patient_id, password } = await req.json()
    if (!password || String(password).length < 6) return json({ error: 'senha mínima de 6 caracteres' }, 400)
    const { data: pat } = await admin.from('patients').select('id, email, cpf, auth_user_id').eq('id', patient_id).single()
    if (!pat) return json({ error: 'paciente não encontrado' }, 404)

    // Prefere o e-mail cadastrado; só usa o login sintético por CPF se não houver e-mail.
    const domain = Deno.env.get('CPF_EMAIL_DOMAIN') ?? 'geny.local'
    const cpfLogin = pat.cpf ? `${String(pat.cpf).replace(/\D/g, '')}@${domain}` : null
    const emailCadastrado = pat.email ? String(pat.email).trim() : ''
    const loginEmail = emailCadastrado || cpfLogin
    if (!loginEmail) return json({ error: 'paciente sem e-mail nem CPF para login' }, 400)

    // 3a) Já tem login → REDEFINE a senha (e atualiza o e-mail de login se mudou).
    if (pat.auth_user_id) {
      const patch: { password: string; email?: string; email_confirm?: boolean } = { password }
      const { data: atual } = await admin.auth.admin.getUserById(pat.auth_user_id)
      if (atual?.user?.email && atual.user.email.toLowerCase() !== loginEmail.toLowerCase()) {
        patch.email = loginEmail
        patch.email_confirm = true
      }
      const { error: upErr } = await admin.auth.admin.updateUserById(pat.auth_user_id, patch)
      if (upErr) return json({ error: upErr.message }, 400)
      await admin.from('patients').update({ senha_provisoria: true }).eq('id', patient_id)
      return json({ ok: true, mode: 'reset', login: loginEmail })
    }

    // 3b) Sem login → CRIA o usuário (confirmado) com a senha provisória.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
    })
    if (error) return json({ error: `Não foi possível criar o acesso: ${error.message}` }, 400)

    await admin
      .from('patients')
      .update({ auth_user_id: created.user.id, senha_provisoria: true })
      .eq('id', patient_id)

    return json({ ok: true, mode: 'created', login: loginEmail })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
