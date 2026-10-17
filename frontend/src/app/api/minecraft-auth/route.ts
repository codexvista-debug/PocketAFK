import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLIENT_ID = '00000000402b5328';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

const XBOX_ERROR_MESSAGES: Record<number, string> = {
  2148916227: 'Your account was banned by Xbox for violating Community Standards.',
  2148916229: 'Your account has parental restrictions and requires guardian permission at account.microsoft.com/family.',
  2148916233: 'This Microsoft account does not have an Xbox gamer profile yet. Please visit xbox.com to create your free Xbox gamer profile.',
  2148916234: "Please log into xbox.com to accept Xbox's Terms of Service first.",
  2148916235: 'Xbox Live is not available in your region.',
  2148916236: 'Your account requires age verification at login.live.com.',
  2148916237: 'Your account has reached its daily playtime limit.',
  2148916238: 'Child account (under 18): must be added to a Microsoft Family to play online.',
};

// 1. Request 1-time Microsoft Device Code
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || '';

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('scope', SCOPE);
    params.append('response_type', 'device_code');

    const res = await fetch('https://login.live.com/oauth20_connect.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[MinecraftAuth GET] Error response from Microsoft:', res.status, errText);
      return NextResponse.json({ error: 'Failed to initiate Microsoft device code flow' }, { status: 502 });
    }

    const data = await res.json();
    const userCode: string = data.user_code;
    const deviceCode: string = data.device_code;
    const expiresIn: number = data.expires_in || 900;
    const interval: number = data.interval || 4;

    let verificationUri = data.verification_uri || 'https://www.microsoft.com/link';
    if (userCode) {
      // Pre-fill the userCode so the user doesn't even have to paste it!
      verificationUri = `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}`;
      if (email && email.trim()) {
        verificationUri += `&login_hint=${encodeURIComponent(email.trim())}`;
      }
      verificationUri += `&prompt=select_account`;
    }

    return NextResponse.json({
      success: true,
      userCode,
      deviceCode,
      verificationUri,
      expiresIn,
      interval,
    });
  } catch (err: any) {
    console.error('[MinecraftAuth GET] Exception:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

// 2. Poll Microsoft for completion and acquire official Minecraft Java profile
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceCode } = body;

    if (!deviceCode) {
      return NextResponse.json({ error: 'deviceCode is required' }, { status: 400 });
    }

    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', CLIENT_ID);
    tokenParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
    tokenParams.append('device_code', deviceCode);

    const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MinecraftLauncher/2.2.10675',
      },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      const errCode = errorData.error;

      if (errCode === 'authorization_pending') {
        return NextResponse.json({ status: 'pending' });
      }
      if (errCode === 'slow_down') {
        return NextResponse.json({ status: 'pending', slowDown: true });
      }
      if (errCode === 'expired_token') {
        return NextResponse.json({
          status: 'error',
          error: 'Verification code expired. Please generate a new code.',
        });
      }

      return NextResponse.json({
        status: 'error',
        error: errorData.error_description || errCode || 'Microsoft authorization failed',
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ status: 'error', error: 'Missing access token in Microsoft response' });
    }

    // A. Authenticate with Xbox Live User Token
    let userToken = '';
    let userHash = '';
    let lastXblErrorText = '';

    for (const prefix of ['t=', 'd=', '']) {
      try {
        const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'MinecraftLauncher/2.2.10675',
            'x-xbl-contract-version': '1',
          },
          body: JSON.stringify({
            Properties: {
              AuthMethod: 'RPS',
              SiteName: 'user.auth.xboxlive.com',
              RpsTicket: `${prefix}${accessToken}`,
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (xblRes.ok) {
          const xblData = await xblRes.json();
          userToken = xblData.Token;
          userHash = xblData.DisplayClaims?.xui?.[0]?.uhs || '';
          if (userToken) break;
        } else {
          lastXblErrorText = await xblRes.text();
        }
      } catch (err: any) {
        // continue trying next prefix
      }
    }

    if (!userToken) {
      let errMsg = 'Xbox Live authentication failed. Please ensure your Microsoft account has an active Xbox profile at xbox.com.';
      try {
        const parsed = JSON.parse(lastXblErrorText);
        if (parsed.XErr && XBOX_ERROR_MESSAGES[parsed.XErr]) {
          errMsg = XBOX_ERROR_MESSAGES[parsed.XErr];
        } else if (parsed.Message) {
          errMsg = parsed.Message;
        }
      } catch {}
      return NextResponse.json({ status: 'error', error: errMsg });
    }

    // B. Request XSTS Token for Minecraft Java Services
    const javaXstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MinecraftLauncher/2.2.10675',
        'x-xbl-contract-version': '1',
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken],
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!javaXstsRes.ok) {
      const errJson = await javaXstsRes.json().catch(() => ({}));
      const errMsg = (errJson.XErr && XBOX_ERROR_MESSAGES[errJson.XErr]) ||
        'Failed to obtain Minecraft XSTS security token.';
      return NextResponse.json({ status: 'error', error: errMsg });
    }

    const javaXstsData = await javaXstsRes.json();
    const javaUhs = javaXstsData?.DisplayClaims?.xui?.[0]?.uhs || userHash;
    const javaXstsToken = javaXstsData.Token;

    // C. Exchange XSTS token for Mojang Minecraft access token
    const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MinecraftLauncher/2.2.10675',
      },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${javaUhs};${javaXstsToken}`,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!mcLoginRes.ok) {
      return NextResponse.json({
        status: 'error',
        error: 'Failed to authenticate with Minecraft Services.',
      });
    }

    const mcLoginData = await mcLoginRes.json();
    const mcToken = mcLoginData.access_token;

    // D. Fetch official Minecraft Java Profile
    const mcProfileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        Authorization: `Bearer ${mcToken}`,
        'User-Agent': 'MinecraftLauncher/2.2.10675',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (mcProfileRes.status === 404) {
      return NextResponse.json({
        status: 'error',
        error: 'This Microsoft account does NOT own Minecraft Java Edition. Please log in with an account that purchased Minecraft Java.',
      });
    }

    if (!mcProfileRes.ok) {
      return NextResponse.json({
        status: 'error',
        error: 'Failed to retrieve Minecraft Java player profile.',
      });
    }

    const mcProfile = await mcProfileRes.json();
    if (!mcProfile?.name) {
      return NextResponse.json({
        status: 'error',
        error: 'No Java in-game username found for this Microsoft account.',
      });
    }

    return NextResponse.json({
      status: 'success',
      ign: mcProfile.name,
      uuid: mcProfile.id,
      tokenCache: {
        live: {
          token: {
            token_type: 'bearer',
            expires_in: tokenData.expires_in || 86400,
            scope: SCOPE,
            access_token: accessToken,
            refresh_token: tokenData.refresh_token,
            user_id: tokenData.user_id,
          },
        },
        mca: {
          token: mcToken,
          expire: Date.now() + 86400000,
          profile: {
            id: mcProfile.id,
            name: mcProfile.name,
          },
        },
      },
    });
  } catch (err: any) {
    console.error('[MinecraftAuth POST] Exception:', err);
    return NextResponse.json({ status: 'error', error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
