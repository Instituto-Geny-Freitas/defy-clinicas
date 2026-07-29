# Runbook de Restauração — ClinicaGeny

> Documento de contingência. Em incidente, siga na ordem. Não improvise sobre
> produção. A regra de ouro: **primeiro restaure para um destino de teste**,
> valide, e só então decida sobre produção.

## Antes de qualquer coisa
- [ ] Identifique o incidente: perda de dados? corrupção? exclusão acidental?
- [ ] **Pare gravações** se o banco de produção ainda estiver ativo e sendo corrompido.
- [ ] Determine o **momento-alvo** da recuperação (o mais próximo antes do incidente).
- [ ] Tenha à mão: `BACKUP_ENCRYPTION_PASSPHRASE` e acesso ao repo de backups.

---

## Cenário A — Incidente recente (dentro da janela do PITR)

Melhor opção para incidentes de horas/dias atrás: granularidade fina, menor perda.

1. Supabase Dashboard → projeto → **Database → Backups → Point-in-Time Recovery**.
2. Escolha o **timestamp-alvo** (logo antes do incidente).
3. Confirme a restauração. O Supabase reconstrói o banco até aquele ponto.
4. Valide (ver "Validação pós-restauro").

> Limitação: só funciona dentro da janela de retenção do plano. Fora dela, use o Cenário B.

---

## Cenário B — Recovery soberano via dump lógico (qualquer data disponível)

Use quando: fora da janela do PITR, ou para recriar o projeto em outro lugar.

### B.1 Escolher e baixar o backup
No repo de backups, Releases `backups-daily` / `backups-weekly` / `backups-monthly`.
Baixe o asset mais próximo (antes) do momento-alvo:

```bash
gh release download backups-daily -R SuaOrg/defy-backups \
  --pattern "clinicageny-daily-20260728*"
```

### B.2 Preparar o DESTINO
- **Recomendado (drill/contingência):** crie um **projeto Supabase novo/vazio**
  (ou um Postgres local para teste). Nunca teste sobre produção.
- Pegue a connection string do destino (Session Pooler, porta 5432).

### B.3 Restaurar
Requer `gpg`, `tar`, `psql`:

```bash
export TARGET_DB_URL="postgresql://...destino...:5432/postgres"
export BACKUP_ENCRYPTION_PASSPHRASE="..."
bash scripts/backup/restore.sh clinicageny-daily-20260728T060000Z-abc1234.tar.gz.gpg
```

O script pede confirmação (`RESTORE`), descriptografa, e aplica
`roles → schema → dados` com `session_replication_role = replica`.

### B.4 Pós-restauro manual (obrigatório)
- [ ] Reativar **Extensões** que o projeto usa (conferir no Dashboard).
- [ ] Reativar **Database Webhooks** (não são restaurados).
- [ ] Redefinir senha de **roles customizados**: `ALTER ROLE <role> PASSWORD '...';`
- [ ] Restaurar **arquivos do Storage** (buckets) se aplicável — não estão no dump.
- [ ] Se for assumir produção, apontar o app para o novo projeto (env `VITE_SUPABASE_*`).

---

## Validação pós-restauro (ambos os cenários)
- [ ] Contagens conferem: `select count(*) from public.<tabela_chave>;`
- [ ] **Login funciona**: teste um usuário real (valida o schema `auth`).
- [ ] Uma consulta de negócio-chave retorna dados coerentes.
- [ ] RLS ativo nas tabelas sensíveis (`select relrowsecurity from pg_class where ...`).
- [ ] App abre e navega sem erro de permissão.

---

## Teste periódico de restore (não pule!)
Um backup nunca testado não é um backup. **Mensalmente**:
1. Crie um projeto Supabase descartável (ou Postgres local).
2. Restaure o último `daily` (Cenário B) apontando para ele.
3. Rode a checklist de validação.
4. Registre data + resultado. Apague o destino de teste.

## Contatos / credenciais
- Passphrase de criptografia: _(gerenciador de senhas da equipe)_
- Repo de backups: `SuaOrg/defy-backups`
- Plano Supabase / janela PITR: _(preencher)_
