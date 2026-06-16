// =============================================================================
// Edge Function: provision-staff-access
// Gerencia o acesso de um PROFISSIONAL: cria o login, redefine a senha (força
// troca no 1º acesso) e/ou altera o e-mail de login (chave de acesso).
// Apenas ADMIN pode chamar. Login da equipe é sempre por e-mail.
//
// A troca de e-mail NÃO altera o professionals.id nem o auth_user_id (UUIDs),
// portanto preserva todos os relacionamentos existentes — só muda a chave de
// login no Auth e o campo professionals.email.
//
// Corpo: { professional_id: string, password?: string, novo_email?: string }
//   - password   → define/redefine a senha (mín. 6) e força troca no 1º acesso
//   - novo_email → altera o e-mail de login (requer login já existente)
//   (informe pelo menos um dos dois)
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

    const { professional_id, password, novo_email } = await req.json()

    const trocarSenha = typeof password === 'string' && password.length > 0
    const novoEmail = typeof novo_email === 'string' ? novo_email.trim().toLowerCase() : ''
    const trocarEmail = novoEmail.length > 0
    if (!trocarSenha && !trocarEmail) return json({ error: 'informe uma nova senha e/ou um novo e-mail' }, 400)
    if (trocarSenha && String(password).length < 6) return json({ error: 'senha mínima de 6 caracteres' }, 400)
    if (trocarEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novoEmail)) return json({ error: 'e-mail inválido' }, 400)

    const { data: prof } = await admin.from('professionals').select('id, email, auth_user_id').eq('id', professional_id).single()
    if (!prof) return json({ error: 'profissional não encontrado' }, 404)

    const emailFinal = trocarEmail ? novoEmail : prof.email
    if (!emailFinal) return json({ error: 'profissional sem e-mail (necessário para o login)' }, 400)

    // Já tem login → atualiza senha e/ou e-mail (sem tocar no auth_user_id).
    if (prof.auth_user_id) {
      const patch: { password?: string; email?: string; email_confirm?: boolean } = {}
      if (trocarSenha) patch.password = password
      if (trocarEmail) { patch.email = emailFinal; patch.email_confirm = true }
      const { error } = await admin.auth.admin.updateUserById(prof.auth_user_id, patch)
      if (error) return json({ error: error.message }, 400)
      const profPatch: { email?: string; senha_provisoria?: boolean } = {}
      if (trocarEmail) profPatch.email = emailFinal
      if (trocarSenha) profPatch.senha_provisoria = true
      if (Object.keys(profPatch).length) await admin.from('professionals').update(profPatch).eq('id', professional_id)
      return json({ ok: true, mode: 'updated', login: emailFinal })
    }

    // Sem login ainda → cria (precisa de senha).
    if (!trocarSenha) return json({ error: 'defina uma senha para criar o acesso' }, 400)
    const { data: created, error } = await admin.auth.admin.createUser({ email: emailFinal, password, email_confirm: true })
    if (error) return json({ error: `Não foi possível criar o acesso: ${error.message}` }, 400)
    await admin.from('professionals').update({ auth_user_id: created.user.id, email: emailFinal, senha_provisoria: true }).eq('id', professional_id)
    return json({ ok: true, mode: 'created', login: emailFinal })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
