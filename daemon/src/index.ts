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
const AUTH_TOKEN = process.env.DAEMON_AUTH_TOKEN || '';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    service: 'PocketAFK Daemon', 
    status: 'running', 
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

  // If no auth token is configured in .env, allow all connections
  if (!AUTH_TOKEN) {
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
        if (!AUTH_TOKEN || parsed.payload.token === AUTH_TOKEN) {
          authenticatedClients.add(ws);
          ws.send(JSON.stringify({
            type: 'AUTH_RESULT',
            payload: { success: true, message: 'Authentication successful' }
          }));
          console.log(chalk.green(`[Auth] Client authenticated successfully`));
          
          // Sync current states
          botManager.handleClientMessage({ type: 'REQUEST_SYNC' });
        } else {
          ws.send(JSON.stringify({
            type: 'AUTH_RESULT',
            payload: { success: false, message: 'Invalid authentication token' }
          }));
          console.log(chalk.red(`[Auth] Client failed authentication: invalid token`));
        }
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
