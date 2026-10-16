import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Fallback in-memory store if Supabase credentials are not added yet
const localUsers = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const { action, username, password } = await req.json();

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (action === 'register') {
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
      }

      if (supabase) {
        // Check if user exists in Supabase
        const { data: existing } = await supabase.from('users').select('username').eq('username', cleanUsername).maybeSingle();
        if (existing) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }

        const { error } = await supabase.from('users').insert([{ username: cleanUsername, password_hash: password }]);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        if (localUsers.has(cleanUsername)) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        localUsers.set(cleanUsername, password);
      }

      return NextResponse.json({ success: true, user: { username: cleanUsername } });
    }

    if (action === 'login') {
      if (supabase) {
        const { data: user } = await supabase.from('users').select('*').eq('username', cleanUsername).maybeSingle();
        if (!user || user.password_hash !== password) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }
      } else {
        const storedPass = localUsers.get(cleanUsername);
        if (!storedPass || storedPass !== password) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }
      }

      return NextResponse.json({ success: true, user: { username: cleanUsername } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
