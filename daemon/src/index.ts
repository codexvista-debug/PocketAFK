import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { BotManager } from './bot/botManager';
import { ClientMessage, DaemonMessage } from './types';
import { clearTermuxNotification } from './utils/termuxNotification';

dotenv.config();

process.on('SIGINT', () => {
  clearTermuxNotification();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearTermuxNotification();
  process.exit(0);
});

// Protect daemon from crashing on server proxy packet anomalies or queue timeouts
process.on('uncaughtException', (err: any) => {
  console.error(chalk.yellow(`[PocketAFK Daemon Exception Guard] ${err?.message || err}`));
  if (err?.stack && !err.message?.includes("reading 'id'")) {
    console.error(chalk.gray(err.stack));
  }
});

process.on('unhandledRejection', (reason: any) => {
  console.warn(chalk.yellow(`[PocketAFK Daemon Warning] Unhandled Rejection: ${reason}`));
});

const PORT = parseInt(process.env.PORT || '8080', 10);
const AUTH_TOKEN = (process.env.DAEMON_AUTH_TOKEN || '').trim();
const DAEMON_OWNER = (process.env.POCKETAFK_OWNER || '').trim();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    service: 'PocketAFK Daemon', 
    status: 'running', 
    owner: DAEMON_OWNER || 'unrestricted',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now() 
  }));
});

const wss = new WebSocketServer({ server });
const authenticatedClients = new Set<WebSocket>();

function broadcast(message: DaemonMessage) {
  const json = JSON.stringify(message);
  for (const client of authenticatedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

const botManager = new BotManager(broadcast);

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress;
  console.log(chalk.gray(`[Connection] New WebSocket connected from ${ip}`));

  // If no auth token and no owner are configured, allow connection
  if (!AUTH_TOKEN && !DAEMON_OWNER) {
    authenticatedClients.add(ws);
    ws.send(JSON.stringify({
      type: 'AUTH_RESULT',
      payload: { success: true, message: 'Connected without authentication requirement.' }
    }));
  }

  // Ping / Pong liveness tracking
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 15000);

  ws.on('message', (data: Buffer | string) => {
    try {
      const parsed: ClientMessage = JSON.parse(data.toString());

      // Handle Authentication
      if (parsed.type === 'AUTH') {
        const clientUser = (parsed.payload.username || '').trim().toLowerCase();
        const clientToken = (parsed.payload.token || '').trim();

        // 1. Verify user identity against daemon owner
        if (DAEMON_OWNER && (!clientUser || clientUser !== DAEMON_OWNER.toLowerCase())) {
          console.warn(chalk.red(`[Security Alert] Blocked connection from user @${clientUser || 'anonymous'}: Daemon is dedicated to @${DAEMON_OWNER}`));
          ws.send(JSON.stringify({
            type: 'AUTH_RESULT',
            payload: { success: false, message: `Access Denied: This phone daemon belongs exclusively to @${DAEMON_OWNER}` }
          }));
          ws.close();
          return;
        }

        // 2. Verify auth token if configured
        if (AUTH_TOKEN && clientToken !== AUTH_TOKEN) {
          console.warn(chalk.red(`[Security Alert] Blocked connection with invalid token for user @${clientUser || 'unknown'}`));
          ws.send(JSON.stringify({
            type: 'AUTH_RESULT',
            payload: { success: false, message: 'Invalid daemon authentication token' }
          }));
          ws.close();
          return;
        }

        authenticatedClients.add(ws);
        ws.send(JSON.stringify({
          type: 'AUTH_RESULT',
          payload: { success: true, message: 'Authentication successful' }
        }));
        console.log(chalk.green(`[Auth] Client authenticated successfully for @${clientUser || DAEMON_OWNER || 'guest'}`));
        
        // Sync current states
        botManager.handleClientMessage({ type: 'REQUEST_SYNC' });
        return;
      }

      // Check if client is authenticated before executing bot actions
      if (!authenticatedClients.has(ws)) {
        ws.send(JSON.stringify({
          type: 'AUTH_RESULT',
          payload: { success: false, message: 'Unauthorized. Send AUTH first.' }
        }));
        return;
      }

      // Forward to bot manager
      botManager.handleClientMessage(parsed);
    } catch (err: any) {
      console.error(chalk.red(`[Error] Failed to process message: ${err.message}`));
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    authenticatedClients.delete(ws);
    console.log(chalk.gray(`[Connection] WebSocket disconnected (${ip})`));
  });

  ws.on('error', (err) => {
    console.error(chalk.red(`[Socket Error] ${err.message}`));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(chalk.cyan(`
  ╔═══════════════════════════════════════════════════╗
  ║                PocketAFK Daemon                   ║
  ║      Pure Java Mineflayer Stack for Termux        ║
  ╚═══════════════════════════════════════════════════╝
  `));
  console.log(chalk.green(`[Server] Listening on http://0.0.0.0:${PORT}`));
  console.log(chalk.yellow(`[Security] Auth token is ${AUTH_TOKEN ? 'ENABLED' : 'DISABLED (Open)'}`));
  console.log(chalk.blue(`[Tunnel] Ready for Cloudflare Tunnel connection:\n         cloudflared tunnel --url http://localhost:${PORT}\n`));
});
