import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { generateSecretCode } from '@/lib/authUtils';
import { sharedUserTunnels } from '@/lib/tunnelStore';

const userTunnels = sharedUserTunnels;

export const dynamic = 'force-dynamic';

// 65-second timeout: daemons send heartbeats every 20 seconds.
// If no heartbeat is received in 65s, the daemon is considered offline.
const TUNNEL_TIMEOUT_MS = 65000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username')?.trim().toLowerCase() || 'default';

  // 1. Check in-memory cache first
  const cached = userTunnels.get(username);
  if (cached && cached.url && Date.now() - cached.updatedAt < TUNNEL_TIMEOUT_MS) {
    return NextResponse.json({
      ...cached,
      tunnel_url: cached.url,
      isLive: true,
    });
  }

  // 2. Fallback to Supabase if connected
  if (supabase) {
    try {
      const { data } = await supabase.from('tunnels').select('*').ilike('username', username).maybeSingle();
      if (data && data.daemon_url) {
        const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        if (Date.now() - updatedAt < TUNNEL_TIMEOUT_MS) {
          const tunnelObj = {
            url: data.daemon_url,
            tunnel_url: data.daemon_url,
            token: data.daemon_token || '',
            updatedAt,
            isLive: true,
          };
          userTunnels.set(username, tunnelObj);
          return NextResponse.json(tunnelObj);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Expired or offline
  return NextResponse.json({
    url: '',
    tunnel_url: '',
    token: '',
    updatedAt: cached?.updatedAt || 0,
    isLive: false,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, url, token, action } = body;

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

    // 1. Handle Explicit Disconnect / Shutdown
    if (action === 'disconnect' || !url || (typeof url === 'string' && url.trim() === '')) {
      userTunnels.delete(cleanUsername);

      if (supabase) {
        try {
          await supabase.from('tunnels').update({
            daemon_url: '',
            updated_at: new Date().toISOString(),
          }).ilike('username', cleanUsername);

          // Automatically mark all connected bot accounts for this user as disconnected
          const { data: userAccs } = await supabase
            .from('accounts')
            .select('id, settings')
            .ilike('username', cleanUsername);

          if (userAccs && userAccs.length > 0) {
            for (const acc of userAccs) {
              const updatedSettings = {
                ...(acc.settings || {}),
                is_connected: false,
                connected_at: null,
              };
              await supabase
                .from('accounts')
                .update({
                  settings: updatedSettings,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', acc.id);
            }
          }
        } catch (e) {
          console.warn('Error clearing tunnel & accounts in Supabase:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Phone daemon tunnel disconnected and accounts marked offline for @${cleanUsername}`,
      });
    }

    // 2. Handle Heartbeat or New Tunnel Connection
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
      message: action === 'heartbeat' ? 'Heartbeat received' : `Tunnel paired for user @${cleanUsername}`,
      data: record,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
