// =============================================================================
// migrar_supabase.mjs  —  Migração ClinicaGeny: Supabase → Supabase
// Usa apenas service_role key (sem senha Postgres).
//
// COMO RODAR:
//   1. Preencha as 4 variáveis abaixo.
//   2. node docs/migrar_supabase.mjs
//
// PRÉ-REQUISITO: Node 18+ (já instalado pelo projeto React/Vite)
//   Se precisar instalar o cliente Supabase globalmente:
//   npm install @supabase/supabase-js   (já está em app/node_modules)
//   ou rode de dentro da pasta app/:  node ../docs/migrar_supabase.mjs
// =============================================================================

// ── Preencha aqui (Dashboard → Settings → API) ───────────────────────────────
const SRC_URL = "https://XXXXXXXXXXXXXXXXXXXX.supabase.co";
const SRC_KEY = "eyJhbGci...ORIGEM_SERVICE_ROLE";   // service_role (secret)

const DST_URL = "https://YYYYYYYYYYYYYYYYYYYY.supabase.co";
const DST_KEY = "eyJhbGci...DESTINO_SERVICE_ROLE";  // service_role (secret)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

// =============================================================================
// ORDEM DE INSERÇÃO (respeita chaves estrangeiras)
// =============================================================================
const TABLES = [
  // ── núcleo ─────────────────────────────────────────────────────────────────
  "clinics",
  "professionals",
  "patients",

  // ── configurações ──────────────────────────────────────────────────────────
  "integration_settings",
  "roles",
  "servico_tipos",
  "vacina_tipos",
  "administration_routes",
  "suppliers",
  "active_ingredients",
  "procedure_types",
  "exam_types",
  "expense_types",
  "treatment_text_snippets",
  "formulations",

  // ── agenda ─────────────────────────────────────────────────────────────────
  "appointments",
  "professional_availability",
  "professional_blocks",

  // ── prontuário ─────────────────────────────────────────────────────────────
  "document_templates",
  "anamnesis",
  "assessments",
  "perimetry",
  "body_measurements",
  "treatment_plans",
  "supplementations",
  "formulation_prescriptions",
  "lab_orders",
  "lab_results",
  "clinical_photos",

  // ── procedimentos e financeiro ─────────────────────────────────────────────
  "quotes",
  "procedures_log",
  "payments",
  "shared_documents",

  // ── documentos emitidos ────────────────────────────────────────────────────
  "document_instances",
  "patient_guidance",

  // ── notificações ──────────────────────────────────────────────────────────
  "push_subscriptions",
  "notifications",

  // ── financeiro operacional ─────────────────────────────────────────────────
  "expenses",
  "financial_movements",

  // ── área admin ─────────────────────────────────────────────────────────────
  "admin_counters",
  "admin_records",

  // ── outros ────────────────────────────────────────────────────────────────
  "lgpd_consent_logs",
  "patient_reports",
  "stock_movements",
];

const BUCKETS = ["branding", "patient-files", "admin-files"];
const PAGE    = 1000;  // linhas por requisição (limite do PostgREST free tier)

// =============================================================================
// HELPERS
// =============================================================================
function log(msg)  { console.log(`  ${msg}`); }
function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function ok(msg)   { console.log(`  ✓  ${msg}`); }

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await src
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Leitura ${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function upsertAll(table, rows) {
  for (let i = 0; i < rows.length; i += PAGE) {
    const chunk = rows.slice(i, i + PAGE);
    const { error } = await dst
      .from(table)
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Escrita ${table}: ${error.message}`);
  }
}

// =============================================================================
// ETAPA 1 — Dados das tabelas (public schema)
// =============================================================================
async function migrateTables() {
  console.log("\n[1/3] Tabelas do schema public");
  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`      ${table.padEnd(35)} `);
    try {
      const rows = await fetchAll(table);
      if (rows.length === 0) {
        console.log("(vazia)");
        continue;
      }
      await upsertAll(table, rows);
      console.log(`${rows.length} linha(s)`);
      totalRows += rows.length;
    } catch (err) {
      console.log("");
      warn(`${err.message}`);
    }
  }

  ok(`Total: ${totalRows} linhas migradas.`);
}

// =============================================================================
// ETAPA 2 — Usuários Auth
//   • Lista via Admin API da origem.
//   • Cria na origem via Admin API do destino.
//   • SENHA: não é possível copiar o hash — usuários receberão uma senha
//     temporária '!Trocar123' e precisarão usar "Esqueci minha senha"
//     no primeiro acesso. Customize TEMP_PASS se quiser.
// =============================================================================
const TEMP_PASS = "!Trocar123";

async function migrateAuth() {
  console.log("\n[2/3] Usuários Auth");

  // Listar todos os usuários da origem
  let page = 1;
  const users = [];
  while (true) {
    const { data, error } = await src.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { warn(`Listar usuários: ${error.message}`); break; }
    if (!data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  log(`${users.length} usuário(s) encontrado(s).`);
  let criados = 0, ignorados = 0;

  for (const u of users) {
    const payload = {
      email:          u.email,
      phone:          u.phone || undefined,
      email_confirm:  true,
      phone_confirm:  true,
      password:       TEMP_PASS,
      user_metadata:  u.user_metadata  || {},
      app_metadata:   u.app_metadata   || {},
    };

    // Preserva o mesmo UUID (necessário para FKs em professionals/patients)
    // O Admin API do Supabase aceita `id` no body quando em service_role.
    const res = await fetch(`${DST_URL}/auth/v1/admin/users`, {
      method:  "POST",
      headers: {
        "apikey":        DST_KEY,
        "Authorization": `Bearer ${DST_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ ...payload, id: u.id }),
    });

    if (res.ok) {
      criados++;
    } else {
      const err = await res.json().catch(() => ({}));
      // "User already registered" é normal em re-execuções
      if (!JSON.stringify(err).includes("already")) {
        warn(`${u.email}: ${JSON.stringify(err)}`);
      }
      ignorados++;
    }
  }

  ok(`Criados: ${criados}  |  Já existiam: ${ignorados}`);
  if (criados > 0) {
    log(`Senha temporária definida: "${TEMP_PASS}"`);
    log(`Usuários devem usar "Esqueci minha senha" para redefinir.`);
  }
}

// =============================================================================
// ETAPA 3 — Storage (buckets)
// =============================================================================
async function migrateStorage() {
  console.log("\n[3/3] Storage (buckets)");

  for (const bucket of BUCKETS) {
    process.stdout.write(`      Bucket "${bucket}": `);

    // Lista todos os objetos (paginado)
    const allFiles = [];
    let offset = 0;
    while (true) {
      const { data, error } = await src.storage
        .from(bucket)
        .list("", { limit: 1000, offset, search: "" });
      if (error || !data?.length) break;
      allFiles.push(...data.filter(f => f.name && !f.name.endsWith("/")));
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Recursão em "pastas" (Storage retorna itens do nível raiz)
    const files = await listRecursive(src, bucket, "");

    if (!files.length) { console.log("(vazia)"); continue; }
    console.log(`${files.length} arquivo(s)...`);

    let ok_count = 0, err_count = 0;

    for (const path of files) {
      // Download da origem
      const { data: blob, error: dlErr } = await src.storage
        .from(bucket)
        .download(path);
      if (dlErr) { warn(`Download "${path}": ${dlErr.message}`); err_count++; continue; }

      // Upload para o destino (upsert)
      const { error: upErr } = await dst.storage
        .from(bucket)
        .upload(path, blob, { upsert: true });
      if (upErr && !upErr.message?.includes("already exists")) {
        warn(`Upload "${path}": ${upErr.message}`);
        err_count++;
      } else {
        ok_count++;
      }
    }

    log(`  "${bucket}": ${ok_count} migrado(s), ${err_count} erro(s).`);
  }
}

// Lista arquivos recursivamente em um bucket
async function listRecursive(client, bucket, prefix) {
  const { data, error } = await client.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const files = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.metadata) {
      // É um arquivo
      files.push(fullPath);
    } else {
      // É uma "pasta" — recursão
      const sub = await listRecursive(client, bucket, fullPath);
      files.push(...sub);
    }
  }
  return files;
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log("=".repeat(60));
  console.log(" ClinicaGeny — Migração Supabase → Supabase");
  console.log(`  Origem:  ${SRC_URL}`);
  console.log(`  Destino: ${DST_URL}`);
  console.log("=".repeat(60));

  const t0 = Date.now();

  // Verifica conectividade antes de começar
  const { error: pingErr } = await src.from("clinics").select("id").limit(1);
  if (pingErr) {
    console.error(`\nERRO: não foi possível conectar à ORIGEM.\n${pingErr.message}`);
    process.exit(1);
  }

  await migrateTables();
  await migrateAuth();
  await migrateStorage();

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(60));
  console.log(` Migração concluída em ${secs}s`);
  console.log("");
  console.log(" PRÓXIMOS PASSOS:");
  console.log("   1. Aplique DDL_COMPLETO.sql no destino (se ainda não fez).");
  console.log("   2. Auth → URL Configuration: ajuste Site URL e Redirect URLs.");
  console.log("   3. Atualize VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
  console.log("   4. Habilite pg_cron em Database → Extensions.");
  console.log(`   5. Avise os usuários para redefinir senha ("${TEMP_PASS}").`);
  console.log("=".repeat(60));
}

main().catch(err => { console.error("\nErro fatal:", err); process.exit(1); });
