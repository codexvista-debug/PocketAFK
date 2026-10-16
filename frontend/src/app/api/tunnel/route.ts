import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { generateSecretCode } from '@/lib/authUtils';

// In-memory cache: username -> { url, token, updatedAt }
const userTunnels = new Map<string, { url: string; token: string; updatedAt: number }>();

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username')?.trim().toLowerCase() || 'default';

  // 1. Check in-memory cache first
  const cached = userTunnels.get(username);
  if (cached && Date.now() - cached.updatedAt < 1000 * 60 * 60 * 12) { // 12 hours valid
    return NextResponse.json({
      ...cached,
      tunnel_url: cached.url,
    });
  }

  // 2. Fallback to Supabase if connected
  if (supabase) {
    try {
      const { data } = await supabase.from('tunnels').select('*').ilike('username', username).maybeSingle();
      if (data) {
        const tunnelObj = {
          url: data.daemon_url,
          tunnel_url: data.daemon_url,
          token: data.daemon_token || '',
          updatedAt: new Date(data.updated_at).getTime(),
        };
        userTunnels.set(username, tunnelObj);
        return NextResponse.json(tunnelObj);
      }
    } catch (e) {
      // ignore
    }
  }

  if (cached) {
    return NextResponse.json({
      ...cached,
      tunnel_url: cached.url,
    });
  }

  return NextResponse.json({ url: '', tunnel_url: '', token: '', updatedAt: 0 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, url, token } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    const cleanUsername = (typeof username === 'string' && username.trim()) 
      ? username.trim().toLowerCase() 
      : 'default';

    // Verify secret code for non-guest usernames to prevent unauthorized takeover
    if (cleanUsername !== 'default' && supabase) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('password_hash')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (user && user.password_hash) {
          const expectedSecret = generateSecretCode(user.password_hash);
          const providedSecret = typeof token === 'string' ? token.trim() : '';

          if (providedSecret !== expectedSecret) {
            return NextResponse.json({
              error: `Unauthorized: Invalid daemon secret code for user @${cleanUsername}. Hijacking attempt blocked.`
            }, { status: 401 });
          }
        }
      } catch (err) {
        console.warn('Error verifying secret code against Supabase:', err);
      }
    }

    // Ensure format is wss://
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('https://')) {
      cleanUrl = cleanUrl.replace('https://', 'wss://');
    }

    const record = {
      url: cleanUrl,
      token: typeof token === 'string' ? token.trim() : '',
      updatedAt: Date.now(),
    };

    userTunnels.set(cleanUsername, record);

    // Persist to Supabase if available
    if (supabase) {
      try {
        await supabase.from('tunnels').upsert({
          username: cleanUsername,
          daemon_url: cleanUrl,
          daemon_token: record.token,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase tunnel upsert error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tunnel paired for user @${cleanUsername}`,
      data: record,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
