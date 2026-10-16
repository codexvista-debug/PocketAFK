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
    const servers: string[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .ilike('username', username);

      if (data && !error) {
        data.forEach((row) => {
          if (row.bot_name && !row.bot_name.includes('@') && !accounts.includes(row.bot_name)) {
            accounts.push(row.bot_name);
          }
          if (row.server_host) {
            const srvStr = `${row.server_host}:${row.server_port || 25565}`;
            if (!servers.includes(srvStr)) {
              servers.push(srvStr);
            }
          }
        });
      }
    }

    return NextResponse.json({
      username,
      accounts,
      servers,
      totalAccounts: accounts.length,
      totalServers: servers.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
