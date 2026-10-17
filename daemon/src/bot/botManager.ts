import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import { Authflow, Titles } from 'prismarine-auth';
const minecraftFolderPath = require('minecraft-folder-path');
import { BotConfig, ClientMessage, DaemonMessage } from '../types';
import { PocketBotInstance } from './botInstance';
import { updateTermuxNotification, clearTermuxNotification } from '../utils/termuxNotification';
import { getAndSyncTokenFolder, ensureTokenAliases, backupTokens, computeNameHash } from './tokenManager';

export class BotManager {
  private bots: Map<string, PocketBotInstance> = new Map();
  private broadcastFn: (msg: DaemonMessage) => void;

  constructor(broadcastFn: (msg: DaemonMessage) => void) {
    this.broadcastFn = (msg: DaemonMessage) => {
      broadcastFn(msg);
      if (msg.type === 'BOT_STATE') {
        updateTermuxNotification(this.getAllBots());
      }
    };
    setInterval(() => {
      updateTermuxNotification(this.getAllBots());
    }, 60000);
    updateTermuxNotification([]);
  }

  public getBot(id: string): PocketBotInstance | undefined {
    return this.bots.get(id);
  }

  public getAllBots(): PocketBotInstance[] {
    return Array.from(this.bots.values());
  }

  public startBot(config: BotConfig): PocketBotInstance {
    let instance = this.bots.get(config.id);
    if (instance) {
      instance.stop();
    }

    instance = new PocketBotInstance(config, (msg) => this.broadcastFn(msg));
    this.bots.set(config.id, instance);
    instance.start();
    return instance;
  }

  public stopBot(idOrName: string) {
    if (!idOrName) return;
    const target = idOrName.toLowerCase();

    // 1. Direct match by exact key/botId (most common and specific)
    const directBot = this.bots.get(idOrName);
    if (directBot) {
      directBot.stop();
      this.bots.delete(idOrName);
      updateTermuxNotification(this.getAllBots());
      return;
    }

    // 2. Case-insensitive match by botId
    for (const [bId, instance] of Array.from(this.bots.entries())) {
      if (bId.toLowerCase() === target) {
        instance.stop();
        this.bots.delete(bId);
        updateTermuxNotification(this.getAllBots());
        return;
      }
    }

    // 3. If stopping an entire server (e.g. "srv_donutsmp"), stop all sub-bots belonging to that server
    let stoppedAny = false;
    for (const [bId, instance] of Array.from(this.bots.entries())) {
      if (bId.toLowerCase().startsWith(`${target}__`)) {
        instance.stop();
        this.bots.delete(bId);
        stoppedAny = true;
      }
    }
    if (stoppedAny) {
      updateTermuxNotification(this.getAllBots());
      return;
    }

    // 4. Fallback only if no bot was matched by ID: match by active bot IGN or username
    for (const [bId, instance] of Array.from(this.bots.entries())) {
      const cfgUser = instance.config?.username?.toLowerCase();
      const botUser = instance.bot?.username?.toLowerCase();
      if (cfgUser === target || botUser === target) {
        instance.stop();
        this.bots.delete(bId);
        updateTermuxNotification(this.getAllBots());
        return;
      }
    }

    updateTermuxNotification(this.getAllBots());
  }

  public async verifyAccount(accountId: string, email?: string) {
    const isNew = !email || email === 'new_account' || email.startsWith('acc_');
    const authKey = isNew ? `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : email;
    console.log(chalk.cyan(`[Auth] Initiating Microsoft Device Verification for ${authKey} (Account ID: ${accountId})...`));
    try {
      const profilesFolder = getAndSyncTokenFolder();

      // Clean up any bogus 'new_account' directory if present
      const staleNewAccFolder = path.join(profilesFolder, 'new_account');
      if (fs.existsSync(staleNewAccFolder)) {
        try { fs.rmSync(staleNewAccFolder, { recursive: true, force: true }); } catch (e) {}
      }

      const options = {
        authTitle: Titles.MinecraftNintendoSwitch,
        deviceType: 'Nintendo',
        flow: 'live' as const
      };

      const flow = new Authflow(authKey, profilesFolder, options, (data: any) => {
        console.log(chalk.yellow(`[Auth Code] Code for ${authKey}: ${data.user_code}`));
        const directUri = data.user_code
          ? `https://www.microsoft.com/link?otc=${encodeURIComponent(data.user_code)}`
          : (data.verification_uri || 'https://www.microsoft.com/link');
        this.broadcastFn({
          type: 'MS_AUTH_CODE',
          payload: {
            botId: accountId,
            userCode: data.user_code,
            url: directUri,
            message: data.message
          }
        });
      });

      const res = await flow.getMinecraftJavaToken({ fetchProfile: true });
      const realIgn = res?.profile?.name;
      if (!realIgn) {
        throw new Error('This Microsoft account does not have a Minecraft Java profile.');
      }
      const playerUuid = res?.profile?.id;

      // Ensure 90-day rolling token aliases are created for both realIgn and authKey
      ensureTokenAliases(profilesFolder, authKey, realIgn);
      ensureTokenAliases(profilesFolder, realIgn, authKey);
      backupTokens(profilesFolder);

      this.broadcastFn({
        type: 'ACCOUNT_VERIFIED',
        payload: {
          botId: accountId,
          email: isNew ? realIgn : (email || realIgn),
          ign: realIgn,
          uuid: playerUuid
        }
      });

      console.log(chalk.green(`[Auth Success] Verified as Java IGN: ${realIgn} (90-day session saved)`));
    } catch (err: any) {
      console.error(chalk.red(`[Auth Error] Failed to verify: ${err.message}`));
      this.broadcastFn({
        type: 'AUTH_RESULT',
        payload: { success: false, message: err.message || 'Microsoft authentication failed' }
      });
    }
  }

  public handleClientMessage(msg: ClientMessage) {
    switch (msg.type) {
      case 'START_BOT':
        this.startBot(msg.payload);
        break;

      case 'STOP_BOT': {
        const targetId = msg.payload.botId || (msg.payload as any).id || (msg.payload as any).username;
        if (targetId) {
          this.stopBot(targetId);
        }
        break;
      }

      case 'RESTART_BOT': {
        const bot = this.bots.get(msg.payload.botId);
        if (bot) {
          const config = bot.config;
          bot.stop();
          setTimeout(() => {
            this.startBot(config);
          }, 1000);
        }
        break;
      }

      case 'RESTART_DAEMON': {
        console.log(chalk.yellow('[Daemon] Full restart request received from dashboard. Terminating all bot instances...'));
        for (const [id, bot] of this.bots.entries()) {
          try {
            bot.stop();
          } catch (e) {}
        }
        this.bots.clear();
        this.broadcastFn({
          type: 'AUTH_RESULT',
          payload: { success: true, message: 'Daemon reset successfully: all bot instances cleared.' }
        });
        if (process.env.TERMUX_SUPERVISOR === '1') {
          setTimeout(() => {
            process.exit(42);
          }, 600);
        }
        break;
      }

      case 'SEND_CHAT': {
        const { botId, message, targetAccount } = msg.payload;
        // 1. If botId matches a direct bot instance:
        if (botId && botId !== 'all') {
          const directBot = this.bots.get(botId);
          if (directBot) {
            directBot.chat(message);
            break;
          }

          // 2. If botId is a server profile ID (e.g. "srv_donutsmp"), find sub-bots (e.g. "srv_donutsmp__acc1")
          const lower = (targetAccount && targetAccount !== 'all') ? targetAccount.toLowerCase() : null;
          const serverBots = Array.from(this.bots.entries())
            .filter(([bId]) => bId.startsWith(`${botId}__`))
            .map(([, b]) => b);

          if (serverBots.length > 0) {
            if (lower) {
              const matched = serverBots.find(
                (b) =>
                  b.config.username.toLowerCase() === lower ||
                  b.bot?.username?.toLowerCase() === lower ||
                  b.config.accountId?.toLowerCase() === lower
              );
              if (matched) {
                matched.chat(message);
                break;
              }
            }
            // If all or no specific targetAccount, chat on all bots for this server
            for (const b of serverBots) {
              b.chat(message);
            }
            break;
          }
        }

        // 3. Fallback only if botId is 'all' or missing
        if (targetAccount && targetAccount !== 'all') {
          const lower = targetAccount.toLowerCase();
          for (const b of this.bots.values()) {
            if (
              b.config.username.toLowerCase() === lower ||
              b.bot?.username?.toLowerCase() === lower ||
              b.config.id.toLowerCase() === lower
            ) {
              b.chat(message);
            }
          }
        } else {
          for (const bot of this.bots.values()) {
            bot.chat(message);
          }
        }
        break;
      }

      case 'CLICK_SLOT': {
        const bot = this.bots.get(msg.payload.botId);
        if (bot) {
          bot.clickSlot(msg.payload.slot, msg.payload.mouseButton || 0, msg.payload.mode || 0);
        }
        break;
      }

      case 'CLOSE_WINDOW': {
        const bot = this.bots.get(msg.payload.botId);
        if (bot) {
          bot.closeCurrentWindow();
        }
        break;
      }

      case 'UPDATE_SETTINGS': {
        const bot = this.bots.get(msg.payload.botId);
        if (bot) {
          bot.updateSettings(msg.payload.settings);
        }
        break;
      }

      case 'VERIFY_ACCOUNT': {
        this.verifyAccount(msg.payload.accountId, msg.payload.email);
        break;
      }

      case 'IMPORT_ACCOUNT_TOKENS': {
        const { ign, tokenCache } = msg.payload || {};
        if (ign && tokenCache) {
          const profilesFolder = getAndSyncTokenFolder();
          const ignHash = computeNameHash(ign);
          const lowerHash = computeNameHash(ign.toLowerCase());

          if (tokenCache.live) {
            fs.writeFileSync(path.join(profilesFolder, `${ignHash}_live-cache.json`), JSON.stringify(tokenCache.live));
            fs.writeFileSync(path.join(profilesFolder, `${lowerHash}_live-cache.json`), JSON.stringify(tokenCache.live));
          }
          if (tokenCache.mca) {
            fs.writeFileSync(path.join(profilesFolder, `${ignHash}_mca-cache.json`), JSON.stringify(tokenCache.mca));
            fs.writeFileSync(path.join(profilesFolder, `${lowerHash}_mca-cache.json`), JSON.stringify(tokenCache.mca));
          }
          ensureTokenAliases(profilesFolder, ign);
          backupTokens(profilesFolder);
          console.log(chalk.green(`[Auth] Imported 90-day Microsoft token session for @${ign}`));
        }
        break;
      }

      case 'REQUEST_SYNC': {
        for (const bot of this.bots.values()) {
          const uptime = bot.connectedAt ? Math.floor((Date.now() - bot.connectedAt) / 1000) : 0;
          const detectedVer = bot.bot?.version || (bot.bot as any)?._client?.version || (bot.config.version !== 'auto' ? bot.config.version : undefined);
          this.broadcastFn({
            type: 'BOT_STATE',
            payload: {
              botId: bot.config.id,
              serverId: bot.config.serverId,
              username: bot.config.username,
              accountId: bot.config.accountId,
              state: bot.state,
              connectedAt: bot.connectedAt || 0,
              uptime,
              version: detectedVer,
            }
          });
          bot.emitTelemetry();

          // Replay recent live server chat messages so newly connected clients see immediate history
          if (bot.recentMessages && bot.recentMessages.length > 0) {
            for (const msg of bot.recentMessages.slice(-5)) {
              this.broadcastFn({
                type: 'CHAT_MESSAGE',
                payload: msg
              });
            }
          }
        }
        break;
      }
    }
  }
}
