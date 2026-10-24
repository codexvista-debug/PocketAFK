-- Persistent Termux uptime and disconnect history. Direct table access stays
-- blocked by RLS; the RPC functions require the user's daemon token.
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
