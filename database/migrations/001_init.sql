-- FILE: database/migrations/001_init.sql
-- PURPOSE: Creates the complete FLASHLIVE PostgreSQL schema.
-- WHY THIS FILE EXISTS: Establishes normalized persistence for users, GitHub
-- connections, projects, deployments, logs, workers, slots and recovery events.
-- HOW IT WORKS: Uses UUID identifiers, foreign keys, check constraints, partial
-- unique indexes and timezone-aware timestamps for queue correctness.
-- USED BY: database/scripts/migrate.mjs during local and production setup.
-- SECURITY: Stores only encrypted GitHub tokens and encrypted project env vars;
-- public APIs must never select secret columns.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_key ON users(firebase_uid);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users(LOWER(email));

CREATE TABLE IF NOT EXISTS github_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_user_id BIGINT NOT NULL,
  github_login TEXT NOT NULL,
  github_email TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS github_accounts_user_id_key ON github_accounts(user_id);
CREATE INDEX IF NOT EXISTS github_accounts_github_user_id_idx ON github_accounts(github_user_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  repository_id BIGINT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  commit_sha TEXT,
  framework TEXT NOT NULL DEFAULT 'react-vite' CHECK (framework = 'react-vite'),
  build_command TEXT NOT NULL DEFAULT 'npm run build',
  install_command TEXT NOT NULL DEFAULT 'npm ci',
  output_directory TEXT NOT NULL DEFAULT 'dist',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_deployment_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_repository_idx ON projects(repository_full_name);
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_repo_branch_name_key
  ON projects(user_id, repository_full_name, branch, name);

CREATE TABLE IF NOT EXISTS project_env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  env_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_env_vars_project_key_key ON project_env_vars(project_id, env_key);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'deployed', 'failed', 'cancelled')),
  worker_id UUID,
  slot_id UUID,
  lease_token UUID,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  commit_sha TEXT,
  branch TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  error_message TEXT,
  live_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  cancel_requested_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  build_duration_ms BIGINT CHECK (build_duration_ms IS NULL OR build_duration_ms >= 0),
  queue_duration_ms BIGINT CHECK (queue_duration_ms IS NULL OR queue_duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS deployments_status_created_idx ON deployments(status, created_at, id);
CREATE INDEX IF NOT EXISTS deployments_user_created_idx ON deployments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deployments_project_created_idx ON deployments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deployments_worker_idx ON deployments(worker_id) WHERE worker_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS deployments_one_building_per_worker
  ON deployments(worker_id) WHERE status = 'building' AND worker_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS deployments_one_building_per_user
  ON deployments(user_id) WHERE status = 'building';
CREATE UNIQUE INDEX IF NOT EXISTS deployments_one_building_per_slot
  ON deployments(slot_id) WHERE status = 'building' AND slot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS deployment_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deployment_id, sequence)
);

CREATE INDEX IF NOT EXISTS deployment_logs_deployment_sequence_idx ON deployment_logs(deployment_id, sequence);

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'stale')),
  hostname TEXT,
  version TEXT,
  started_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  active_deployment_id UUID,
  active_slot_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workers_name_key ON workers(name);

CREATE TABLE IF NOT EXISTS worker_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_index INTEGER NOT NULL UNIQUE CHECK (slot_index >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'stale')),
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  lease_token UUID,
  claimed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_slots_one_claimed_per_worker
  ON worker_slots(worker_id) WHERE status = 'claimed' AND worker_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS worker_slots_one_claimed_per_deployment
  ON worker_slots(deployment_id) WHERE status = 'claimed' AND deployment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS worker_slots_available_idx ON worker_slots(status, slot_index) WHERE status = 'available';

CREATE TABLE IF NOT EXISTS recovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID,
  deployment_id UUID,
  slot_id UUID,
  reason TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recovery_events_created_idx ON recovery_events(created_at DESC);
CREATE INDEX IF NOT EXISTS recovery_events_deployment_idx ON recovery_events(deployment_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states(expires_at);
