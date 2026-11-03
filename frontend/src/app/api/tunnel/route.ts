import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { generateSecretCode, generateLegacySecretCode } from '@/lib/authUtils';
import { sharedUserTunnels } from '@/lib/tunnelStore';

const userTunnels = sharedUserTunnels;

export const dynamic = 'force-dynamic';

// The daemon wrapper checks the local process every 3 seconds and sends a
// cloud heartbeat every 15 seconds. Leave room for transient network delays,
// while bounding how long a forcibly stopped Termux process stays online.
const TUNNEL_TIMEOUT_MS = 90000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username')?.trim().toLowerCase() || 'default';

  // Check if non-default user exists in Supabase
  if (username !== 'default' && supabase) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .ilike('username', username)
        .maybeSingle();

      if (!userRow) {
        userTunnels.delete(username);
        return NextResponse.json({
          error: `User @${username} does not exist in PocketAFK.`,
          userNotFound: true,
          url: '',
          tunnel_url: '',
          token: '',
          isLive: false,
        }, { status: 404 });
      }
    } catch (e) {
      // ignore
    }
  }

  const cached = userTunnels.get(username);
  let storedTunnel: any = null;
  let storedDaemonStatus: any = null;
  let statusStorageAvailable = false;
  let forceLogout = false;
  let forceRefreshEpoch = 0;

  if (supabase) {
    try {
      const { data: tunnelRows } = await supabase
        .from('tunnels')
        .select('*')
        .ilike('username', username)
        .order('updated_at', { ascending: false })
        .limit(1);
      storedTunnel = Array.isArray(tunnelRows) && tunnelRows.length > 0 ? tunnelRows[0] : null;
      const daemonToken = storedTunnel?.daemon_token || cached?.token || '';
      if (daemonToken) {
        const { data, error } = await supabase.rpc('read_daemon_status', {
          p_username: username,
          p_daemon_token: daemonToken,
        });
        statusStorageAvailable = !error;
        storedDaemonStatus = Array.isArray(data) ? data[0] : data;
      }
      const { data: metaRows } = await supabase
        .from('accounts')
        .select('bot_name, settings')
        .eq('username', '__meta_system__');
      if (metaRows) {
        for (const row of metaRows) {
          if (row.bot_name === '__meta_force_logout__' && row.settings?.epoch && Date.now() - row.settings.epoch < 30000) {
            forceLogout = true;
          }
          if (row.bot_name === '__meta_force_refresh__' && row.settings?.epoch && Date.now() - row.settings.epoch < 30000) {
            forceRefreshEpoch = row.settings.epoch;
          }
        }
      }
    } catch {
      // Continue with the in-memory heartbeat cache if Supabase is unavailable.
    }
  }

  const now = Date.now();
  const cachedIsLive = Boolean(cached?.url && now - cached.updatedAt < TUNNEL_TIMEOUT_MS);
  const storedUpdatedAt = storedTunnel?.updated_at ? new Date(storedTunnel.updated_at).getTime() : 0;
  const storedIsLive = Boolean(storedTunnel?.daemon_url && storedUpdatedAt && now - storedUpdatedAt < TUNNEL_TIMEOUT_MS);
  const isLive = cachedIsLive || storedIsLive;

  let lastDisconnectedAt = storedDaemonStatus?.last_disconnected_at
    ? new Date(storedDaemonStatus.last_disconnected_at).getTime()
    : cached?.lastDisconnectedAt || null;
  let daemonStartedAt = storedDaemonStatus?.daemon_started_at
    ? new Date(storedDaemonStatus.daemon_started_at).getTime()
    : cached?.daemonStartedAt || null;

  if (storedDaemonStatus?.is_online && !isLive) {
    const lastHeartbeatAt = storedDaemonStatus.last_heartbeat_at
      ? new Date(storedDaemonStatus.last_heartbeat_at).getTime()
      : storedUpdatedAt || now;
    lastDisconnectedAt = lastHeartbeatAt;
    const daemonToken = storedTunnel?.daemon_token || cached?.token || '';
    if (daemonToken) {
      try {
        await supabase?.rpc('write_daemon_status', {
          p_username: username,
          p_daemon_token: daemonToken,
          p_is_online: false,
          p_last_disconnected_at: new Date(lastHeartbeatAt).toISOString(),
        });
        await supabase?.rpc('finish_daemon_session', {
          p_username: username,
          p_daemon_token: daemonToken,
          p_ended_at: new Date(lastHeartbeatAt).toISOString(),
        });
      } catch {
        // Uptime display still has the current request's inferred disconnect time.
      }
    }
  }

  // Resolve active tunnel by prioritizing the most recently updated source
  let url = '';
  let token = '';
  let updatedAt = 0;

  if (storedIsLive && cachedIsLive) {
    if (storedUpdatedAt >= cached!.updatedAt) {
      url = storedTunnel.daemon_url;
      token = storedTunnel.daemon_token || '';
      updatedAt = storedUpdatedAt;
    } else {
      url = cached!.url;
      token = cached!.token || '';
      updatedAt = cached!.updatedAt;
    }
  } else if (storedIsLive) {
    url = storedTunnel.daemon_url;
    token = storedTunnel.daemon_token || '';
    updatedAt = storedUpdatedAt;
  } else if (cachedIsLive) {
    url = cached!.url;
    token = cached!.token || '';
    updatedAt = cached!.updatedAt;
  }

  if (cachedIsLive && !daemonStartedAt) daemonStartedAt = cached?.daemonStartedAt || null;

  if (isLive && url) {
    userTunnels.set(username, {
      url,
      token,
      updatedAt,
      daemonStartedAt: storedDaemonStatus?.daemon_started_at ? new Date(storedDaemonStatus.daemon_started_at).getTime() : cached?.daemonStartedAt || (daemonStartedAt ?? undefined),
      lastDisconnectedAt,
    });

    return NextResponse.json({
      url,
      tunnel_url: url,
      token,
      updatedAt,
      isLive: true,
      daemonStartedAt,
      lastDisconnectedAt,
      statusStorageAvailable,
      forceLogout,
      forceRefreshEpoch,
    });
  }

  return NextResponse.json({
    url: '',
    tunnel_url: '',
    token: '',
    updatedAt,
    isLive: false,
    daemonStartedAt,
    lastDisconnectedAt,
    statusStorageAvailable,
    forceLogout,
    forceRefreshEpoch,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, url, token, action } = body;

    const cleanUsername = (typeof username === 'string' && username.trim()) 
      ? username.trim().toLowerCase() 
      : 'default';

    // Verify secret code for non-guest usernames to prevent unauthorized takeover
    if (cleanUsername !== 'default' && supabase) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('password_hash')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (!user) {
          userTunnels.delete(cleanUsername);
          return NextResponse.json({
            error: `Unauthorized: User @${cleanUsername} does not exist in PocketAFK.`
          }, { status: 404 });
        }

        if (user && user.password_hash) {
          const expectedSecret = generateSecretCode(cleanUsername, user.password_hash);
          const legacySecret = generateLegacySecretCode(user.password_hash);
          const providedSecret = typeof token === 'string' ? token.trim() : '';

          if (providedSecret !== expectedSecret && providedSecret !== legacySecret) {
            return NextResponse.json({
              error: `Unauthorized: Invalid daemon secret code for user @${cleanUsername}. Hijacking attempt blocked.`
            }, { status: 401 });
          }
        }
      } catch (err) {
        console.warn('Error verifying secret code against Supabase:', err);
      }
    }

    // 1. Handle Explicit Disconnect / Shutdown
    if (action === 'disconnect' || !url || (typeof url === 'string' && url.trim() === '')) {
      const disconnectedAt = Date.now();
      const cleanToken = typeof token === 'string' ? token.trim() : '';
      userTunnels.set(cleanUsername, {
        url: '',
        token: cleanToken,
        updatedAt: disconnectedAt,
        daemonStartedAt: userTunnels.get(cleanUsername)?.daemonStartedAt,
        lastDisconnectedAt: disconnectedAt,
      });

      if (supabase) {
        try {
          // Keep an offline tunnel record so the daemon token can authorize
          // reads of the persistent, RLS-protected daemon status row.
          await supabase.from('tunnels').upsert({
            username: cleanUsername,
            daemon_url: '',
            daemon_token: cleanToken,
            updated_at: new Date(disconnectedAt).toISOString(),
          });
          await supabase.rpc('write_daemon_status', {
            p_username: cleanUsername,
            p_daemon_token: cleanToken,
            p_is_online: false,
            p_last_disconnected_at: new Date(disconnectedAt).toISOString(),
          });
          await supabase.rpc('finish_daemon_session', {
            p_username: cleanUsername,
            p_daemon_token: cleanToken,
            p_ended_at: new Date(disconnectedAt).toISOString(),
          });

          // Automatically mark all connected bot accounts for this user as disconnected
          const { data: userAccs } = await supabase
            .from('accounts')
            .select('id, settings')
            .ilike('username', cleanUsername);

          if (userAccs && userAccs.length > 0) {
            for (const acc of userAccs) {
              const updatedSettings = {
                ...(acc.settings || {}),
                is_connected: false,
                connected_at: null,
              };
              await supabase
                .from('accounts')
                .update({
                  settings: updatedSettings,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', acc.id);
            }
          }
        } catch (e) {
          console.warn('Error clearing tunnel & accounts in Supabase:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Phone daemon tunnel disconnected and accounts marked offline for @${cleanUsername}`,
        lastDisconnectedAt: disconnectedAt,
      });
    }

    // 2. Handle Heartbeat or New Tunnel Connection
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('https://')) {
      cleanUrl = cleanUrl.replace('https://', 'wss://');
    }

// Verified user heartbeat automatically keeps active tunnel alive

    const previousRecord = userTunnels.get(cleanUsername);
    const registeredAt = Date.now();
    const record = {
      url: cleanUrl,
      token: typeof token === 'string' ? token.trim() : '',
      updatedAt: registeredAt,
      daemonStartedAt: action === 'heartbeat' ? previousRecord?.daemonStartedAt : registeredAt,
      lastDisconnectedAt: previousRecord?.lastDisconnectedAt || null,
    };

    userTunnels.set(cleanUsername, record);

    if (supabase) {
      try {
        // Clean wipe any older records (including case variants) so only clean lowercase username is active
        await supabase.from('tunnels').delete().ilike('username', cleanUsername);
        await supabase.from('tunnels').insert({
          username: cleanUsername,
          daemon_url: cleanUrl,
          daemon_token: record.token,
          updated_at: new Date().toISOString(),
        });

        await supabase.rpc('write_daemon_status', {
          p_username: cleanUsername,
          p_daemon_token: record.token,
          p_is_online: true,
          p_daemon_started_at: action === 'heartbeat' ? null : new Date(record.updatedAt).toISOString(),
          p_last_heartbeat_at: new Date(record.updatedAt).toISOString(),
        });
        if (action !== 'heartbeat') {
          await supabase.rpc('begin_daemon_session', {
            p_username: cleanUsername,
            p_daemon_token: record.token,
            p_started_at: new Date(record.updatedAt).toISOString(),
          });
        }
      } catch (e) {
        console.warn('Supabase tunnel registration error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: action === 'heartbeat' ? 'Heartbeat received' : `Tunnel paired for user @${cleanUsername}`,
      data: record,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
