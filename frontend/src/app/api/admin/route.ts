import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { RANKS, UserRank, getRankConfig } from '@/lib/ranks';
import { hashPassword, generateSecretCode, USERNAME_REGEX } from '@/lib/authUtils';

export const dynamic = 'force-dynamic';

interface UserSummaryItem {
  id: string;
  username: string;
  rank: UserRank;
  accountCount: number;
  connectedCount: number;
  secretCode?: string;
  createdAt: string;
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

    // 3. Separate metadata rows from real Minecraft accounts
    const rankMap = new Map<string, UserRank>();
    const realAccounts: AccountItem[] = [];

    (allAccounts || []).forEach((row) => {
      const lowerOwner = (row.username || '').toLowerCase().trim();
      const botName = (row.bot_name || '').trim();

      if (botName === '__meta_rank__') {
        const metaRank = row.settings?.rank?.toLowerCase()?.trim() as UserRank;
        if (metaRank && RANKS[metaRank]) {
          rankMap.set(lowerOwner, metaRank);
        }
      } else if (!botName.startsWith('__')) {
        const isConnected = Boolean(row.settings?.is_connected);
        realAccounts.push({
          id: row.id,
          owner: row.username,
          ign: botName,
          serverHost: row.server_host || 'donutsmp.net',
          serverPort: row.server_port || 25565,
          isConnected,
          connectedAt: row.settings?.connected_at,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          settings: row.settings || {},
        });
      }
    });

    // 4. Build user summary list
    const userList: UserSummaryItem[] = (users || []).map((u) => {
      const lowerU = (u.username || '').toLowerCase().trim();
      let rank: UserRank = 'iron';
      if ((u as any).rank && RANKS[(u as any).rank?.toLowerCase() as UserRank]) {
        rank = (u as any).rank.toLowerCase() as UserRank;
      } else if (rankMap.has(lowerU)) {
        rank = rankMap.get(lowerU)!;
      }

      const userAccounts = realAccounts.filter((a) => a.owner.toLowerCase().trim() === lowerU);
      const connectedCount = userAccounts.filter((a) => a.isConnected).length;
      const secretCode = u.password_hash ? generateSecretCode(u.password_hash) : undefined;

      return {
        id: u.id,
        username: u.username,
        rank,
        accountCount: userAccounts.length,
        connectedCount,
        secretCode,
        createdAt: u.created_at || new Date().toISOString(),
      };
    });

    // 5. Aggregate stats
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

    return NextResponse.json({
      stats: {
        totalUsers: userList.length,
        totalAccounts: realAccounts.length,
        totalConnected: realAccounts.filter((a) => a.isConnected).length,
        rankBreakdown,
      },
      users: userList,
      accounts: realAccounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;

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

      // Try updating users table column directly
      try {
        await supabase
          .from('users')
          .update({ rank: cleanRank } as any)
          .ilike('username', cleanUser);
      } catch {}

      // Persist in __meta_rank__ row
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .ilike('username', cleanUser)
        .eq('bot_name', '__meta_rank__')
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('accounts')
          .update({ settings: { rank: cleanRank }, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      } else {
        await supabase.from('accounts').insert([
          {
            username: cleanUser,
            bot_name: '__meta_rank__',
            server_host: 'pocketafk.internal',
            server_port: 25565,
            settings: { rank: cleanRank },
          },
        ]);
      }

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
        newSecretCode: generateSecretCode(newHash),
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

      // Insert user
      const { error: insErr } = await supabase.from('users').insert([
        { username: cleanUsername, password_hash: hashedPassword },
      ]);

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // Set rank in metadata
      if (cleanRank !== 'iron') {
        await supabase.from('accounts').insert([
          {
            username: cleanUsername,
            bot_name: '__meta_rank__',
            server_host: 'pocketafk.internal',
            server_port: 25565,
            settings: { rank: cleanRank },
          },
        ]);
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

      // Delete user's accounts
      await supabase.from('accounts').delete().ilike('username', cleanUser);

      // Delete user
      const { error: delErr } = await supabase.from('users').delete().ilike('username', cleanUser);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `User @${cleanUser} and all associated accounts deleted.` });
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
      const { accountId } = body;
      if (!accountId) {
        return NextResponse.json({ error: 'accountId required' }, { status: 400 });
      }

      const { data } = await supabase.from('accounts').select('settings').eq('id', accountId).maybeSingle();
      const existingSettings = data?.settings || {};

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
        .eq('id', accountId);

      return NextResponse.json({ success: true, message: 'Account connection marked as disconnected' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
