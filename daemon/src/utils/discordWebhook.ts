import https from 'https';
import http from 'http';
import { URL } from 'url';
import chalk from 'chalk';
import { WebhookConfig, DEFAULT_WEBHOOK_CONFIG } from '../types';

let currentWebhookConfig: WebhookConfig = { ...DEFAULT_WEBHOOK_CONFIG };
let lastRewardAlertTimes: Record<string, number> = {};

export function setDaemonWebhookConfig(config: WebhookConfig) {
  currentWebhookConfig = {
    ...DEFAULT_WEBHOOK_CONFIG,
    ...config,
  };
  console.log(chalk.cyan(`[Discord Webhook] Config updated: Daemon alerts=${currentWebhookConfig.daemonEnabled}, Bot alerts=${currentWebhookConfig.botEnabled}`));
}

export function getDaemonWebhookConfig(): WebhookConfig {
  return currentWebhookConfig;
}

/**
 * Dispatch JSON payload to Discord webhook URL using native fetch or https.request
 */
export async function postDiscordWebhook(webhookUrl: string, payload: any): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) return false;

  const bodyStr = JSON.stringify(payload);

  // If global fetch is available (Node 18+)
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
      return res.ok;
    } catch (err: any) {
      console.warn(chalk.yellow(`[Discord Webhook Warning] fetch failed: ${err?.message || err}`));
    }
  }

  // Fallback to https.request
  return new Promise((resolve) => {
    try {
      const parsed = new URL(webhookUrl.trim());
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
          },
          timeout: 8000,
        },
        (res) => {
          resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
        }
      );

      req.on('error', (e) => {
        console.warn(chalk.yellow(`[Discord Webhook Warning] request failed: ${e.message}`));
        resolve(false);
      });

      req.write(bodyStr);
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Send Daemon System Event to Discord
 */
export async function notifyDaemonEvent(
  event: 'online' | 'offline' | 'error' | 'heartbeat',
  data: { owner?: string; port?: number; errorMsg?: string; activeBotsCount?: number }
) {
  if (!currentWebhookConfig.daemonEnabled || !currentWebhookConfig.daemonWebhookUrl) return;

  if (event === 'online' && !currentWebhookConfig.daemonNotifyOnline) return;
  if (event === 'offline' && !currentWebhookConfig.daemonNotifyOffline) return;
  if (event === 'error' && !currentWebhookConfig.daemonNotifyErrors) return;
  if (event === 'heartbeat' && !currentWebhookConfig.daemonNotifyHeartbeat) return;

  const now = new Date().toISOString();

  let title = '⚡ PocketAFK Daemon Online';
  let desc = 'The PocketAFK background daemon is running and ready for Minecraft bot connections.';
  let color = 0x10b981; // Green

  if (event === 'offline') {
    title = '🔴 PocketAFK Daemon Offline';
    desc = 'The daemon process has stopped or bridge connection was terminated.';
    color = 0xef4444; // Red
  } else if (event === 'error') {
    title = '⚠️ PocketAFK Daemon Warning / Error';
    desc = data.errorMsg || 'A system exception or server proxy dropout occurred.';
    color = 0xf59e0b; // Amber
  } else if (event === 'heartbeat') {
    title = '💓 PocketAFK Daemon Heartbeat';
    desc = `Background daemon bridge is healthy. Currently managing **${data.activeBotsCount || 0} active bots**.`;
    color = 0x3b82f6; // Blue
  }

  const payload = {
    username: 'PocketAFK Daemon Bridge',
    embeds: [
      {
        title,
        description: desc,
        color,
        fields: [
          { name: 'Owner', value: `@${data.owner || 'Opera'}`, inline: true },
          { name: 'Status', value: event.toUpperCase(), inline: true },
          { name: 'Active Bots', value: `${data.activeBotsCount || 0}`, inline: true },
        ],
        footer: { text: 'PocketAFK Daemon • Termux & Linux Dedicated' },
        timestamp: now,
      },
    ],
  };

  await postDiscordWebhook(currentWebhookConfig.daemonWebhookUrl, payload);
}

/**
 * Send Minecraft Bot Activity to the Single Unified Bot Webhook
 */
export async function notifyBotEvent(
  event: 'joined' | 'disconnected' | 'reward' | 'uptime' | 'mention' | 'low_health',
  data: {
    username: string;
    serverHost: string;
    reason?: string;
    rewardText?: string;
    coordinates?: string;
    health?: number;
    sender?: string;
    message?: string;
    activeBots?: Array<{ username: string; host: string; uptime: string }>;
  }
) {
  if (!currentWebhookConfig.botEnabled || !currentWebhookConfig.botWebhookUrl) return;

  if (event === 'joined' && !currentWebhookConfig.botNotifyJoined) return;
  if (event === 'disconnected' && !currentWebhookConfig.botNotifyDisconnected) return;
  if (event === 'reward' && !currentWebhookConfig.botNotifyAfkReward) return;
  if (event === 'uptime' && !currentWebhookConfig.botNotifyUptime) return;
  if (event === 'mention' && !currentWebhookConfig.botNotifyChatMentions) return;
  if (event === 'low_health' && !currentWebhookConfig.botNotifyLowHealth) return;

  const now = new Date().toISOString();
  const cleanIgn = data.username.split('@')[0];

  let title = `🟢 Bot Joined • ${cleanIgn}`;
  let desc = `**${cleanIgn}** successfully spawned into **${data.serverHost}** and is now AFK.`;
  let color = 0x22c55e; // Green
  let fields: any[] = [
    { name: 'Account', value: cleanIgn, inline: true },
    { name: 'Server', value: data.serverHost, inline: true },
    { name: 'Status', value: '🟢 Spawned & Active', inline: true },
  ];

  if (event === 'disconnected') {
    title = `🔴 Bot Disconnected • ${cleanIgn}`;
    desc = `**${cleanIgn}** was disconnected from **${data.serverHost}**.`;
    color = 0xef4444; // Red
    fields = [
      { name: 'Account', value: cleanIgn, inline: true },
      { name: 'Server', value: data.serverHost, inline: true },
      { name: 'Reason', value: data.reason ? `\`${data.reason}\`` : 'Disconnected by server / timeout', inline: false },
    ];
  } else if (event === 'reward') {
    // Throttle rewards for same account to once every 2 minutes
    const k = `${cleanIgn}_${data.serverHost}`;
    const last = lastRewardAlertTimes[k] || 0;
    if (Date.now() - last < 120000) return;
    lastRewardAlertTimes[k] = Date.now();

    title = `🎁 AFK Reward Available • ${cleanIgn}`;
    desc = `**${cleanIgn}** detected an AFK reward notification on **${data.serverHost}**!`;
    color = 0xf59e0b; // Amber
    fields = [
      { name: 'Account', value: cleanIgn, inline: true },
      { name: 'Server', value: data.serverHost, inline: true },
      { name: 'Reward Notice', value: data.rewardText ? `\`${data.rewardText}\`` : 'AFK Reward / Spin is ready!', inline: false },
    ];
  } else if (event === 'uptime') {
    title = `⏱️ Bot Uptime Summary`;
    desc = `All-in-one status digest for active Minecraft AFK bots:`;
    color = 0x6366f1; // Indigo
    fields = (data.activeBots || []).map((b) => ({
      name: b.username,
      value: `Server: ${b.host} | Uptime: ${b.uptime}`,
      inline: false,
    }));
    if (fields.length === 0) {
      fields = [{ name: 'Active Bots', value: 'No bots currently online.', inline: false }];
    }
  } else if (event === 'mention') {
    title = `💬 Player Mention / Whisper • ${cleanIgn}`;
    desc = `**${data.sender || 'Unknown'}** sent a message to **${cleanIgn}** on **${data.serverHost}**:`;
    color = 0xa855f7; // Purple
    fields = [
      { name: 'Sender', value: data.sender || 'Player', inline: true },
      { name: 'Account', value: cleanIgn, inline: true },
      { name: 'Message', value: `\`${data.message || ''}\``, inline: false },
    ];
  } else if (event === 'low_health') {
    title = `❤️ Low Health Alert • ${cleanIgn}`;
    desc = `**${cleanIgn}** health dropped to **${data.health || 0} HP** on **${data.serverHost}**!`;
    color = 0xe11d48; // Rose
    fields = [
      { name: 'Account', value: cleanIgn, inline: true },
      { name: 'Server', value: data.serverHost, inline: true },
      { name: 'Current Health', value: `${data.health || 0} / 20 HP`, inline: true },
    ];
  }

  const payload = {
    username: 'PocketAFK Bot Activity',
    avatar_url: `https://crafthead.net/helm/${encodeURIComponent(cleanIgn)}/64`,
    embeds: [
      {
        title,
        description: desc,
        color,
        fields,
        thumbnail: {
          url: `https://crafthead.net/helm/${encodeURIComponent(cleanIgn)}/64`,
        },
        footer: { text: 'PocketAFK All-in-One Bot Webhook' },
        timestamp: now,
      },
    ],
  };

  await postDiscordWebhook(currentWebhookConfig.botWebhookUrl, payload);
}
