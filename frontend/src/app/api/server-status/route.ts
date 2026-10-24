import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CachedStatus = { expiresAt: number; payload: { online: boolean; players: { online: number; max: number } | null } };
const statusCache = new Map<string, CachedStatus>();

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host')?.trim();
  if (!host || host.length > 253 || !/^[a-zA-Z0-9._:\-[\]]+$/.test(host)) {
    return NextResponse.json({ error: 'A valid Minecraft server host is required' }, { status: 400 });
  }

  const cached = statusCache.get(host.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, { headers: { 'Cache-Control': 'public, max-age=30' } });
  }

  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'PocketAFK/1.0 (+https://pocketafk.vercel.app)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Status provider returned ${response.status}`);
    const data = await response.json();
    const payload = {
      online: data.online === true,
      players: data.online === true && Number.isFinite(data.players?.online) && Number.isFinite(data.players?.max)
        ? { online: data.players.online, max: data.players.max }
        : null,
    };
    statusCache.set(host.toLowerCase(), { payload, expiresAt: Date.now() + 30_000 });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch {
    return NextResponse.json({ online: false, players: null }, { status: 200, headers: { 'Cache-Control': 'public, max-age=15' } });
  }
}
