# App — Clínica Geny (PWA)

Frontend PWA do sistema. **React + Vite + TypeScript + Tailwind**, dados/auth via
`@supabase/supabase-js` (segurança garantida pelo RLS do banco). Sem backend próprio.

## Rodar localmente

```powershell
cd app
npm install
copy .env.example .env.local   # preencha URL e anon key do Supabase
npm run dev                    # http://localhost:5173
```

Outros scripts: `npm run build` (typecheck + build de produção) · `npm run preview` · `npm run typecheck`.

## Estrutura

```
app/
├── index.html
├── vite.config.ts            Vite + PWA (manifest/service worker)
├── tailwind.config.js        Cores white-label via CSS variables
├── public/                   favicon + ícones PWA
└── src/
    ├── main.tsx              Providers (Theme, Auth) + App
    ├── App.tsx               Roteamento + guardas por perfil
    ├── index.css             Tailwind + cores padrão (fallback)
    ├── lib/
    │   ├── supabase.ts       Cliente Supabase + helpers de CPF
    │   └── types.ts          Tipos compartilhados
    ├── auth/AuthProvider.tsx Sessão + resolução de perfil (staff/paciente)
    ├── theme/ThemeProvider.tsx  Carrega tema/logo da clínica em runtime
    ├── components/Placeholder.tsx
    ├── layouts/
    │   ├── ClinicLayout.tsx  Área da Clínica (menu lateral)
    │   └── PatientLayout.tsx Portal do Paciente (nav inferior, mobile-first)
    └── pages/
        ├── Login.tsx                 Google + CPF/senha
        ├── clinic/Dashboard.tsx
        ├── clinic/PatientsList.tsx
        └── patient/PatientHome.tsx
```

## Como o acesso é decidido

1. `AuthProvider` lê a sessão do Supabase.
2. Procura o usuário em `professionals` (→ **equipe**) ou `patients` (→ **paciente**).
3. `App.tsx` direciona para `/clinica/*` (equipe) ou `/portal/*` (paciente).
   Conta sem vínculo vê um aviso para procurar a recepção.

## White-label

`ThemeProvider` lê `clinics.tema_cores` e aplica as cores como CSS variables
(`--cor-primaria`, etc.), usadas pelo Tailwind (`bg-primaria`, `text-texto`…).
Trocar as cores no banco muda o app inteiro, sem rebuild.

## Login por CPF

Não há "login por CPF" nativo no Supabase Auth. O helper `cpfToEmail()` traduz
o CPF para um e-mail sintético interno (`<cpf>@geny.local`, configurável em
`VITE_CPF_EMAIL_DOMAIN`) e usa `signInWithPassword`. O cadastro do paciente deve
criar o usuário com esse mesmo e-mail.

## Próximas implementações (sobre este esqueleto)

- Telas reais dos módulos hoje em `Placeholder` (agenda, documentos, estoque, financeiro…).
- Formulário de anamnese dinâmico (paciente e profissional).
- Captura/galeria de fotos clínicas (antes/depois).
- Assinatura de termos no portal (canvas + registro de aceite).
- Geração de `types.ts` automática: `supabase gen types typescript`.
```
