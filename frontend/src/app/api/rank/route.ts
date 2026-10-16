import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { RANKS, UserRank, getRankConfig } from '@/lib/ranks';

export const dynamic = 'force-dynamic';

async function fetchUserRankFromSupabase(cleanUser: string): Promise<UserRank> {
  if (!supabase) return 'iron';

  // 1. Try checking users table (if rank column exists)
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUser)
      .maybeSingle();

    if (userRow && (userRow as any).rank) {
      const dbRank = String((userRow as any).rank).toLowerCase().trim() as UserRank;
      if (RANKS[dbRank]) return dbRank;
    }
  } catch {
    // Column might not exist yet
  }

  // 2. Fallback check: accounts table metadata row (__meta_rank__)
  try {
    const { data: metaRows } = await supabase
      .from('accounts')
      .select('settings')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_rank__')
      .limit(1);

    if (metaRows && metaRows.length > 0) {
      const metaRank = metaRows[0].settings?.rank?.toLowerCase()?.trim() as UserRank;
      if (metaRank && RANKS[metaRank]) return metaRank;
    }
  } catch {
    // Ignore error
  }

  return 'iron';
}

async function persistUserRankInSupabase(cleanUser: string, rank: UserRank) {
  if (!supabase) return;

  // 1. Try updating users table directly
  try {
    await supabase
      .from('users')
      .update({ rank } as any)
      .ilike('username', cleanUser);
  } catch {
    // users table might not have 'rank' column yet
  }

  // 2. Persist in accounts table metadata row (__meta_rank__)
  try {
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_rank__')
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('accounts')
        .update({ settings: { rank } })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('accounts').insert([
        {
          username: cleanUser,
          bot_name: '__meta_rank__',
          server_host: 'pocketafk.internal',
          server_port: 25565,
          settings: { rank },
        },
      ]);
    }
  } catch (e) {
    console.warn('Failed to persist rank metadata in accounts table:', e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username')?.trim();

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const cleanUser = username.replace(/^@/, '');
    const rank = await fetchUserRankFromSupabase(cleanUser);
    const config = getRankConfig(rank);

    return NextResponse.json({
      username: cleanUser,
      rank,
      maxAccounts: config.maxAccounts,
      maxServers: config.maxServers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, rank } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cleanRank = (rank || '').toLowerCase().trim() as UserRank;
    if (!RANKS[cleanRank]) {
      return NextResponse.json(
        { error: `Invalid rank. Valid ranks are: ${Object.keys(RANKS).join(', ')}` },
        { status: 400 }
      );
    }

    const cleanUser = username.replace(/^@/, '').trim();
    await persistUserRankInSupabase(cleanUser, cleanRank);

    const config = getRankConfig(cleanRank);
    return NextResponse.json({
      success: true,
      username: cleanUser,
      rank: cleanRank,
      maxAccounts: config.maxAccounts,
      maxServers: config.maxServers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
