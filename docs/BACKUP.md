# Backup — Supabase (ClinicaGeny)

Estratégia de backup em duas camadas:

1. **PITR (rede de segurança de curto prazo)** — Point-in-Time Recovery gerenciado
   pelo Supabase (plano Pro+). Permite restaurar até ~o segundo, dentro da janela
   de retenção do plano. Restauração pelo painel do Supabase. Não gera arquivo.
2. **Dumps lógicos (cópia soberana de longo prazo)** — dumps completos gerados por
   GitHub Actions, criptografados e guardados como Release assets num repositório
   privado de backups. Portáveis, baixáveis localmente, retenção que você controla.

> Não são "deltas": cada dump é **completo**. Como o banco é pequeno, isso é mais
> simples e seguro que empilhar incrementais. A granularidade diária vem da cadência.

---

## 1. Ligar o PITR (uma vez)

Supabase Dashboard → projeto → **Database → Backups → Point-in-Time Recovery** → ativar.
Anote a janela de retenção do seu plano (ex.: 7 dias). Isso cobre incidentes recentes
com granularidade fina, sem depender dos dumps.

## 2. Configurar os dumps automáticos (uma vez)

### 2.1 Criar o repositório privado de backups
Crie um repo **privado** (ex.: `SuaOrg/defy-backups`). Ele receberá os arquivos
criptografados. Um repo pode servir vários projetos DEFY (assets são prefixados
pelo nome do projeto).

### 2.2 Gerar a passphrase de criptografia
Gere uma passphrase forte (guarde no gerenciador de senhas da equipe — **sem ela
não há restore**):

```bash
openssl rand -base64 32
```

### 2.3 Pegar a connection string
Supabase Dashboard → **Project Settings → Database → Connection string → Session pooler**
(porta **5432** — compatível com `pg_dump`). Copie a URI completa com a senha.

### 2.4 Criar um token para o repo de backups
GitHub → Settings → Developer settings → **Fine-grained token** com acesso ao repo
de backups: permissões **Contents: Read and write** (cobre Releases). Copie o token.

### 2.5 Cadastrar os secrets neste repositório
No repo do ClinicaGeny → **Settings → Secrets and variables → Actions → New secret**:

| Secret | Valor |
|--------|-------|
| `SUPABASE_DB_URL` | connection string do Session Pooler (com senha) |
| `BACKUP_ENCRYPTION_PASSPHRASE` | a passphrase do passo 2.2 |
| `BACKUP_REPO` | `SuaOrg/defy-backups` |
| `BACKUP_REPO_TOKEN` | o token do passo 2.4 |

### 2.6 Testar
Actions → **Backup (Supabase logical)** → **Run workflow** → tier `daily`.
Verifique o Release `backups-daily` no repo de backups: deve aparecer um asset
`clinicageny-daily-<data>-<sha>.tar.gz.gpg`.

---

## Cadência e retenção

| Tier | Quando roda | Retenção | Release (tag) |
|------|-------------|----------|---------------|
| `daily` | todo dia (exceto dias que viram weekly/monthly) | 14 dias | `backups-daily` |
| `weekly` | domingos | 56 dias (8 semanas) | `backups-weekly` |
| `monthly` | dia 1 do mês | 365 dias | `backups-monthly` |

Horário: **06:00 UTC (03:00 BRT)**. O prune apaga automaticamente assets além da
janela de cada tier.

## O que está / não está no backup

- ✅ Banco: schema `public` + `auth` (usuários) + `storage` (metadados) + roles.
- ❌ **Arquivos do Storage** (imagens/documentos nos buckets) — **não** entram no
  dump. Se pacientes têm anexos, adicionar rotina de sync dos buckets (ver
  "Melhorias futuras").
- ❌ Database Webhooks e algumas extensões — reativar manualmente no restore.

## Rodar um backup manual (local)

Requer `supabase` CLI, `gpg`, `git bash`/WSL:

```bash
export SUPABASE_DB_URL="postgresql://...session-pooler...:5432/postgres"
export BACKUP_ENCRYPTION_PASSPHRASE="..."
export TIER=daily
bash scripts/backup/backup.sh
```

## Restauração

Ver **[RESTORE_RUNBOOK.md](RESTORE_RUNBOOK.md)** — cobre os dois cenários
(PITR e dump lógico) e o teste periódico de restore.

## Melhorias futuras
- Backup dos arquivos do Storage (sync dos buckets para o mesmo repo/bucket).
- Drill automático de restore num projeto Supabase descartável (validação mensal).
- Extração para uma **skill DEFY** parametrizável (trocar apenas os secrets por projeto).
