import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PocketBotInstance } from '../bot/botInstance';

let lastNotificationTime = 0;
let lastNotificationPayload = '';

function getCachedUsername(): string {
  try {
    const home = process.env.HOME || '';
    const userFile = path.join(home, '.pocketafk_user');
    if (fs.existsSync(userFile)) {
      const u = fs.readFileSync(userFile, 'utf8').trim();
      if (u) return u;
    }
  } catch (e) {}
  return process.env.APP_USER || '';
}

function formatCompactUptime(sec: number): string {
  if (sec < 60) return '< 1m';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(sec / 3600);
  const remM = Math.floor((sec % 3600) / 60);
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

export function updateTermuxNotification(bots: PocketBotInstance[]) {
  // Throttle updates to prevent flooding
  const now = Date.now();
  if (now - lastNotificationTime < 1500) return;
  lastNotificationTime = now;

  const user = getCachedUsername();
  const userTag = user ? ` (@${user})` : '';

  const onlineBots = bots.filter((b) => b.state === 'SPAWNED' || b.state === 'LOGGED_IN');
  const connectingBots = bots.filter((b) => b.state === 'CONNECTING' || b.state === 'RECONNECTING');
  const count = onlineBots.length;

  let title = `PocketAFK • Standby${userTag}`;
  let content = '💤 Tunnel active | Ready for server connection';

  if (count === 1) {
    const bot = onlineBots[0];
    const ign = (bot.bot?.username || bot.config.username).split('@')[0];
    const srvHost = bot.config.host.replace(/^play\./i, '');
    const uptimeSec = bot.connectedAt ? Math.max(0, Math.floor((Date.now() - bot.connectedAt) / 1000)) : 0;
    const uptimeStr = formatCompactUptime(uptimeSec);

    title = `🟢 PocketAFK: 1 Bot Online${userTag}`;
    content = `[${ign}] on ${srvHost} • ${uptimeStr}`;
  } else if (count > 1) {
    title = `🟢 PocketAFK: ${count} Bots Online${userTag}`;
    content = onlineBots
      .map((b) => {
        const ign = (b.bot?.username || b.config.username).split('@')[0];
        const srv = b.config.host.replace(/^play\./i, '');
        const up = b.connectedAt ? formatCompactUptime(Math.floor((Date.now() - b.connectedAt) / 1000)) : '0s';
        return `${ign}@${srv} (${up})`;
      })
      .join(' | ');
  } else if (connectingBots.length > 0) {
    const srvs = Array.from(new Set(connectingBots.map((b) => b.config.host.replace(/^play\./i, '')))).join(', ');
    title = `🟡 PocketAFK: Connecting...${userTag}`;
    content = `Connecting to ${srvs}...`;
  }

  // NO-SPAM GUARD: If notification text hasn't changed, DO NOT call termux-notification at all!
  const payloadKey = `${title}:::${content}`;
  if (payloadKey === lastNotificationPayload) {
    return;
  }
  lastNotificationPayload = payloadKey;

  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedContent = content.replace(/"/g, '\\"');

  // --priority low: Keeps it quietly resting in the notification drawer without popping heads-up banners
  // --alert-once: Prevents sound, vibration, or re-alerting Android on status updates
  const cmd = `termux-notification --id pocketafk_status --title "${escapedTitle}" --content "${escapedContent}" --ongoing --priority low --alert-once 2>/dev/null`;

  exec(cmd, () => {
    // Silently ignore if termux-api is not installed
  });
}

export function clearTermuxNotification() {
  lastNotificationPayload = '';
  exec('termux-notification-remove pocketafk_status 2>/dev/null', () => {});
}
