import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { RANKS, UserRank, getRankConfig } from '@/lib/ranks';
import { hashPassword, generateSecretCode, USERNAME_REGEX } from '@/lib/authUtils';

import { sharedUserTunnels } from '@/lib/tunnelStore';
import { getRegistrationsPaused, setRegistrationsPaused } from '@/lib/systemConfig';

export const dynamic = 'force-dynamic';

interface UserSummaryItem {
  id: string;
  username: string;
  rank: UserRank;
  accountCount: number;
  connectedCount: number;
  secretCode?: string;
  createdAt: string;
  tunnelUrl?: string;
  isTunnelActive?: boolean;
}

interface AccountItem {
  id: string;
  owner: string;
  ign: string;
  serverHost: string;
  serverPort: number;
  isConnected: boolean;
  connectedAt?: number;
  updatedAt?: string;
  createdAt?: string;
  settings?: any;
  daemonUrl?: string;
  registeredTunnel?: string;
  legitimacy: {
    status: 'legit' | 'leak' | 'unverified' | 'offline';
    badge: string;
    description: string;
    isLegit: boolean;
  };
}

interface AdminTunnelItem {
  username: string;
  url: string;
  updatedAt: number;
  isRecent: boolean;
  activeBots: number;
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    // 1. Fetch all users
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersErr) {
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    // 2. Fetch all accounts
    const { data: allAccounts, error: accsErr } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (accsErr) {
      return NextResponse.json({ error: accsErr.message }, { status: 500 });
    }

    // 3. Fetch all registered tunnels from Supabase
    const { data: allTunnels } = await supabase
      .from('tunnels')
      .select('*')
      .order('updated_at', { ascending: false });

    const tunnelMap = new Map<string, { url: string; token: string; updatedAt: number }>();

    (allTunnels || []).forEach((t: any) => {
      const u = (t.username || '').toLowerCase().trim();
      if (u && t.daemon_url) {
        tunnelMap.set(u, {
          url: t.daemon_url,
          token: t.daemon_token || '',
          updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : 0,
        });
      }
    });

    // Merge in-memory live cache (more up to date)
    sharedUserTunnels.forEach((val, u) => {
      const lower = u.toLowerCase().trim();
      const existing = tunnelMap.get(lower);
      if (!existing || val.updatedAt > existing.updatedAt) {
        tunnelMap.set(lower, val);
      }
    });

    // 4. Separate metadata rows from real Minecraft accounts & verify legitimacy
    const realAccounts: AccountItem[] = [];

    (allAccounts || []).forEach((row) => {
      const lowerOwner = (row.username || '').toLowerCase().trim();
      const botName = (row.bot_name || '').trim();

      if (!botName.startsWith('__')) {
        const userTunnel = tunnelMap.get(lowerOwner);
        // Authoritative liveness: Phone daemon must have sent heartbeat within 65 seconds
        const isTunnelLive = Boolean(userTunnel?.url && Date.now() - userTunnel.updatedAt < 65000);

        // A bot CANNOT be online if its phone daemon is dead/offline
        const rawConnected = Boolean(row.settings?.is_connected);
        const isConnected = rawConnected && isTunnelLive;

        const activeDaemonUrl = (row.settings?.daemon_url || '').trim() || (isConnected ? userTunnel?.url || '' : '');

        let legitimacy: AccountItem['legitimacy'];

        if (!isConnected) {
          legitimacy = {
            status: 'offline',
            badge: 'Standby / Offline',
            description: userTunnel?.url
              ? isTunnelLive
                ? `Phone daemon live on ${userTunnel.url} (Bot offline)`
                : `Phone daemon offline (Last heartbeat ${Math.max(1, Math.round((Date.now() - userTunnel.updatedAt) / 60000))}m ago)`
              : 'No phone daemon registered for this user',
            isLegit: true,
          };
        } else {
          // Account is connected - analyze legitimacy
          if (!activeDaemonUrl && !userTunnel?.url) {
            legitimacy = {
              status: 'unverified',
              badge: 'Unregistered Daemon',
              description: `User @${row.username} has no active phone daemon registered in the system!`,
              isLegit: false,
            };
          } else {
            // Check if activeDaemonUrl belongs to another user
            let foreignOwner: string | null = null;
            if (activeDaemonUrl) {
              tunnelMap.forEach((tData, tUser) => {
                if (
                  !foreignOwner &&
                  tUser !== lowerOwner &&
                  tData.url &&
                  (tData.url === activeDaemonUrl || activeDaemonUrl.includes(tData.url) || tData.url.includes(activeDaemonUrl))
                ) {
                  foreignOwner = tUser;
                }
              });
            }

            if (foreignOwner) {
              legitimacy = {
                status: 'leak',
                badge: `Foreign Tunnel (@${foreignOwner})`,
                description: `CRITICAL LEAK: Account owned by @${row.username} is routed through @${foreignOwner}'s phone tunnel!`,
                isLegit: false,
              };
            } else if (
              userTunnel?.url &&
              activeDaemonUrl &&
              !userTunnel.url.includes(activeDaemonUrl) &&
              !activeDaemonUrl.includes(userTunnel.url)
            ) {
              legitimacy = {
                status: 'leak',
                badge: 'Tunnel URL Mismatch',
                description: `Account is routed via ${activeDaemonUrl}, but @${row.username}'s registered tunnel is ${userTunnel.url}`,
                isLegit: false,
              };
            } else if (!userTunnel?.url && activeDaemonUrl) {
              legitimacy = {
                status: 'unverified',
                badge: 'Direct Tunnel (Standalone)',
                description: `Connected directly via ${activeDaemonUrl} without user-registered phone daemon.`,
                isLegit: true,
              };
            } else {
              legitimacy = {
                status: 'legit',
                badge: 'Verified Legit Owner',
                description: `Legitimate connection: Running securely on @${row.username}'s dedicated phone daemon tunnel.`,
                isLegit: true,
              };
            }
          }
        }

        realAccounts.push({
          id: row.id,
          owner: row.username,
          ign: botName,
          serverHost: row.server_host || 'donutsmp.net',
          serverPort: row.server_port || 25565,
          isConnected,
          connectedAt: isConnected ? row.settings?.connected_at : undefined,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          settings: row.settings || {},
          daemonUrl: activeDaemonUrl,
          registeredTunnel: userTunnel?.url,
          legitimacy,
        });
      }
    });

    // 5. Build user summary list
    const userList: UserSummaryItem[] = (users || []).map((u) => {
      const lowerU = (u.username || '').toLowerCase().trim();
      let rank: UserRank = lowerU === 'chief' ? 'diamond' : 'iron';
      if ((u as any).rank && RANKS[(u as any).rank?.toLowerCase() as UserRank]) {
        rank = (u as any).rank.toLowerCase() as UserRank;
      }

      const userAccounts = realAccounts.filter((a) => a.owner.toLowerCase().trim() === lowerU);
      const connectedCount = userAccounts.filter((a) => a.isConnected).length;
      const secretCode = u.password_hash ? generateSecretCode(u.username, u.password_hash) : undefined;
      const userTunnel = tunnelMap.get(lowerU);
      const isTunnelActive = Boolean(userTunnel?.url && Date.now() - userTunnel.updatedAt < 65000);

      return {
        id: u.id,
        username: u.username,
        rank,
        accountCount: userAccounts.length,
        connectedCount,
        secretCode,
        createdAt: u.created_at || new Date().toISOString(),
        tunnelUrl: userTunnel?.url,
        isTunnelActive,
      };
    });

    // 6. Build tunnel overview list
    const tunnelList: AdminTunnelItem[] = [];
    tunnelMap.forEach((t, u) => {
      const activeBots = realAccounts.filter((a) => a.owner.toLowerCase().trim() === u && a.isConnected).length;
      const isRecent = Boolean(t.url && Date.now() - t.updatedAt < 65000);
      tunnelList.push({
        username: u,
        url: t.url,
        updatedAt: t.updatedAt,
        isRecent,
        activeBots,
      });
    });

    // 7. Aggregate stats
    const rankBreakdown = {
      iron: 0,
      gold: 0,
      diamond: 0,
      emerald: 0,
    };

    userList.forEach((u) => {
      if (rankBreakdown[u.rank] !== undefined) {
        rankBreakdown[u.rank]++;
      }
    });

    const activeTunnelsCount = tunnelList.filter((t) => t.isRecent).length;
    const isRegistrationsPaused = await getRegistrationsPaused();

    return NextResponse.json({
      stats: {
        totalUsers: userList.length,
        totalAccounts: realAccounts.length,
        totalConnected: realAccounts.filter((a) => a.isConnected).length,
        totalTunnels: activeTunnelsCount,
        rankBreakdown,
        isRegistrationsPaused,
      },
      isRegistrationsPaused,
      users: userList,
      accounts: realAccounts,
      tunnels: tunnelList,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendStopBotToDaemon(
  daemonUrl: string,
  username: string,
  token: string,
  botIgn: string,
  lastBotId?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof WebSocket === 'undefined') {
        return resolve(false);
      }
      const ws = new WebSocket(daemonUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve(false);
      }, 3500);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'AUTH',
          payload: { username, token }
        }));
      };

      ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
          const msg = JSON.parse(raw);
          if (msg.type === 'AUTH_RESULT' && msg.payload?.success) {
            if (botIgn) {
              ws.send(JSON.stringify({
                type: 'STOP_BOT',
                payload: { botId: botIgn, id: botIgn, username: botIgn }
              }));
            }
            if (lastBotId && lastBotId.toLowerCase() !== botIgn.toLowerCase()) {
              ws.send(JSON.stringify({
                type: 'STOP_BOT',
                payload: { botId: lastBotId, id: lastBotId, username: lastBotId }
              }));
            }
            setTimeout(() => {
              clearTimeout(timer);
              try { ws.close(); } catch {}
              resolve(true);
            }, 600);
          }
        } catch {}
      };

      ws.onerror = () => {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;

    // Action 0: Pause or Resume public registrations
    if (action === 'toggle_registrations') {
      const { paused } = body;
      const current = await getRegistrationsPaused();
      const targetState = typeof paused === 'boolean' ? paused : !current;
      const success = await setRegistrationsPaused(targetState);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update registration status in database' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        isRegistrationsPaused: targetState,
        message: targetState ? 'Public registrations are now PAUSED.' : 'Public registrations are now RESUMED & OPEN.',
      });
    }

    // Action 1: Change user rank
    if (action === 'change_rank') {
      const { username, rank } = body;
      if (!username || !rank) {
        return NextResponse.json({ error: 'username and rank required' }, { status: 400 });
      }

      const cleanRank = (rank || '').toLowerCase().trim() as UserRank;
      if (!RANKS[cleanRank]) {
        return NextResponse.json({ error: 'Invalid rank' }, { status: 400 });
      }

      const cleanUser = username.trim();

      // Update public.users table column directly
      const { error: updateErr } = await supabase
        .from('users')
        .update({ rank: cleanRank })
        .ilike('username', cleanUser);

      if (updateErr) {
        console.error('Failed to update rank in public.users:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Cleanup any legacy __meta_rank__ row from accounts table
      try {
        await supabase
          .from('accounts')
          .delete()
          .ilike('username', cleanUser)
          .eq('bot_name', '__meta_rank__');
      } catch {}

      return NextResponse.json({ success: true, message: `Rank for ${cleanUser} changed to ${RANKS[cleanRank].name}` });
    }

    // Action 2: Reset user password
    if (action === 'reset_password') {
      const { username, newPassword } = body;
      if (!username || !newPassword) {
        return NextResponse.json({ error: 'username and newPassword required' }, { status: 400 });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters long' }, { status: 400 });
      }

      const cleanUser = username.trim();
      const newHash = hashPassword(newPassword);

      const { data, error } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .ilike('username', cleanUser)
        .select('id, username');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Password for @${cleanUser} successfully updated!`,
        newSecretCode: generateSecretCode(cleanUser, newHash),
      });
    }

    // Action 3: Create new user
    if (action === 'create_user') {
      const { username, password, rank } = body;
      if (!username || !password) {
        return NextResponse.json({ error: 'username and password required' }, { status: 400 });
      }

      const cleanUsername = username.trim();
      if (!USERNAME_REGEX.test(cleanUsername)) {
        return NextResponse.json({
          error: 'Username must be 1 to 6 characters long, using only letters and numbers.',
        }, { status: 400 });
      }

      const cleanRank = (rank || 'iron').toLowerCase().trim() as UserRank;
      const hashedPassword = hashPassword(password);

      // Check duplicate
      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: `User '${cleanUsername}' already exists` }, { status: 400 });
      }

      // Insert user with rank directly into public.users
      const { error: insErr } = await supabase.from('users').insert([
        { username: cleanUsername, password_hash: hashedPassword, rank: cleanRank },
      ]);

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `User @${cleanUsername} created successfully with ${RANKS[cleanRank]?.name || 'Iron'} rank!`,
      });
    }

    // Action 4: Delete user
    if (action === 'delete_user') {
      const { username } = body;
      if (!username) {
        return NextResponse.json({ error: 'username required' }, { status: 400 });
      }

      const cleanUser = username.trim();
      const lowerUser = cleanUser.toLowerCase();

      // 1. Purge live in-memory tunnel cache
      sharedUserTunnels.delete(lowerUser);
      sharedUserTunnels.delete(cleanUser);

      // 2. Delete user's tunnel from Supabase
      try {
        await supabase.from('tunnels').delete().ilike('username', cleanUser);
        await supabase.from('tunnels').delete().eq('username', cleanUser);
        await supabase.from('tunnels').delete().eq('username', lowerUser);
      } catch (e) {
        console.warn('Error purging user tunnel:', e);
      }

      // 3. Delete all Minecraft accounts, server profiles (__meta_servers__), rank (__meta_rank__), logs, commands
      try {
        await supabase.from('accounts').delete().ilike('username', cleanUser);
        await supabase.from('accounts').delete().eq('username', cleanUser);
        await supabase.from('accounts').delete().eq('username', lowerUser);
      } catch (e) {
        console.warn('Error purging user accounts & metadata:', e);
      }

      // 4. Delete user record from Supabase users table
      const { error: delErr } = await supabase.from('users').delete().ilike('username', cleanUser);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `User @${cleanUser} and all associated accounts, server profiles, rank, and tunnels permanently deleted.`
      });
    }

    // Action 5: Delete Minecraft account
    if (action === 'delete_account') {
      const { accountId } = body;
      if (!accountId) {
        return NextResponse.json({ error: 'accountId required' }, { status: 400 });
      }

      const { error: delErr } = await supabase.from('accounts').delete().eq('id', accountId);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Account deleted successfully' });
    }

    // Action 6: Disconnect account
    if (action === 'disconnect_account') {
      const { accountId, ign } = body;
      if (!accountId) {
        return NextResponse.json({ error: 'accountId required' }, { status: 400 });
      }

      const { data: accRow } = await supabase.from('accounts').select('*').eq('id', accountId).maybeSingle();
      const existingSettings = accRow?.settings || {};
      const owner = (accRow?.username || '').trim().toLowerCase();
      const botIgn = (ign || accRow?.bot_name || '').trim();

      // 1. Mark disconnected in Supabase
      await supabase
        .from('accounts')
        .update({
          settings: {
            ...existingSettings,
            is_connected: false,
            connected_at: null,
            disconnected_at: Date.now(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      // 2. Proactively terminate the bot on the active daemon
      let daemonUrl = sharedUserTunnels.get(owner)?.url;
      if (!daemonUrl && supabase) {
        const { data: tunRow } = await supabase
          .from('tunnels')
          .select('daemon_url')
          .ilike('username', owner)
          .maybeSingle();
        daemonUrl = tunRow?.daemon_url;
      }

      if (daemonUrl && daemonUrl.startsWith('ws')) {
        try {
          const { data: userRow } = await supabase
            .from('users')
            .select('password_hash')
            .ilike('username', owner)
            .maybeSingle();
          const token = userRow?.password_hash ? generateSecretCode(owner, userRow.password_hash) : '';
          await sendStopBotToDaemon(daemonUrl, owner, token, botIgn, existingSettings.last_bot_id);
        } catch (e) {
          console.warn('[Admin] Failed to send STOP_BOT to daemon:', e);
        }
      }

      return NextResponse.json({ success: true, message: `Account ${botIgn || accountId} disconnected successfully` });
    }

    // Action 7: Disconnect / Clear Tunnel
    if (action === 'disconnect_tunnel') {
      const { username } = body;
      if (!username) {
        return NextResponse.json({ error: 'username required' }, { status: 400 });
      }

      const cleanUser = username.trim().toLowerCase();
      sharedUserTunnels.delete(cleanUser);

      await supabase.from('tunnels').update({
        daemon_url: '',
        updated_at: new Date().toISOString(),
      }).ilike('username', cleanUser);

      // Also set all accounts for this user as disconnected
      const { data: userAccs } = await supabase
        .from('accounts')
        .select('id, settings')
        .ilike('username', cleanUser);

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

      return NextResponse.json({ success: true, message: `Phone daemon tunnel and active bots disconnected for @${cleanUser}` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
