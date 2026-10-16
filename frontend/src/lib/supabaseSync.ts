import { supabase } from './supabaseClient';
import { MinecraftAccount, ServerProfile } from '@/types';

/**
 * Ensures all verified accounts and configured servers are persisted in Supabase
 * under the current user's profile, so Termux user-summary always has accurate counts.
 * Also removes any deleted accounts from Supabase so they never resurrect.
 */
export async function syncAllToSupabase(currentUser: string, accounts: MinecraftAccount[], servers: ServerProfile[]) {
  if (!supabase || !currentUser) return;

  try {
    const cleanUser = currentUser.trim();

    // 1. Fetch current rows for this user in Supabase
    const { data: existingRows } = await supabase
      .from('accounts')
      .select('id, bot_name, server_host')
      .ilike('username', cleanUser);

    // Active verified Minecraft IGNs
    const currentActiveIgns = new Set(
      accounts
        .filter((a) => a.verified)
        .map((a) => (a.ign || a.username || '').trim().toLowerCase())
        .filter((name) => name && !name.includes('@'))
    );

    // Clean up any rows in Supabase that are no longer in accounts (excluding metadata rows)
    for (const row of existingRows || []) {
      const botName = (row.bot_name || '').trim().toLowerCase();
      if (botName && !botName.startsWith('__') && !currentActiveIgns.has(botName)) {
        await supabase.from('accounts').delete().eq('id', row.id);
      }
    }

    // 2. Insert any accounts present in state that aren't yet in Supabase
    const existingBotNames = new Set(
      (existingRows || [])
        .map((r) => (r.bot_name || '').trim().toLowerCase())
        .filter((n) => currentActiveIgns.has(n))
    );

    for (const acc of accounts) {
      if (!acc.verified) continue; // Only sync verified accounts!
      const ign = (acc.ign || acc.username || '').trim();
      if (!ign || ign.includes('@')) continue;

      if (!existingBotNames.has(ign.toLowerCase())) {
        // Insert missing account row
        const firstServer = servers[0];
        await supabase.from('accounts').insert([
          {
            username: cleanUser,
            bot_name: ign,
            auth_type: 'microsoft',
            server_host: firstServer?.serverHost || 'donutsmp.net',
            server_port: firstServer?.serverPort || 25565,
            server_version: firstServer?.serverVersion || 'auto',
          },
        ]);
        existingBotNames.add(ign.toLowerCase());
      }
    }

    // 3. Update existing server configurations if present
    for (const srv of servers) {
      const dbId = srv.id.startsWith('srv_') ? srv.id.replace('srv_', '') : null;
      if (dbId) {
        await supabase
          .from('accounts')
          .update({
            server_host: srv.serverHost,
            server_port: srv.serverPort,
            server_version: srv.serverVersion,
            auto_reconnect: srv.autoReconnect,
            settings: srv.settings,
          })
          .eq('id', dbId)
          .eq('username', cleanUser);
      }
    }
  } catch (err) {
    console.warn('Supabase sync warning:', err);
  }
}

export async function deleteAccountFromSupabase(currentUser: string, ign: string) {
  if (!supabase || !currentUser || !ign) return;
  try {
    const cleanUser = currentUser.trim();
    const cleanIgn = ign.trim();
    await supabase
      .from('accounts')
      .delete()
      .ilike('username', cleanUser)
      .ilike('bot_name', cleanIgn);
  } catch (err) {
    console.warn('Failed to delete account from Supabase:', err);
  }
}

/**
 * Records that a bot connected, saving the start time and server IP to Supabase.
 */
export async function recordAccountConnectionStart(
  currentUser: string,
  accountName: string,
  serverHost: string,
  startTime: number
) {
  if (!supabase || !currentUser || !accountName) return;
  try {
    const cleanUser = currentUser.trim();
    const cleanName = accountName.trim();

    const { data } = await supabase
      .from('accounts')
      .select('id, settings')
      .ilike('username', cleanUser)
      .ilike('bot_name', cleanName)
      .limit(1);

    const existingSettings = data?.[0]?.settings || {};
    const newSettings = {
      ...existingSettings,
      connected_at: startTime,
      is_connected: true,
      server_host: serverHost,
    };

    await supabase
      .from('accounts')
      .update({
        server_host: serverHost,
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .ilike('username', cleanUser)
      .ilike('bot_name', cleanName);
  } catch (err) {
    console.warn('Failed to record connection start to Supabase:', err);
  }
}

/**
 * Records that a bot disconnected in Supabase.
 */
export async function recordAccountConnectionStop(
  currentUser: string,
  accountName: string
) {
  if (!supabase || !currentUser || !accountName) return;
  try {
    const cleanUser = currentUser.trim();
    const cleanName = accountName.trim();

    const { data } = await supabase
      .from('accounts')
      .select('id, settings')
      .ilike('username', cleanUser)
      .ilike('bot_name', cleanName)
      .limit(1);

    if (data && data.length > 0) {
      const existingSettings = data[0].settings || {};
      await supabase
        .from('accounts')
        .update({
          settings: {
            ...existingSettings,
            is_connected: false,
            disconnected_at: Date.now(),
          },
          updated_at: new Date().toISOString(),
        })
        .ilike('username', cleanUser)
        .ilike('bot_name', cleanName);
    }
  } catch (err) {
    console.warn('Failed to record connection stop to Supabase:', err);
  }
}

/**
 * Loads all active connection start times and sessions from Supabase.
 */
export async function loadAccountSessionsFromSupabase(currentUser: string): Promise<Record<string, number>> {
  if (!supabase || !currentUser) return {};
  try {
    const cleanUser = currentUser.trim();
    const { data } = await supabase
      .from('accounts')
      .select('bot_name, server_host, settings')
      .ilike('username', cleanUser);

    const sessions: Record<string, number> = {};
    if (data) {
      for (const row of data) {
        const connectedAt = row.settings?.connected_at;
        const isConnected = row.settings?.is_connected;
        if (connectedAt && typeof connectedAt === 'number' && isConnected !== false) {
          if (row.bot_name) sessions[row.bot_name] = connectedAt;
          if (row.server_host) sessions[row.server_host] = connectedAt;
        }
      }
    }
    return sessions;
  } catch (err) {
    console.warn('Failed to load connection sessions from Supabase:', err);
    return {};
  }
}

