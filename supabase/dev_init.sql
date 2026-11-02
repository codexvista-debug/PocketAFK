-- ==============================================================================
--    PocketAFK - Complete Dev Database Setup Script
--    Run this once in the Dev-PocketAFK SQL Editor
-- ==============================================================================

-- 1. Users table (username + password auth + rank)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  rank text default 'iron',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tunnels / Device Pairing table (links phone Termux tunnel to username)
create table if not exists public.tunnels (
  username text primary key,
  daemon_url text not null,
  daemon_token text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Minecraft Bot Accounts (linked directly to the username)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  bot_name text not null,
  auth_type text default 'microsoft' check (auth_type in ('microsoft', 'offline')),
  server_host text not null,
  server_port integer default 25565,
  server_version text default 'auto',
  
  -- Bot settings
  auto_reconnect boolean default true,
  anti_afk jsonb default '{"enabled": true, "interval": 10, "swing": true, "rotate": true, "sneak": true}'::jsonb,
  survival jsonb default '{"autoEat": false, "autoTotem": false}'::jsonb,
  mob_farm jsonb default '{"enabled": false, "targetRange": 3.5, "attackCooldownMs": 650}'::jsonb,
  settings jsonb default '{"physics": true, "acceptResourcePacks": true, "muteErrors": false, "autoDisconnectOnBan": false}'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Enable RLS and Open Policies for public tables
alter table public.users enable row level security;
alter table public.tunnels enable row level security;
alter table public.accounts enable row level security;

create policy "Allow all read/write for users" on public.users for all using (true) with check (true);
create policy "Allow all read/write for tunnels" on public.tunnels for all using (true) with check (true);
create policy "Allow all read/write for accounts" on public.accounts for all using (true) with check (true);

-- 5. Persistent Termux Uptime & Status
create table if not exists public.daemon_status (
  username text primary key,
  is_online boolean not null default false,
  daemon_started_at timestamptz,
  last_connected_at timestamptz,
  last_heartbeat_at timestamptz,
  last_disconnected_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now())
);
alter table public.daemon_status enable row level security;
revoke all on table public.daemon_status from public, anon, authenticated;

create or replace function public.write_daemon_status(
  p_username text,
  p_daemon_token text,
  p_is_online boolean,
  p_daemon_started_at timestamptz default null,
  p_last_heartbeat_at timestamptz default null,
  p_last_disconnected_at timestamptz default null
)
returns setof public.daemon_status
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = lower(p_username) and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon status update' using errcode = '42501';
  end if;

  insert into public.daemon_status as current_status (
    username, is_online, daemon_started_at, last_connected_at,
    last_heartbeat_at, last_disconnected_at, updated_at
  ) values (
    lower(p_username), p_is_online,
    coalesce(p_daemon_started_at, case when p_is_online then now() else null end),
    case when p_is_online then now() else null end,
    coalesce(p_last_heartbeat_at, case when p_is_online then now() else null end),
    p_last_disconnected_at, now()
  )
  on conflict (username) do update set
    is_online = excluded.is_online,
    daemon_started_at = coalesce(p_daemon_started_at, current_status.daemon_started_at),
    last_connected_at = case
      when excluded.is_online and not current_status.is_online then now()
      else current_status.last_connected_at
    end,
    last_heartbeat_at = coalesce(p_last_heartbeat_at, current_status.last_heartbeat_at),
    last_disconnected_at = coalesce(p_last_disconnected_at, current_status.last_disconnected_at),
    updated_at = now();

  return query select * from public.daemon_status where username = lower(p_username);
end;
$$;

create or replace function public.read_daemon_status(p_username text, p_daemon_token text)
returns setof public.daemon_status
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = lower(p_username) and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon status read' using errcode = '42501';
  end if;
  return query select * from public.daemon_status where username = lower(p_username);
end;
$$;

revoke all on function public.write_daemon_status(text, text, boolean, timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.read_daemon_status(text, text) from public;
grant execute on function public.write_daemon_status(text, text, boolean, timestamptz, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.read_daemon_status(text, text) to anon, authenticated;

-- 6. Durable Session History & Bot intervals
create table if not exists public.daemon_sessions (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  daemon_started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (username, daemon_started_at)
);

create index if not exists daemon_sessions_user_started_idx
  on public.daemon_sessions (username, daemon_started_at desc);

create table if not exists public.daemon_session_bots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.daemon_sessions(id) on delete cascade,
  bot_id text not null,
  account_name text not null,
  server_host text not null,
  connected_at timestamptz not null,
  disconnected_at timestamptz,
  connect_event_id text unique,
  disconnect_event_id text unique
);

create index if not exists daemon_session_bots_session_idx
  on public.daemon_session_bots (session_id, connected_at);

alter table public.daemon_sessions enable row level security;
alter table public.daemon_session_bots enable row level security;
revoke all on table public.daemon_sessions, public.daemon_session_bots from public, anon, authenticated;

create or replace function public.begin_daemon_session(
  p_username text,
  p_daemon_token text,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(p_username));
  v_id uuid;
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = v_username and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon session update' using errcode = '42501';
  end if;

  update public.daemon_sessions
  set ended_at = coalesce(ended_at, p_started_at)
  where lower(username) = v_username and ended_at is null;

  insert into public.daemon_sessions (username, daemon_started_at)
  values (v_username, coalesce(p_started_at, now()))
  on conflict (username, daemon_started_at) do update set username = excluded.username
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_daemon_session(
  p_username text,
  p_daemon_token text,
  p_ended_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(p_username));
  v_session_id uuid;
  v_ended_at timestamptz := coalesce(p_ended_at, now());
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = v_username and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon session update' using errcode = '42501';
  end if;

  select id into v_session_id from public.daemon_sessions
  where lower(username) = v_username and ended_at is null
  order by daemon_started_at desc limit 1;
  if v_session_id is not null then
    update public.daemon_session_bots
    set disconnected_at = coalesce(disconnected_at, v_ended_at)
    where session_id = v_session_id and disconnected_at is null;
    update public.daemon_sessions set ended_at = v_ended_at where id = v_session_id;
  end if;
end;
$$;

create or replace function public.record_daemon_bot_event(
  p_username text,
  p_daemon_token text,
  p_event_id text,
  p_event_type text,
  p_bot_id text,
  p_account_name text,
  p_server_host text,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(p_username));
  v_session_id uuid;
  v_at timestamptz := coalesce(p_occurred_at, now());
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = v_username and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon bot event' using errcode = '42501';
  end if;
  if p_event_id is null or p_event_id = '' or p_bot_id is null or p_bot_id = '' then
    return;
  end if;

  select id into v_session_id from public.daemon_sessions
  where lower(username) = v_username and ended_at is null
  order by daemon_started_at desc limit 1;
  if v_session_id is null then return; end if;

  if p_event_type = 'spawn' then
    if not exists (
      select 1 from public.daemon_session_bots
      where session_id = v_session_id and bot_id = p_bot_id and disconnected_at is null
    ) then
      insert into public.daemon_session_bots (
        session_id, bot_id, account_name, server_host, connected_at, connect_event_id
      ) values (
        v_session_id, p_bot_id, coalesce(nullif(p_account_name, ''), 'Minecraft account'),
        coalesce(nullif(p_server_host, ''), 'Unknown server'), v_at, p_event_id
      ) on conflict (connect_event_id) do nothing;
    end if;
  elsif p_event_type = 'disconnect' then
    update public.daemon_session_bots
    set disconnected_at = v_at, disconnect_event_id = p_event_id
    where id = (
      select id from public.daemon_session_bots
      where session_id = v_session_id and bot_id = p_bot_id and disconnected_at is null
      order by connected_at desc limit 1
    );
  end if;
end;
$$;

create or replace function public.read_daemon_sessions(p_username text, p_daemon_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(p_username));
  v_result jsonb;
begin
  if p_daemon_token is null or p_daemon_token = '' or not exists (
    select 1 from public.tunnels t
    where lower(t.username) = v_username and t.daemon_token = p_daemon_token
  ) then
    raise exception 'Unauthorized daemon session read' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(session_json order by started_at desc), '[]'::jsonb)
  into v_result
  from (
    select s.daemon_started_at as started_at,
      jsonb_build_object(
        'id', s.id,
        'startedAt', s.daemon_started_at,
        'endedAt', s.ended_at,
        'bots', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id,
            'botId', b.bot_id,
            'accountName', b.account_name,
            'serverHost', b.server_host,
            'connectedAt', b.connected_at,
            'disconnectedAt', b.disconnected_at
          ) order by b.connected_at)
          from public.daemon_session_bots b where b.session_id = s.id
        ), '[]'::jsonb)
      ) as session_json
    from public.daemon_sessions s
    where lower(s.username) = v_username
    order by s.daemon_started_at desc
    limit 5
  ) recent;
  return v_result;
end;
$$;

revoke all on function public.begin_daemon_session(text, text, timestamptz) from public, authenticated;
revoke all on function public.finish_daemon_session(text, text, timestamptz) from public, authenticated;
revoke all on function public.record_daemon_bot_event(text, text, text, text, text, text, text, timestamptz) from public, authenticated;
revoke all on function public.read_daemon_sessions(text, text) from public, authenticated;
grant execute on function public.begin_daemon_session(text, text, timestamptz) to anon;
grant execute on function public.finish_daemon_session(text, text, timestamptz) to anon;
grant execute on function public.record_daemon_bot_event(text, text, text, text, text, text, text, timestamptz) to anon;
grant execute on function public.read_daemon_sessions(text, text) to anon;
