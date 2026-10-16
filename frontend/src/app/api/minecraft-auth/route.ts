import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLIENT_ID = '00000000441cc96b'; // Nintendo Switch Minecraft Client ID (Supports device code)

export async function GET() {
  try {
    const res = await fetch('https://login.live.com/oauth20_connect.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: 'service::user.auth.xboxlive.com::MBI_SSL',
        response_type: 'device_code',
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to request Microsoft device code' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      userCode: data.user_code,
      deviceCode: data.device_code,
      verificationUri: data.verification_uri || 'https://www.microsoft.com/link',
      expiresIn: data.expires_in || 900,
      interval: data.interval || 5,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Network error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { deviceCode } = await req.json();

    if (!deviceCode) {
      return NextResponse.json({ error: 'deviceCode is required' }, { status: 400 });
    }

    // Step 1: Check Live Token
    const tokenRes = await fetch(`https://login.live.com/oauth20_token.srf?client_id=${CLIENT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
      cache: 'no-store',
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      if (tokenData.error === 'authorization_pending') {
        return NextResponse.json({ status: 'pending' });
      }
      return NextResponse.json({
        status: 'error',
        error: tokenData.error_description || tokenData.error,
      });
    }

    const msaToken = tokenData.access_token;

    // Step 2: Xbox User Token
    const xboxRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${msaToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      }),
      cache: 'no-store',
    });

    const xboxData = await xboxRes.json();
    if (!xboxRes.ok || !xboxData.Token) {
      return NextResponse.json({ status: 'error', error: 'Failed to authenticate with Xbox Live.' });
    }

    const userToken = xboxData.Token;
    const userHash = xboxData.DisplayClaims?.xui?.[0]?.uhs;

    // Step 3: XSTS Token for Minecraft
    const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken],
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT',
      }),
      cache: 'no-store',
    });

    const xstsData = await xstsRes.json();
    if (!xstsRes.ok || !xstsData.Token) {
      const errCode = xstsData['XErr'];
      if (errCode === 2148916233) {
        return NextResponse.json({
          status: 'error',
          error: 'This Microsoft account does not have an Xbox Live profile. Please create one at xbox.com first.',
        });
      }
      return NextResponse.json({
        status: 'error',
        error: xstsData.Message || 'Failed to authorize with Minecraft services.',
      });
    }

    const xstsToken = xstsData.Token;

    // Step 4: Login with Xbox to Minecraft Services
    const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
      }),
      cache: 'no-store',
    });

    const mcLoginData = await mcLoginRes.json();
    if (!mcLoginRes.ok || !mcLoginData.access_token) {
      return NextResponse.json({ status: 'error', error: 'Failed to log in to Minecraft Services.' });
    }

    const mcAccessToken = mcLoginData.access_token;

    // Step 5: Fetch Minecraft Java Profile
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        Authorization: `Bearer ${mcAccessToken}`,
      },
      cache: 'no-store',
    });

    if (profileRes.status === 404) {
      return NextResponse.json({
        status: 'error',
        error: 'This Microsoft account does NOT own Minecraft Java Edition. Please log in with an account that purchased Minecraft Java.',
      });
    }

    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData.name) {
      return NextResponse.json({ status: 'error', error: 'Failed to fetch Minecraft profile.' });
    }

    // Success! Return verified IGN and UUID
    return NextResponse.json({
      status: 'success',
      ign: profileData.name,
      uuid: profileData.id,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message || 'Internal server error' }, { status: 500 });
  }
}
