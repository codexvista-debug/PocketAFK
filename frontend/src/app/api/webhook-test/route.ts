import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, type, username } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Webhook URL is required.' }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('https://discord.com/api/webhooks/') && !trimmedUrl.startsWith('https://discordapp.com/api/webhooks/')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL. Must be an official Discord webhook starting with https://discord.com/api/webhooks/...',
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    let embedPayload: any;

    if (type === 'daemon') {
      embedPayload = {
        username: 'PocketAFK Daemon Bridge',
        avatar_url: 'https://raw.githubusercontent.com/codexvista-debug/PocketAFK/main/frontend/public/icon.png',
        embeds: [
          {
            title: '⚡ PocketAFK Daemon Connected',
            description: `Your PocketAFK background daemon bridge is online and active! Discord alerts for this bridge are verified.`,
            color: 0x10b981, // Emerald 500
            fields: [
              {
                name: 'System Status',
                value: '🟢 Online & Ready',
                inline: true,
              },
              {
                name: 'Configured User',
                value: `@${username || 'Opera'}`,
                inline: true,
              },
              {
                name: 'Heartbeat Frequency',
                value: 'Every 1 Hour',
                inline: true,
              },
              {
                name: 'Monitored Events',
                value: '• Daemon Startup\n• Tunnel Dropouts\n• Uncaught Exceptions\n• Supervisor Restarts',
                inline: false,
              },
            ],
            footer: {
              text: 'PocketAFK Daemon Bridge • Termux & Linux Dedicated',
            },
            timestamp: nowIso,
          },
        ],
      };
    } else {
      // Global Bot Webhook Test
      embedPayload = {
        username: 'PocketAFK Bot Activity',
        avatar_url: 'https://crafthead.net/helm/Steve/64',
        embeds: [
          {
            title: '🎮 PocketAFK All-in-One Bot Webhook Verified',
            description: `This Discord webhook is successfully connected! It will serve as the **unified alert channel** for **all your Minecraft accounts** across every server profile.`,
            color: 0x6366f1, // Indigo 500
            fields: [
              {
                name: 'Channel Scope',
                value: '🌐 All Bots & Accounts (Unified)',
                inline: true,
              },
              {
                name: 'Live Status',
                value: '⚡ Ready to receive alerts',
                inline: true,
              },
              {
                name: 'Configured Owner',
                value: `@${username || 'Opera'}`,
                inline: true,
              },
              {
                name: 'Configured Bot Events',
                value: '🟢 **Bot Joined & Spawned** in server\n🔴 **Bot Disconnected / Kicked** with reason\n🎁 **AFK Reward / Spin Available** alert\n⏱️ **Periodic Uptime & Coordinates** digest\n💬 **Direct Player Whispers & Mentions**\n❤️ **Low Health / Respawn** warnings',
                inline: false,
              },
            ],
            thumbnail: {
              url: 'https://minotar.net/helm/MHF_Steve/64.png',
            },
            footer: {
              text: 'PocketAFK Bedrock & Java Core • Unified Bot Notifications',
            },
            timestamp: nowIso,
          },
        ],
      };
    }

    const discordRes = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedPayload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `Discord responded with status ${discordRes.status}: ${errText || 'Failed to send message.'}`,
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Test alert delivered to your Discord channel!' });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Internal server error while reaching Discord.',
    }, { status: 500 });
  }
}
