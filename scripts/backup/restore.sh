#!/usr/bin/env bash
#
# restore.sh — Restaura um backup lógico gerado por backup.sh em um Postgres
# de destino (projeto Supabase NOVO/vazio, ou um Postgres local para DRILL de teste).
#
# ATENÇÃO: restauração é destrutiva no destino. NUNCA aponte para produção
# a menos que seja um desastre real e você saiba o que está fazendo.
#
# Variáveis de ambiente esperadas:
#   TARGET_DB_URL                 (obrigatória) connection string do Postgres de DESTINO
#   BACKUP_ENCRYPTION_PASSPHRASE  (obrigatória) mesma passphrase usada no backup
#
# Uso:
#   TARGET_DB_URL=... BACKUP_ENCRYPTION_PASSPHRASE=... \
#     ./restore.sh caminho/para/arquivo.tar.gz.gpg
#
set -euo pipefail

ENC_FILE="${1:-}"
[ -n "$ENC_FILE" ] || { echo "Uso: $0 <arquivo.tar.gz.gpg>" >&2; exit 2; }
[ -f "$ENC_FILE" ] || { echo "Arquivo não encontrado: $ENC_FILE" >&2; exit 2; }
: "${TARGET_DB_URL:?defina TARGET_DB_URL (destino da restauração)}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?defina BACKUP_ENCRYPTION_PASSPHRASE}"

for bin in gpg tar psql; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Dependência ausente: $bin" >&2; exit 3; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo ">> [1/4] Descriptografando..."
gpg --batch --yes --pinentry-mode loopback \
  --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" \
  -o "$WORK/backup.tar.gz" -d "$ENC_FILE"

echo ">> [2/4] Extraindo..."
tar -xzf "$WORK/backup.tar.gz" -C "$WORK"
for f in roles.sql schema.sql data.sql; do
  [ -f "$WORK/$f" ] || { echo "Arquivo esperado ausente no backup: $f" >&2; exit 4; }
done
[ -f "$WORK/manifest.json" ] && { echo "-- manifesto --"; cat "$WORK/manifest.json"; echo; }

echo ">> [3/4] CONFIRMAÇÃO"
echo "    Destino: $(echo "$TARGET_DB_URL" | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#')"
echo "    Isto vai aplicar roles + schema + dados no destino acima."
if [ "${ASSUME_YES:-}" != "1" ]; then
  printf "    Digite RESTORE para continuar: "
  read -r ans
  [ "$ans" = "RESTORE" ] || { echo "Abortado."; exit 5; }
fi

echo ">> [4/4] Restaurando (roles -> schema -> dados, triggers desativados)..."
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$WORK/roles.sql" \
  --file "$WORK/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$WORK/data.sql" \
  --dbname "$TARGET_DB_URL"

cat <<'EOF'

>> Restauração concluída.

PÓS-RESTAURO (fazer manualmente no projeto de destino):
  1. Reativar Extensões que o projeto usava (o dump de schema tenta, mas confira).
  2. Reativar Database Webhooks (não são restaurados automaticamente).
  3. Roles customizados exigem redefinição de senha via ALTER ROLE ... PASSWORD.
  4. Storage de ARQUIVOS (imagens/documentos nos buckets) NÃO está neste backup —
     restaure os arquivos separadamente se aplicável.
  5. Validar login de um usuário e uma consulta chave antes de liberar acesso.
EOF
