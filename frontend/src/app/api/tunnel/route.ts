import { NextRequest, NextResponse } from 'next/server';

// In-memory tunnel store for instant automatic pairing
let globalTunnel = {
  url: '',
  token: '',
  updatedAt: 0,
};

export async function GET() {
  return NextResponse.json(globalTunnel, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, token } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    // Ensure format is wss://
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('https://')) {
      cleanUrl = cleanUrl.replace('https://', 'wss://');
    }

    globalTunnel = {
      url: cleanUrl,
      token: typeof token === 'string' ? token.trim() : '',
      updatedAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      message: 'Tunnel paired successfully',
      data: globalTunnel,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
