import path from 'path';
import chalk from 'chalk';
import { Authflow, Titles } from 'prismarine-auth';
const minecraftFolderPath = require('minecraft-folder-path');
import { BotConfig, ClientMessage, DaemonMessage } from '../types';
import { PocketBotInstance } from './botInstance';

export class BotManager {
  private bots: Map<string, PocketBotInstance> = new Map();
  private broadcastFn: (msg: DaemonMessage) => void;

  constructor(broadcastFn: (msg: DaemonMessage) => void) {
    this.broadcastFn = broadcastFn;
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

    // Direct match by key
    const directBot = this.bots.get(idOrName);
    if (directBot) {
      directBot.stop();
      this.bots.delete(idOrName);
    }

    // Match by ID, username, or active bot IGN
    for (const [bId, instance] of Array.from(this.bots.entries())) {
      const cfgUser = instance.config?.username?.toLowerCase();
      const botUser = instance.bot?.username?.toLowerCase();
      if (bId.toLowerCase() === target || cfgUser === target || botUser === target) {
        instance.stop();
        this.bots.delete(bId);
      }
    }
  }

  public async verifyAccount(accountId: string, email: string) {
    console.log(chalk.cyan(`[Auth] Initiating Microsoft Device Verification for ${email}...`));
    try {
      const profilesFolder = path.join(minecraftFolderPath, 'nmp-cache');
      const options = {
        authTitle: Titles.MinecraftNintendoSwitch,
        deviceType: 'Nintendo',
        flow: 'live' as const
      };

      const flow = new Authflow(email, profilesFolder, options, (data: any) => {
        console.log(chalk.yellow(`[Auth Code] Code for ${email}: ${data.user_code}`));
        this.broadcastFn({
          type: 'MS_AUTH_CODE',
          payload: {
            botId: accountId,
            userCode: data.user_code,
            url: data.verification_uri || 'https://www.microsoft.com/link',
            message: data.message
          }
        });
      });

      const res = await flow.getMinecraftJavaToken({ fetchProfile: true });
      const realIgn = res?.profile?.name || email;
      const playerUuid = res?.profile?.id;

      this.broadcastFn({
        type: 'ACCOUNT_VERIFIED',
        payload: {
          botId: accountId,
          email: email,
          ign: realIgn,
          uuid: playerUuid
        }
      });

      console.log(chalk.green(`[Auth Success] Verified ${email} as Java IGN: ${realIgn}`));
    } catch (err: any) {
      console.error(chalk.red(`[Auth Error] Failed to verify ${email}: ${err.message}`));
    }
  }

  public handleClientMessage(msg: ClientMessage) {
    switch (msg.type) {
      case 'START_BOT':
        this.startBot(msg.payload);
        break;

      case 'STOP_BOT':
        this.stopBot(msg.payload.botId || (msg.payload as any).username || (msg.payload as any).ign);
        break;

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

      case 'SEND_CHAT': {
        const bot = this.bots.get(msg.payload.botId);
        if (bot) {
          bot.chat(msg.payload.message);
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

      case 'REQUEST_SYNC': {
        for (const bot of this.bots.values()) {
          this.broadcastFn({
            type: 'BOT_STATE',
            payload: {
              botId: bot.config.id,
              state: bot.state
            }
          });
          bot.emitTelemetry();
        }
        break;
      }
    }
  }
}
