#!/usr/bin/env bash
#
# backup.sh — Dump lógico completo do Supabase (roles + schema + dados),
# empacotado e criptografado. Funciona no GitHub Actions (ubuntu) e localmente
# (Git Bash / WSL). Não faz upload: apenas gera o artefato criptografado.
#
# Variáveis de ambiente esperadas:
#   SUPABASE_DB_URL               (obrigatória) connection string do Postgres do projeto
#                                 (use o Session Pooler, porta 5432 — compatível com pg_dump)
#   BACKUP_ENCRYPTION_PASSPHRASE  (obrigatória) passphrase forte para criptografia AES256
#   TIER                          (opcional) daily | weekly | monthly  (default: daily)
#   PROJECT_NAME                  (opcional) prefixo do arquivo         (default: clinicageny)
#   OUT_DIR                       (opcional) diretório de saída         (default: ./backup-out)
#
# Saída: $OUT_DIR/<project>-<tier>-<UTCtimestamp>-<gitsha>.tar.gz.gpg
#        (imprime o caminho do arquivo gerado na última linha do stdout)
#
set -euo pipefail

: "${SUPABASE_DB_URL:?defina SUPABASE_DB_URL}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?defina BACKUP_ENCRYPTION_PASSPHRASE}"
TIER="${TIER:-daily}"
PROJECT_NAME="${PROJECT_NAME:-clinicageny}"
OUT_DIR="${OUT_DIR:-./backup-out}"

case "$TIER" in
  daily|weekly|monthly) ;;
  *) echo "TIER inválido: '$TIER' (use daily|weekly|monthly)" >&2; exit 2 ;;
esac

for bin in supabase gpg tar gzip; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Dependência ausente: $bin" >&2; exit 3; }
done

TS="$(date -u +%Y%m%dT%H%M%SZ)"
GITSHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT_DIR"

echo ">> [1/5] Dump de roles..."
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$WORK/roles.sql" --role-only

echo ">> [2/5] Dump de schema (public + auth + storage + demais)..."
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$WORK/schema.sql"

echo ">> [3/5] Dump de dados (inclui auth.users e storage)..."
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$WORK/data.sql" \
  --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

# Manifesto para rastreabilidade do restore
cat > "$WORK/manifest.json" <<EOF
{
  "project": "$PROJECT_NAME",
  "tier": "$TIER",
  "created_utc": "$TS",
  "git_sha": "$GITSHA",
  "format": "supabase-cli-logical-v1",
  "files": ["roles.sql", "schema.sql", "data.sql"],
  "restore_order": ["roles.sql", "schema.sql", "data.sql"],
  "notes": "Restaurar com session_replication_role=replica. Extensões e Database Webhooks precisam ser reativados manualmente no projeto de destino."
}
EOF

BASENAME="${PROJECT_NAME}-${TIER}-${TS}-${GITSHA}"
TARBALL="$WORK/${BASENAME}.tar.gz"
OUTFILE="$OUT_DIR/${BASENAME}.tar.gz.gpg"

echo ">> [4/5] Empacotando..."
tar -czf "$TARBALL" -C "$WORK" roles.sql schema.sql data.sql manifest.json

echo ">> [5/5] Criptografando (AES256)..."
gpg --batch --yes --pinentry-mode loopback \
  --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" \
  --symmetric --cipher-algo AES256 \
  -o "$OUTFILE" "$TARBALL"

SIZE="$(du -h "$OUTFILE" | cut -f1)"
echo ">> Backup pronto: $OUTFILE ($SIZE)"
# Última linha = caminho puro, para o workflow capturar
echo "$OUTFILE"
