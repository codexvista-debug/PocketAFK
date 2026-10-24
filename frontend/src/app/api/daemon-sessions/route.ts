import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Session history storage is unavailable.' }, { status: 503 });

  try {
    const body = await req.json();
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const daemonToken = typeof body.token === 'string' ? body.token.trim() : '';
    if (!username || !daemonToken) return NextResponse.json({ error: 'Username and daemon token are required.' }, { status: 400 });

    if (body.action === 'read') {
      const { data, error } = await supabase.rpc('read_daemon_sessions', {
        p_username: username,
        p_daemon_token: daemonToken,
      });
      if (error) throw error;
      return NextResponse.json({ sessions: data || [] });
    }

    if (body.action === 'event') {
      const eventType = body.eventType === 'spawn' || body.eventType === 'disconnect' ? body.eventType : null;
      if (!eventType) return NextResponse.json({ ok: true });
      const { error } = await supabase.rpc('record_daemon_bot_event', {
        p_username: username,
        p_daemon_token: daemonToken,
        p_event_id: String(body.eventId || '').slice(0, 120),
        p_event_type: eventType,
        p_bot_id: String(body.botId || '').slice(0, 200),
        p_account_name: String(body.accountName || '').slice(0, 100),
        p_server_host: String(body.serverHost || '').slice(0, 255),
        p_occurred_at: body.occurredAt ? new Date(body.occurredAt).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    const unauthorized = error?.code === '42501';
    return NextResponse.json(
      { error: unauthorized ? 'Invalid daemon token.' : 'Could not load daemon session history.' },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
