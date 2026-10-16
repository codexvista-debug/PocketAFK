import { supabase } from './supabaseClient';
import { MinecraftAccount, ServerProfile } from '@/types';

/**
 * Ensures all verified accounts and configured servers are persisted in Supabase
 * under the current user's profile, so Termux user-summary always has accurate counts.
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

    const existingBotNames = new Set(
      (existingRows || []).map((r) => (r.bot_name || '').trim().toLowerCase()).filter(Boolean)
    );

    // 2. Sync all verified accounts
    for (const acc of accounts) {
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
    await supabase
      .from('accounts')
      .delete()
      .ilike('username', currentUser.trim())
      .ilike('bot_name', ign.trim());
  } catch (err) {
    console.warn('Failed to delete account from Supabase:', err);
  }
}
