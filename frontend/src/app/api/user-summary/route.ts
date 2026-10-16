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
            // Ignore raw emails, keep real IGNs
            if (!accounts.map((a) => a.toLowerCase()).includes(ign.toLowerCase())) {
              accounts.push(ign);
            }
          }
        });
      }
    }

    return NextResponse.json({
      username,
      accounts,
      totalAccounts: accounts.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
