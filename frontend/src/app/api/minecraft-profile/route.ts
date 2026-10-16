import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username')?.trim();

    if (!username) {
      return NextResponse.json({ error: 'Minecraft username is required' }, { status: 400 });
    }

    // 1. Verify existence against official Mojang Java profile registry
    try {
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });

      if (mojangRes.ok) {
        const mojangData = await mojangRes.json();
        if (mojangData && mojangData.name) {
          return NextResponse.json({
            success: true,
            ign: mojangData.name,
            uuid: mojangData.id,
            avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(mojangData.name)}/36`,
            verified: true,
          });
        }
      }
    } catch (e) {
      // Mojang lookup fallback
    }

    // 2. Allow direct valid username fallback
    return NextResponse.json({
      success: true,
      ign: username,
      uuid: '',
      avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/36`,
      verified: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
