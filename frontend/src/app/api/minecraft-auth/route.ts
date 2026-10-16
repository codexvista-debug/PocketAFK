import { NextRequest, NextResponse } from 'next/server';
import { Authflow, Titles } from 'prismarine-auth';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface PendingAuthSession {
  email: string;
  userCode: string;
  verificationUri: string;
  status: 'pending' | 'success' | 'error';
  ign?: string;
  uuid?: string;
  error?: string;
  createdAt: number;
}

// Global session store across requests in this Node process
const globalAuthSessions = new Map<string, PendingAuthSession>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || 'player@outlook.com';

    const sessionId = crypto.randomBytes(16).toString('hex');
    const sessionCacheDir = path.join(os.tmpdir(), `pocketafk_auth_${sessionId}`);

    const session: PendingAuthSession = {
      email,
      userCode: '',
      verificationUri: 'https://www.microsoft.com/link',
      status: 'pending',
      createdAt: Date.now(),
    };

    globalAuthSessions.set(sessionId, session);

    const options = {
      authTitle: Titles.MinecraftNintendoSwitch,
      deviceType: 'Nintendo',
      flow: 'live' as const,
    };

    // Initialize Authflow with onMsaCode callback
    const flow = new Authflow(email, sessionCacheDir, options, (data: any) => {
      session.userCode = data.user_code;
      session.verificationUri = data.verification_uri || 'https://www.microsoft.com/link';
    });

    // Start profile acquisition in background
    flow
      .getMinecraftJavaToken({ fetchProfile: true })
      .then((res: any) => {
        session.status = 'success';
        session.ign = res.profile?.name || email;
        session.uuid = res.profile?.id;
      })
      .catch((err: any) => {
        session.status = 'error';
        const msg = String(err?.message || err || '');
        if (msg.includes('owns Minecraft') || msg.includes('Not Found')) {
          session.error =
            'This Microsoft account does NOT own Minecraft Java Edition. Please log in with an account that owns the game.';
        } else {
          session.error = msg || 'Microsoft authentication failed';
        }
      });

    // Wait up to 4 seconds for userCode to be returned by Microsoft
    for (let i = 0; i < 40; i++) {
      if (session.userCode) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!session.userCode) {
      return NextResponse.json(
        { error: 'Microsoft device code generation timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json({
      sessionId,
      userCode: session.userCode,
      verificationUri: session.verificationUri,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = globalAuthSessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ status: 'error', error: 'Verification session expired' });
    }

    if (session.status === 'success') {
      // Clean up session
      globalAuthSessions.delete(sessionId);
      return NextResponse.json({
        status: 'success',
        ign: session.ign,
        uuid: session.uuid,
      });
    }

    if (session.status === 'error') {
      const err = session.error;
      globalAuthSessions.delete(sessionId);
      return NextResponse.json({
        status: 'error',
        error: err || 'Verification failed',
      });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message || 'Internal server error' }, { status: 500 });
  }
}
