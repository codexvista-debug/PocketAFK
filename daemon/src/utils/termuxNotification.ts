import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PocketBotInstance } from '../bot/botInstance';

let lastNotificationTime = 0;

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

export function updateTermuxNotification(bots: PocketBotInstance[]) {
  // Throttle updates to at most once every 2 seconds
  const now = Date.now();
  if (now - lastNotificationTime < 2000) return;
  lastNotificationTime = now;

  const user = getCachedUsername();
  const userTag = user ? ` (@${user})` : '';

  const onlineBots = bots.filter((b) => b.state === 'SPAWNED' || b.state === 'LOGGED_IN');
  const connectingBots = bots.filter((b) => b.state === 'CONNECTING' || b.state === 'RECONNECTING');
  const count = onlineBots.length;

  let title = `PocketAFK • Standby${userTag}`;
  let content = '💤 Tunnel active | Ready for server connection';

  if (count > 0) {
    const names = onlineBots.map((b) => b.bot?.username || b.config.username).join(', ');
    const srvs = Array.from(new Set(onlineBots.map((b) => b.config.host))).join(', ');
    title = `🟢 PocketAFK: ${count} Bot${count > 1 ? 's' : ''} Online${userTag}`;
    content = `[${names}] on ${srvs}`;
  } else if (connectingBots.length > 0) {
    const srvs = Array.from(new Set(connectingBots.map((b) => b.config.host))).join(', ');
    title = `🟡 PocketAFK: Connecting...${userTag}`;
    content = `Connecting to ${srvs}...`;
  }

  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedContent = content.replace(/"/g, '\\"');

  const cmd = `termux-notification --id pocketafk_status --title "${escapedTitle}" --content "${escapedContent}" --ongoing --priority high 2>/dev/null`;

  exec(cmd, () => {
    // Silently ignore if termux-api is not installed
  });
}

export function clearTermuxNotification() {
  exec('termux-notification-remove pocketafk_status 2>/dev/null', () => {});
}
