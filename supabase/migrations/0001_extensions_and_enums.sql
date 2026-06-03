-- =============================================================================
-- 0001_extensions_and_enums.sql
-- Extensões e tipos enumerados (domínios) do sistema.
-- Instância única (Instituto Geny Freitas) — multiprofissional.
-- =============================================================================

-- Extensões -------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- e-mail/CPF case-insensitive
create extension if not exists "pg_trgm";     -- busca por nome (LIKE/ILIKE)

-- Schema auxiliar para funções internas --------------------------------------
create schema if not exists app;

-- Tipos enumerados ------------------------------------------------------------

-- Papel do membro da equipe
do $$ begin
  create type user_role as enum ('admin', 'profissional', 'recepcao');
exception when duplicate_object then null; end $$;

-- Tipo de documento no motor de documentos dinâmicos
do $$ begin
  create type document_type as enum ('termo', 'orientacao', 'ficha');
exception when duplicate_object then null; end $$;

-- Status de uma instância de documento (termo/orientação)
do $$ begin
  create type document_status as enum ('rascunho', 'pendente', 'lido', 'assinado', 'cancelado');
exception when duplicate_object then null; end $$;

-- Tipo de ficha de avaliação
do $$ begin
  create type assessment_type as enum ('dermato', 'capilar', 'corporal');
exception when duplicate_object then null; end $$;

-- Quem preencheu o registro (paciente no portal ou profissional)
do $$ begin
  create type fill_source as enum ('paciente', 'profissional');
exception when duplicate_object then null; end $$;

-- Status de agendamento
do $$ begin
  create type appointment_status as enum ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');
exception when duplicate_object then null; end $$;

-- Status de orçamento
do $$ begin
  create type quote_status as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');
exception when duplicate_object then null; end $$;

-- Forma de pagamento (PIX priorizado)
do $$ begin
  create type payment_method as enum ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'outro');
exception when duplicate_object then null; end $$;

-- Status de pagamento
do $$ begin
  create type payment_status as enum ('pendente', 'pago', 'estornado', 'cancelado');
exception when duplicate_object then null; end $$;

-- Tipo de movimentação de estoque
do $$ begin
  create type stock_movement_type as enum ('entrada', 'saida_venda', 'saida_uso', 'ajuste', 'perda');
exception when duplicate_object then null; end $$;

-- Canal de notificação
do $$ begin
  create type notification_channel as enum ('push', 'whatsapp', 'email', 'in_app');
exception when duplicate_object then null; end $$;

-- Status de notificação
do $$ begin
  create type notification_status as enum ('pendente', 'enviado', 'lido', 'falhou', 'cancelado');
exception when duplicate_object then null; end $$;
