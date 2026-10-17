import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { RANKS, UserRank, getRankConfig } from '@/lib/ranks';

export const dynamic = 'force-dynamic';

async function fetchUserRankFromSupabase(cleanUser: string): Promise<UserRank> {
  if (!supabase) return cleanUser.toLowerCase() === 'chief' ? 'diamond' : 'iron';

  // Pull rank directly from public.users table
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('rank')
      .ilike('username', cleanUser)
      .maybeSingle();

    if (userRow?.rank) {
      const dbRank = String(userRow.rank).toLowerCase().trim() as UserRank;
      if (RANKS[dbRank]) return dbRank;
    }
  } catch (err) {
    console.error('Error fetching rank from public.users:', err);
  }

  return cleanUser.toLowerCase() === 'chief' ? 'diamond' : 'iron';
}

async function persistUserRankInSupabase(cleanUser: string, rank: UserRank) {
  if (!supabase) return;

  // Persist rank directly in public.users table
  try {
    await supabase
      .from('users')
      .update({ rank })
      .ilike('username', cleanUser);
  } catch (err) {
    console.error('Failed to persist rank in public.users:', err);
  }

  // Clean up any legacy __meta_rank__ row from accounts table
  try {
    await supabase
      .from('accounts')
      .delete()
      .ilike('username', cleanUser)
      .eq('bot_name', '__meta_rank__');
  } catch {}
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
    const body = await req.json();
    const { username, rank, adminAuth } = body;

    // Check admin authorization: must provide adminAuth flag or header
    const headerAdmin = req.headers.get('x-admin-action') === 'true';
    if (!adminAuth && !headerAdmin) {
      return NextResponse.json(
        { error: 'Ranks cannot be self-upgraded. Changes must be made by an administrator at /chief.' },
        { status: 403 }
      );
    }

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
