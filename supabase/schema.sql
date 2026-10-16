-- PocketAFK Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create accounts table
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  username text not null,
  auth_type text default 'microsoft' check (auth_type in ('microsoft', 'offline')),
  server_host text not null,
  server_port integer default 25565,
  server_version text default 'auto',
  
  -- Bot settings
  auto_reconnect boolean default true,
  anti_afk jsonb default '{"enabled": true, "interval": 10, "swing": true, "rotate": true, "sneak": true}'::jsonb,
  
  -- Survival settings (Disabled by default as requested)
  survival jsonb default '{"autoEat": false, "autoTotem": false}'::jsonb,
  
  -- Mob Farm settings
  mob_farm jsonb default '{"enabled": false, "targetRange": 3.5, "attackCooldownMs": 650}'::jsonb,
  
  -- Physics & Server compatibility settings (Enabled by default for proper combat & anti-cheat compliance)
  settings jsonb default '{"physics": true, "acceptResourcePacks": true, "muteErrors": false, "autoDisconnectOnBan": false}'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.accounts enable row level security;

-- 3. RLS Policies: users can only manage their own bot accounts
create policy "Users can select own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- 4. User settings table (stores daemon URL and auth token per user)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daemon_url text default 'ws://localhost:8080',
  daemon_token text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.user_settings enable row level security;

create policy "Users can manage own settings"
  on public.user_settings for all
  using (auth.uid() = user_id);
