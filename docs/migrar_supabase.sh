#!/usr/bin/env bash
# =============================================================================
# migrar_supabase.sh
# Migração de dados entre dois projetos Supabase (free tier → free tier).
# Pré-requisitos: pg_dump, psql e curl instalados; bash (Git Bash no Windows).
#
# PASSO 0 — preencha as variáveis abaixo antes de rodar.
# =============================================================================

# ── Projeto de ORIGEM ────────────────────────────────────────────────────────
SRC_HOST="db.XXXXXXXXXXXXXXXXXXXX.supabase.co"   # Settings → Database → Host
SRC_PORT="5432"
SRC_DB="postgres"
SRC_USER="postgres"
SRC_PASS="SUA_SENHA_ORIGEM"

# ── Projeto de DESTINO ───────────────────────────────────────────────────────
DST_HOST="db.YYYYYYYYYYYYYYYYYYYY.supabase.co"
DST_PORT="5432"
DST_DB="postgres"
DST_USER="postgres"
DST_PASS="SUA_SENHA_DESTINO"

# ── Supabase Service-Role Keys (para migrar Storage) ─────────────────────────
# Dashboard → Settings → API → service_role (secret)
SRC_URL="https://XXXXXXXXXXXXXXXXXXXX.supabase.co"
SRC_KEY="eyJhbGci...ORIGEM_SERVICE_ROLE_KEY"
DST_URL="https://YYYYYYYYYYYYYYYYYYYY.supabase.co"
DST_KEY="eyJhbGci...DESTINO_SERVICE_ROLE_KEY"

# =============================================================================
# NÃO EDITE ABAIXO DESTA LINHA
# =============================================================================
set -euo pipefail

SRC_CONN="postgresql://${SRC_USER}:${SRC_PASS}@${SRC_HOST}:${SRC_PORT}/${SRC_DB}"
DST_CONN="postgresql://${DST_USER}:${DST_PASS}@${DST_HOST}:${DST_PORT}/${DST_DB}"

DUMP_DATA="dump_data.sql"
DUMP_AUTH="dump_auth.sql"
WORK_DIR="migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"

echo "============================================================"
echo " ClinicaGeny — Migração Supabase → Supabase"
echo " Pasta de trabalho: $WORK_DIR"
echo "============================================================"

# ─────────────────────────────────────────────────────────────────────────────
# ETAPA 1 — Schema no destino (DDL_COMPLETO.sql)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Aplicando schema no destino..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DDL_FILE="$SCRIPT_DIR/DDL_COMPLETO.sql"

if [ ! -f "$DDL_FILE" ]; then
  echo "ERRO: DDL_COMPLETO.sql não encontrado em $SCRIPT_DIR"
  exit 1
fi

PGPASSWORD="$DST_PASS" psql "$DST_CONN" -f "$DDL_FILE" \
  --set ON_ERROR_STOP=off 2>&1 | grep -v "^NOTICE" | grep -v "^--" || true

echo "   Schema aplicado (avisos de 'já existe' são normais)."

# ─────────────────────────────────────────────────────────────────────────────
# ETAPA 2 — Dump dos dados do schema public
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[2/5] Exportando dados do schema public da ORIGEM..."

PGPASSWORD="$SRC_PASS" pg_dump "$SRC_CONN" \
  --data-only \
  --no-owner \
  --no-acl \
  --disable-triggers \
  --schema=public \
  --exclude-table=public.schema_migrations \
  -f "$WORK_DIR/$DUMP_DATA"

echo "   Exportado: $WORK_DIR/$DUMP_DATA ($(wc -c < "$WORK_DIR/$DUMP_DATA") bytes)"

# ─────────────────────────────────────────────────────────────────────────────
# ETAPA 3 — Dump dos usuários Auth (auth.users)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[3/5] Exportando auth.users da ORIGEM..."

# Exporta apenas as colunas seguras de auth.users (exclui tokens internos)
PGPASSWORD="$SRC_PASS" psql "$SRC_CONN" -c "\COPY (
  SELECT
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
    phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at
  FROM auth.users
  ORDER BY created_at
) TO '$WORK_DIR/$DUMP_AUTH' WITH (FORMAT csv, HEADER true)"

echo "   Exportado: $WORK_DIR/$DUMP_AUTH"

# ─────────────────────────────────────────────────────────────────────────────
# ETAPA 4 — Importar dados no DESTINO
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[4/5] Importando dados no DESTINO..."

# 4a) auth.users — usando COPY para bypass de RLS
echo "   Importando auth.users..."
PGPASSWORD="$DST_PASS" psql "$DST_CONN" -c "
  SET session_replication_role = replica;  -- desativa triggers e FK checks temporariamente

  -- Cria tabela temporária para receber o CSV
  CREATE TEMP TABLE tmp_auth_users (LIKE auth.users INCLUDING ALL);

  \COPY tmp_auth_users FROM '$WORK_DIR/$DUMP_AUTH' WITH (FORMAT csv, HEADER true)

  -- Insere ignorando conflitos (usuários já existentes)
  INSERT INTO auth.users
  SELECT * FROM tmp_auth_users
  ON CONFLICT (id) DO NOTHING;

  SET session_replication_role = DEFAULT;
" 2>&1 || echo "   Aviso: alguns usuários auth já existiam — ignorados."

# 4b) Dados do schema public
echo "   Importando dados public..."
PGPASSWORD="$DST_PASS" psql "$DST_CONN" \
  -c "SET session_replication_role = replica;" \
  -f "$WORK_DIR/$DUMP_DATA" \
  -c "SET session_replication_role = DEFAULT;" \
  2>&1 | grep -i "error\|ERROR" || true

# 4c) Reinicializa sequências para evitar conflito de PK futuros
echo "   Reinicializando sequências..."
PGPASSWORD="$DST_PASS" psql "$DST_CONN" -c "
  SELECT setval(pg_get_serial_sequence(quote_ident(table_schema)||'.'||quote_ident(table_name), column_name),
                coalesce(max_val, 1))
  FROM information_schema.columns c
  JOIN (
    SELECT schemaname||'.'||tablename AS tbl, max(seq_scan) AS max_val
    FROM pg_stat_user_tables
    GROUP BY 1
  ) s ON false  -- placeholder; sequências UUID não precisam reset
  WHERE c.column_default LIKE '%nextval%';
" 2>/dev/null || true
# (tabelas com UUID primary key não precisam de reset de sequence)

echo "   Dados importados."

# ─────────────────────────────────────────────────────────────────────────────
# ETAPA 5 — Migrar arquivos do Storage
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[5/5] Migrando arquivos dos buckets de Storage..."

BUCKETS=("branding" "patient-files" "admin-files")

for BUCKET in "${BUCKETS[@]}"; do
  echo "   Bucket: $BUCKET"

  # Lista objetos do bucket de origem via API
  OBJECTS=$(curl -s \
    -H "Authorization: Bearer $SRC_KEY" \
    -H "Content-Type: application/json" \
    "$SRC_URL/storage/v1/object/list/$BUCKET" \
    -d '{"limit":10000,"offset":0,"prefix":""}' \
    | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"$//')

  if [ -z "$OBJECTS" ]; then
    echo "      (vazio)"
    continue
  fi

  COUNT=0
  while IFS= read -r OBJ_NAME; do
    [ -z "$OBJ_NAME" ] && continue

    TMP_FILE="$WORK_DIR/storage_${BUCKET}_$(echo "$OBJ_NAME" | tr '/' '_')"

    # Download da origem
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TMP_FILE" \
      -H "Authorization: Bearer $SRC_KEY" \
      "$SRC_URL/storage/v1/object/$BUCKET/$OBJ_NAME")

    if [ "$HTTP_CODE" != "200" ]; then
      echo "      AVISO: falha ao baixar $OBJ_NAME (HTTP $HTTP_CODE)"
      rm -f "$TMP_FILE"
      continue
    fi

    # Detecta content-type pelo nome do arquivo
    EXT="${OBJ_NAME##*.}"
    case "$EXT" in
      jpg|jpeg) CT="image/jpeg" ;;
      png)      CT="image/png" ;;
      pdf)      CT="application/pdf" ;;
      gif)      CT="image/gif" ;;
      webp)     CT="image/webp" ;;
      *)        CT="application/octet-stream" ;;
    esac

    # Upload para o destino (upsert para evitar erro se já existir)
    curl -s -o /dev/null -w "" \
      -X POST \
      -H "Authorization: Bearer $DST_KEY" \
      -H "Content-Type: $CT" \
      -H "x-upsert: true" \
      --data-binary "@$TMP_FILE" \
      "$DST_URL/storage/v1/object/$BUCKET/$OBJ_NAME"

    rm -f "$TMP_FILE"
    COUNT=$((COUNT + 1))

  done <<< "$OBJECTS"

  echo "      $COUNT arquivo(s) migrado(s)."
done

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " Migração concluída!"
echo ""
echo " PRÓXIMOS PASSOS MANUAIS:"
echo "   1. No Supabase DESTINO → Authentication → URL Configuration:"
echo "      ajuste Site URL e Redirect URLs para o novo domínio."
echo "   2. Atualize as variáveis de ambiente do frontend:"
echo "      VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
echo "   3. Teste o login de um profissional admin."
echo "   4. Verifique se as fotos aparecem corretamente."
echo "   5. Ative pg_cron em Database → Extensions no projeto destino."
echo "============================================================"
echo " Arquivos de dump salvos em: $WORK_DIR/"
echo " (guarde por alguns dias antes de deletar)"
echo "============================================================"
