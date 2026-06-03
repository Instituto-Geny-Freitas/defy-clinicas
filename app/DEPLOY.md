# Deploy do frontend (PWA)

O app é um site **estático** (Vite) que fala direto com o Supabase. Hospede em
qualquer CDN com free tier. Abaixo, passo a passo para **Cloudflare Pages**,
**Vercel** e **Netlify**. Escolha uma.

## Pré-requisitos

1. Código num repositório Git (GitHub/GitLab). A pasta do app é **`app/`**.
2. Valores públicos do Supabase (os mesmos do `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CPF_EMAIL_DOMAIN` (ex.: `geny.local`)

> Apenas valores **públicos**. Nunca configure service_role / senha do banco /
> Google Client Secret no frontend.

## Configuração de build (vale para as três plataformas)

| Campo | Valor |
|-------|-------|
| Root directory / Base | `app` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

O roteamento SPA já está resolvido: `public/_redirects` (Cloudflare/Netlify) e
`vercel.json` (Vercel) redirecionam todas as rotas para `index.html`.

---

## Opção A — Cloudflare Pages

1. Dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecione o repositório.
3. **Build settings**:
   - Framework preset: *None* (ou Vite)
   - Root directory: `app`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** (Production e Preview): adicione as 3 `VITE_*`.
5. **Save and Deploy**. A cada push na branch, faz deploy automático.
6. Domínio: use o `*.pages.dev` ou configure um domínio próprio em *Custom domains*.

## Opção B — Vercel

1. vercel.com → **Add New → Project** → importe o repositório.
2. **Root Directory**: `app` (clique em *Edit* e selecione a pasta).
3. Framework: *Vite* (detectado). Build/Output já vêm corretos.
4. **Environment Variables**: adicione as 3 `VITE_*`.
5. **Deploy**.

## Opção C — Netlify

1. netlify.com → **Add new site → Import an existing project**.
2. **Base directory**: `app` · **Build command**: `npm run build` · **Publish directory**: `app/dist`.
3. **Environment variables**: adicione as 3 `VITE_*`.
4. **Deploy site**.

---

## Pós-deploy (importante)

1. **Supabase Auth → URL Configuration**: adicione o domínio de produção
   (ex.: `https://clinica-geny.pages.dev`) em **Site URL** e **Redirect URLs**
   — necessário para o login com Google funcionar fora do localhost.
2. **CORS**: a API do Supabase aceita qualquer origem com a anon key; nada a fazer.
3. **PWA**: a plataforma serve HTTPS automaticamente, então o app fica
   **instalável** no celular (Adicionar à tela inicial).
4. **Cache do Service Worker**: a cada deploy, o `registerType: 'autoUpdate'`
   atualiza o app no próximo carregamento.

## Checklist de produção

- [ ] Migrations `0001`–`0016` aplicadas no projeto Supabase.
- [ ] Segredos expostos **rotacionados** (service_role, senha do banco, Google secret).
- [ ] Google OAuth ativado e domínio de produção nas Redirect URLs.
- [ ] Variáveis `VITE_*` configuradas na plataforma de hosting.
- [ ] (Opcional) Edge Functions deployadas para WhatsApp/PIX (ver `supabase/functions/README.md`).
