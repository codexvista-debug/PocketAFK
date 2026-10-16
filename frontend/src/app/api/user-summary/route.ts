import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username')?.trim();

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const accounts: string[] = [];
    let userRank = 'iron';

    if (supabase) {
      const cleanUser = username.replace(/^@/, '');
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .or(`username.ilike.${cleanUser},username.ilike.@${cleanUser}`);

      if (data && !error) {
        data.forEach((row) => {
          if (row.bot_name && row.bot_name.trim()) {
            const ign = row.bot_name.trim();
            // Skip metadata rows
            if (ign.startsWith('__')) {
              if (ign === '__meta_rank__' && row.settings?.rank) {
                userRank = String(row.settings.rank).toLowerCase().trim();
              }
              return;
            }
            // Ignore raw emails, keep real IGNs
            if (!accounts.map((a) => a.toLowerCase()).includes(ign.toLowerCase())) {
              accounts.push(ign);
            }
          }
        });
      }

      // Check users table for authoritative rank if available
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('rank')
          .ilike('username', cleanUser)
          .maybeSingle();
        if (userRow?.rank) {
          userRank = String(userRow.rank).toLowerCase().trim();
        }
      } catch (e) {}
    }

    const rankConfig = {
      iron: { name: 'Iron', maxAccounts: 1, maxServers: 1, gemIcon: '🪙' },
      gold: { name: 'Gold', maxAccounts: 3, maxServers: 3, gemIcon: '⭐' },
      diamond: { name: 'Diamond', maxAccounts: 6, maxServers: 6, gemIcon: '💎' },
      emerald: { name: 'Emerald', maxAccounts: 10, maxServers: 10, gemIcon: '🌿' },
    }[userRank] || { name: 'Iron', maxAccounts: 1, maxServers: 1, gemIcon: '🪙' };

    return NextResponse.json({
      username,
      rank: userRank,
      rankName: rankConfig.name,
      gemIcon: rankConfig.gemIcon,
      maxAccounts: rankConfig.maxAccounts,
      maxServers: rankConfig.maxServers,
      accounts,
      totalAccounts: accounts.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
