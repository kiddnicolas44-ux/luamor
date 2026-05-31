-- Run this in your Supabase SQL editor

-- OWNERS
create table if not exists owners (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  api_key        text unique not null,
  plan           text not null default 'starter',
  obfs_used      int default 0,
  obfs_reset_at  timestamptz default now(),
  created_at     timestamptz default now(),
  expires_at     bigint
);

-- PROJECTS
create table if not exists projects (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references owners(id) on delete cascade,
  name               text not null,
  ffa                boolean default false,
  active             boolean default true,
  raw_script         text,
  obfuscated_script  text,
  script_version     text default '0001',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- KEYS
create table if not exists keys (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade,
  key_string        text unique not null,
  hwid              text,
  discord_id        text,
  note              text,
  active            boolean default true,
  key_days          int,
  expires_at        bigint,
  total_executions  int default 0,
  last_exec         timestamptz,
  last_hwid_reset   timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- BOT CONFIGS
create table if not exists bot_configs (
  guild_id            text primary key,
  api_key             text,
  project_id          uuid,
  project_name        text,
  buyer_role_id       text,
  manager_role_id     text,
  email               text,
  plan                text,
  hwid_reset_cooldown int default 0,
  updated_at          timestamptz default now()
);

-- INDEXES
create index if not exists idx_keys_key_string   on keys(key_string);
create index if not exists idx_keys_discord_id   on keys(discord_id);
create index if not exists idx_keys_project_id   on keys(project_id);
create index if not exists idx_keys_active        on keys(active);
create index if not exists idx_projects_owner_id  on projects(owner_id);

-- Disable RLS for service role (Supabase default)
alter table owners      disable row level security;
alter table projects    disable row level security;
alter table keys        disable row level security;
alter table bot_configs disable row level security;

-- ── CREATE YOUR FIRST OWNER ACCOUNT ──────────────────────────────────────────
-- Replace the values below with your real email and a strong random API key
-- Then login to the dashboard at https://your-app.up.railway.app

-- insert into owners (email, api_key, plan)
-- values ('you@email.com', 'your-64-char-api-key-here', 'elite');
