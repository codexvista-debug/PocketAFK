import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import crypto from 'crypto';

// In-memory fallback if Supabase is temporarily unreachable
const localUsers = new Map<string, string>();

const USERNAME_REGEX = /^[a-zA-Z0-9]{1,6}$/;
const SALT = '_pocketafk_salt_secure_2026_x89';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { action, username, password } = await req.json();

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const cleanUsername = username.trim();

    // Enforce 1-6 alphanumeric characters strictly (no symbols)
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return NextResponse.json({
        error: 'Username must be 1 to 6 characters long, using only letters and numbers (no symbols).'
      }, { status: 400 });
    }

    const lowerUser = cleanUsername.toLowerCase();
    const hashedPassword = hashPassword(password);

    if (action === 'register') {
      if (supabase) {
        // Check if user exists in Supabase (case-insensitive)
        const { data: existing } = await supabase
          .from('users')
          .select('username')
          .ilike('username', lowerUser)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }

        // Store cryptographically hashed password
        const { error } = await supabase.from('users').insert([
          { username: cleanUsername, password_hash: hashedPassword }
        ]);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        if (localUsers.has(lowerUser)) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        localUsers.set(lowerUser, hashedPassword);
      }

      return NextResponse.json({ success: true, user: { username: cleanUsername } });
    }

    if (action === 'login') {
      if (supabase) {
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .ilike('username', lowerUser)
          .maybeSingle();

        if (!user) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        const isHashMatch = user.password_hash === hashedPassword;
        const isLegacyPlainMatch = user.password_hash === password;

        if (!isHashMatch && !isLegacyPlainMatch) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        // If user logged in with legacy plaintext password, immediately upgrade to secure hash in DB!
        if (isLegacyPlainMatch && !isHashMatch) {
          await supabase
            .from('users')
            .update({ password_hash: hashedPassword })
            .eq('id', user.id);
        }

        return NextResponse.json({ success: true, user: { username: user.username } });
      } else {
        const storedHash = localUsers.get(lowerUser);
        if (!storedHash || (storedHash !== hashedPassword && storedHash !== password)) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        return NextResponse.json({ success: true, user: { username: cleanUsername } });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
