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

  public stopBot(id: string) {
    const bot = this.bots.get(id);
    if (bot) {
      bot.stop();
      this.bots.delete(id);
    }
  }

  public handleClientMessage(msg: ClientMessage) {
    switch (msg.type) {
      case 'START_BOT':
        this.startBot(msg.payload);
        break;

      case 'STOP_BOT':
        this.stopBot(msg.payload.botId);
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

      case 'REQUEST_SYNC': {
        // Send state of all active bots
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
