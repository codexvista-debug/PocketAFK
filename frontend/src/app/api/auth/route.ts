import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { hashPassword, generateSecretCode, USERNAME_REGEX } from '@/lib/authUtils';
import { getRegistrationsPaused } from '@/lib/systemConfig';

// In-memory fallback if Supabase is temporarily unreachable
const localUsers = new Map<string, string>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username')?.trim().toLowerCase();

    if (!username || searchParams.get('check_registrations') === 'true') {
      const isPaused = await getRegistrationsPaused();
      return NextResponse.json({ registrationsPaused: isPaused });
    }

    if (supabase) {
      const { data: user } = await supabase
        .from('users')
        .select('password_hash')
        .ilike('username', username)
        .maybeSingle();

      if (user?.password_hash) {
        return NextResponse.json({ secretCode: generateSecretCode(username, user.password_hash) });
      }
    }

    const storedHash = localUsers.get(username);
    if (storedHash) {
      return NextResponse.json({ secretCode: generateSecretCode(username, storedHash) });
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
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
    const secretCode = generateSecretCode(cleanUsername, hashedPassword);

    if (action === 'register') {
      const isPaused = await getRegistrationsPaused();
      if (isPaused) {
        return NextResponse.json({
          error: 'Registrations are currently paused by the administrator. Please check back later.'
        }, { status: 403 });
      }

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

      return NextResponse.json({
        success: true,
        user: { username: cleanUsername, secretCode, rank: 'iron', isNewUser: true }
      });
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

        // Fetch rank from users row or fallback to accounts __meta_rank__
        let rank = (user as any).rank || 'iron';
        if (!rank || rank === 'iron') {
          const { data: meta } = await supabase
            .from('accounts')
            .select('settings')
            .ilike('username', cleanUsername)
            .eq('bot_name', '__meta_rank__')
            .maybeSingle();
          if (meta?.settings?.rank) {
            rank = meta.settings.rank;
          }
        }

        return NextResponse.json({
          success: true,
          user: { username: user.username, secretCode, rank }
        });
      } else {
        const storedHash = localUsers.get(lowerUser);
        if (!storedHash || (storedHash !== hashedPassword && storedHash !== password)) {
          return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        return NextResponse.json({
          success: true,
          user: { username: cleanUsername, secretCode, rank: 'iron' }
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
