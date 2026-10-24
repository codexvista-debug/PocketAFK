import { supabase } from './supabaseClient';
import { MinecraftAccount, ServerProfile, QuickCommandItem, PlayerLogEntry, WebhookConfig, DEFAULT_WEBHOOK_CONFIG } from '@/types';

/**
 * Universal Server Profiles Sync:
 * Saves server profiles centrally in Supabase under a metadata row '__meta_servers__',
 * ensuring all devices (mobile, PC, tablet) always see the exact same server profiles.
 */
export async function saveServersToSupabase(currentUser: string, servers: ServerProfile[]) {
  if (!supabase || !currentUser) return;
  try {
    const cleanUser = currentUser.trim();

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_servers__')
      .limit(1);

    const payload = {
      servers,
      updatedAt: Date.now(),
    };

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({
          settings: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: '__meta_servers__',
          server_host: 'pocketafk.internal',
          server_port: 25565,
          settings: payload,
        },
      ]);
    }
  } catch (err) {
    console.warn('Failed to save servers to Supabase:', err);
  }
}

/**
 * Universal Server Profiles Loader:
 * Fetches centrally configured server profiles for the user from Supabase.
 */
export async function loadServersFromSupabase(currentUser: string): Promise<ServerProfile[] | null> {
  if (!supabase || !currentUser) return null;
  try {
    const cleanUser = currentUser.trim();
    const { data, error } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_servers__')
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const servers = data[0]?.settings?.servers;
    if (Array.isArray(servers)) {
      return servers;
    }
    return null;
  } catch (err) {
    console.warn('Failed to load servers from Supabase:', err);
    return null;
  }
}

/**
 * Universal Minecraft Accounts Loader:
 * Fetches all verified Minecraft accounts stored in Supabase for this user.
 */
export async function loadAccountsFromSupabase(currentUser: string, preferredAccounts: MinecraftAccount[] = []): Promise<MinecraftAccount[] | null> {
  if (!supabase || !currentUser) return null;
  try {
    const cleanUser = currentUser.trim();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .ilike('username', cleanUser)
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    const accounts: MinecraftAccount[] = [];
    const seen = new Set<string>();
    const preferredIds = new Map(
      preferredAccounts
        .filter((account) => account.id && (account.ign || account.username))
        .map((account) => [(account.ign || account.username).trim().toLowerCase(), account.id])
    );

    data.forEach((row) => {
      const botName = (row.bot_name || '').trim();
      // Skip metadata rows
      if (!botName || botName.startsWith('__')) return;

      const key = botName.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push({
          // Keep IDs created by the first browser that linked this account. Server profiles
          // store these IDs, so replacing them with the database UUID orphaned assignments.
          id: row.settings?.pocketafk_account_id || preferredIds.get(key) || `acc_${row.id}`,
          username: botName,
          ign: botName,
          auth_type: 'microsoft',
          verified: true,
          addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          settings: row.settings || {},
        });
      }
    });

    return accounts;
  } catch (err) {
    console.warn('Failed to load accounts from Supabase:', err);
    return [];
  }
}

/**
 * Ensures all verified accounts and configured servers are persisted in Supabase
 * under the current user's profile.
 */
export async function syncAllToSupabase(
  currentUser: string,
  accounts: MinecraftAccount[],
  servers: ServerProfile[]
) {
  if (!supabase || !currentUser) return;

  try {
    const cleanUser = currentUser.trim();

    // 1. Universally persist servers in __meta_servers__
    if (servers && servers.length > 0) {
      await saveServersToSupabase(cleanUser, servers);
    }

    // 2. Fetch current real account rows for this user in Supabase
    const { data: existingRows } = await supabase
      .from('accounts')
      .select('id, bot_name, server_host, settings')
      .ilike('username', cleanUser);

    const rowsByBotName = new Map(
      (existingRows || [])
        .map((row) => [(row.bot_name || '').trim().toLowerCase(), row] as const)
        .filter(([name]) => name && !name.startsWith('__'))
    );

    const existingBotNames = new Set(
      (existingRows || [])
        .map((r) => (r.bot_name || '').trim().toLowerCase())
        .filter((n) => n && !n.startsWith('__'))
    );

    // 3. Upsert verified accounts into Supabase
    for (const acc of accounts) {
      if (!acc.verified) continue;
      const ign = (acc.ign || acc.username || '').trim();
      if (!ign || ign.includes('@')) continue;

      if (!existingBotNames.has(ign.toLowerCase())) {
        const firstServer = servers[0];
        await supabase.from('accounts').insert([
          {
            username: cleanUser,
            bot_name: ign,
            auth_type: 'microsoft',
            server_host: firstServer?.serverHost || 'donutsmp.net',
            server_port: firstServer?.serverPort || 25565,
            server_version: firstServer?.serverVersion || 'auto',
            settings: { ...(acc.settings || {}), pocketafk_account_id: acc.id },
          },
        ]);
        existingBotNames.add(ign.toLowerCase());
      } else {
        const row = rowsByBotName.get(ign.toLowerCase());
        if (row && !row.settings?.pocketafk_account_id) {
          await supabase
            .from('accounts')
            .update({
              settings: { ...(row.settings || {}), pocketafk_account_id: acc.id },
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        }
      }
    }
  } catch (err) {
    console.warn('Supabase sync warning:', err);
  }
}

/**
 * Explicitly removes an unlinked account from Supabase so it never resurrects.
 */
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
  startTime: number,
  serverId?: string,
  daemonUrl?: string
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
      server_id: serverId,
      daemon_url: daemonUrl || existingSettings.daemon_url || '',
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
        const srvId = row.settings?.server_id;
        if (connectedAt && typeof connectedAt === 'number' && isConnected !== false) {
          if (srvId) sessions[srvId] = connectedAt;
        }
      }
    }
    return sessions;
  } catch (err) {
    console.warn('Failed to load connection sessions from Supabase:', err);
    return {};
  }
}

/**
 * Saves server-specific quick command macros in Supabase.
 */
export async function saveQuickCommandsToSupabase(
  currentUser: string,
  serverId: string,
  commands: QuickCommandItem[]
) {
  if (!supabase || !currentUser || !serverId) return;
  try {
    const cleanUser = currentUser.trim();
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_quick_commands__')
      .limit(1);

    const existingSettings = existing?.[0]?.settings || {};
    const updatedSettings = {
      ...existingSettings,
      [serverId]: commands,
      updatedAt: Date.now(),
    };

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: '__meta_quick_commands__',
          server_host: 'pocketafk.internal',
          server_port: 25565,
          settings: updatedSettings,
        },
      ]);
    }
  } catch (err) {
    console.warn('Failed to save quick commands to Supabase:', err);
  }
}

/**
 * Loads server-specific quick command macros from Supabase.
 */
export async function loadQuickCommandsFromSupabase(
  currentUser: string,
  serverId: string
): Promise<QuickCommandItem[] | null> {
  if (!supabase || !currentUser || !serverId) return null;
  try {
    const cleanUser = currentUser.trim();
    const { data } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_quick_commands__')
      .limit(1);

    if (data && data.length > 0 && data[0].settings) {
      const serverCmds = data[0].settings[serverId];
      if (Array.isArray(serverCmds) && serverCmds.length > 0) {
        return serverCmds;
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to load quick commands from Supabase:', err);
    return null;
  }
}

/**
 * Saves and updates player connection & activity logs in Supabase.
 * Tries the dedicated 'account_logs' table first, with graceful fallback to '__meta_logs_<account>' in 'accounts'.
 */
export async function saveAccountLogsToSupabase(
  currentUser: string,
  accountName: string,
  logs: PlayerLogEntry[]
) {
  if (!supabase || !currentUser || !accountName) return;
  try {
    const cleanUser = currentUser.trim();
    const cleanAccount = accountName.trim().replace(/^@/, '');
    const metaBotName = `__meta_logs_${cleanAccount.toLowerCase()}`;

    // Store latest 150 logs in meta row
    const payload = {
      logs: logs.slice(-150),
      updatedAt: Date.now(),
    };

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('username', cleanUser)
      .eq('bot_name', metaBotName)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({ settings: payload, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: metaBotName,
          server_host: logs[0]?.serverHost || 'pocketafk.internal',
          server_port: 25565,
          settings: payload,
        },
      ]);
    }
  } catch (err) {
    console.warn('Failed to save account logs to Supabase:', err);
  }
}

/**
 * Loads player connection & activity logs from Supabase.
 */
export async function loadAccountLogsFromSupabase(
  currentUser: string,
  accountName: string
): Promise<PlayerLogEntry[]> {
  if (!supabase || !currentUser || !accountName) return [];
  try {
    const cleanUser = currentUser.trim();
    const cleanAccount = accountName.trim().replace(/^@/, '');
    const metaBotName = `__meta_logs_${cleanAccount.toLowerCase()}`;

    const { data } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', metaBotName)
      .limit(1);

    if (data && data.length > 0 && data[0].settings) {
      const logs = data[0].settings.logs;
      if (Array.isArray(logs)) {
        return logs;
      }
    }
    return [];
  } catch (err) {
    console.warn('Failed to load account logs from Supabase:', err);
    return [];
  }
}

/**
 * Universal Account Notes Sync:
 * Saves account notes centrally in Supabase under metadata row '__meta_notes__',
 * ensuring all devices (PC, mobile, tablet) always see the exact same account notes.
 */
export async function saveNotesToSupabase(currentUser: string, notes: Record<string, string>) {
  if (!supabase || !currentUser) return;
  try {
    const cleanUser = currentUser.trim();

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_notes__')
      .limit(1);

    const payload = {
      notes,
      updatedAt: Date.now(),
    };

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({
          settings: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: '__meta_notes__',
          server_host: 'pocketafk.internal',
          server_port: 25565,
          settings: payload,
        },
      ]);
    }
  } catch (err) {
    console.warn('Failed to save notes to Supabase:', err);
  }
}

/**
 * Universal Account Notes Loader:
 * Fetches centrally configured account notes for the user from Supabase.
 */
export async function loadNotesFromSupabase(currentUser: string): Promise<Record<string, string> | null> {
  if (!supabase || !currentUser) return null;
  try {
    const cleanUser = currentUser.trim();
    const { data, error } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_notes__')
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const notes = data[0]?.settings?.notes;
    if (notes && typeof notes === 'object') {
      return notes;
    }
    return null;
  } catch (err) {
    console.warn('Failed to load notes from Supabase:', err);
    return null;
  }
}

/**
 * Universal Discord Webhook Settings Sync:
 * Saves user webhook configuration centrally in Supabase under metadata row '__meta_webhooks__',
 * syncing all Discord channels and alert toggles seamlessly across devices.
 */
export async function saveWebhookConfigToSupabase(currentUser: string, config: WebhookConfig) {
  if (!supabase || !currentUser) return;
  try {
    const cleanUser = currentUser.trim();

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_webhooks__')
      .limit(1);

    const payload = {
      config,
      updatedAt: Date.now(),
    };

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({
          settings: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: '__meta_webhooks__',
          server_host: 'pocketafk.internal',
          server_port: 25565,
          settings: payload,
        },
      ]);
    }
  } catch (err) {
    console.warn('Failed to save webhook config to Supabase:', err);
  }
}

/**
 * Universal Discord Webhook Settings Loader:
 * Fetches user webhook configuration from Supabase.
 */
export async function loadWebhookConfigFromSupabase(currentUser: string): Promise<WebhookConfig | null> {
  if (!supabase || !currentUser) return null;
  try {
    const cleanUser = currentUser.trim();
    const { data, error } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_webhooks__')
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const cfg = data[0]?.settings?.config;
    if (cfg && typeof cfg === 'object') {
      return {
        ...DEFAULT_WEBHOOK_CONFIG,
        ...cfg,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to load webhook config from Supabase:', err);
    return null;
  }
}



