import fs from 'fs';
import path from 'path';
import mineflayer, { Bot } from 'mineflayer';
import { BotConfig, BotLifecycleState, ChatMessagePayload, ContainerSlot, ContainerWindowPayload, TelemetryPayload } from '../types';
import { minecraftToHtml, stripMinecraftCodes } from '../utils/chatParser';

export type MessageBroadcastFn = (message: any) => void;

export class PocketBotInstance {
  public config: BotConfig;
  public bot: Bot | null = null;
  public state: BotLifecycleState = 'DISCONNECTED';
  
  private broadcast: MessageBroadcastFn;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private antiAfkInterval: NodeJS.Timeout | null = null;
  private mobFarmInterval: NodeJS.Timeout | null = null;
  private telemetryInterval: NodeJS.Timeout | null = null;
  private lastAttackTime: number = 0;
  private isDestroyed: boolean = false;
  private currentWindow: any = null;

  constructor(config: BotConfig, broadcast: MessageBroadcastFn) {
    this.config = config;
    this.broadcast = broadcast;
  }

  public start() {
    if (this.state === 'CONNECTING' || this.state === 'LOGGED_IN' || this.state === 'SPAWNED') {
      return;
    }

    this.isDestroyed = false;
    this.setState('CONNECTING');

    this.logConsole({
      type: 'session_divider',
      raw: `--- Connecting to ${this.config.host}:${this.config.port} (${this.config.username}) ---`,
      formattedText: `<span style="color:#FFAA00">--- Connecting to <b>${this.config.host}:${this.config.port}</b> as <b>${this.config.username}</b> ---</span>`
    });

    try {
      const cleanUsername = this.config.username.includes('@')
        ? this.config.username.split('@')[0]
        : this.config.username;

      // Central tokens directory: share tokens with VistaAFK/Termux profiles
      const tokenFolder = path.resolve(process.cwd(), 'tokens');
      const profilesFolder = path.resolve(process.cwd(), 'profiles');
      const vistaTokensFolder = path.resolve(process.cwd(), '..', 'VistaAFK', 'tokens');
      const homeTokensFolder = path.resolve(process.env.HOME || '', 'tokens');

      if (!fs.existsSync(tokenFolder)) {
        try { fs.mkdirSync(tokenFolder, { recursive: true }); } catch (e) {}
      }

      // Automatically copy any cached Microsoft tokens from VistaAFK or profiles
      for (const srcDir of [vistaTokensFolder, homeTokensFolder, profilesFolder]) {
        if (fs.existsSync(srcDir)) {
          try {
            const files = fs.readdirSync(srcDir);
            for (const f of files) {
              const srcFile = path.join(srcDir, f);
              const dstFile = path.join(tokenFolder, f);
              if (!fs.existsSync(dstFile) && fs.statSync(srcFile).isFile()) {
                fs.copyFileSync(srcFile, dstFile);
                console.log(`[PocketAFK] Shared existing OAuth token from ${srcDir}: ${f}`);
              }
            }
          } catch (e) {}
        }
      }

      const authMode = this.config.authType === 'offline' ? 'offline' : 'microsoft';

      this.bot = mineflayer.createBot({
        host: this.config.host,
        port: this.config.port,
        username: cleanUsername,
        auth: authMode,
        version: this.config.version && this.config.version !== 'auto' ? this.config.version : undefined,
        profilesFolder: tokenFolder,
        physicsEnabled: this.config.settings.physics !== false,
        viewDistance: 'tiny',
        onMsaCode: (data: any) => {
          const userCode = data.user_code || data.userCode;
          const baseUri = data.verification_uri || 'https://www.microsoft.com/link';
          const directUri = userCode
            ? `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}&prompt=select_account`
            : baseUri;

          this.broadcast({
            type: 'MS_AUTH_CODE',
            payload: {
              botId: this.config.id,
              userCode: userCode,
              url: directUri,
              message: data.message
            }
          });
          this.logConsole({
            type: 'system',
            raw: `[Microsoft Auth] Code: ${userCode} at ${directUri}`,
            formattedText: `<span style="color:#00AAAA;font-weight:bold">[Microsoft Auth] Code: <span style="color:#FFAA00">${userCode}</span> &bull; <a href="${directUri}" target="_blank" style="color:#55FFFF;text-decoration:underline">Click here to authenticate</a></span>`
          });
        }
      });

      this.setupEventHandlers();
    } catch (err: any) {
      this.setState('ERROR', err.message);
      this.scheduleReconnect();
    }
  }

  private setState(state: BotLifecycleState, reason?: string) {
    this.state = state;
    this.broadcast({
      type: 'BOT_STATE',
      payload: {
        botId: this.config.id,
        state: this.state,
        reason
      }
    });
  }

  private setupEventHandlers() {
    if (!this.bot) return;

    // Login event
    this.bot.once('login', () => {
      this.setState('LOGGED_IN');
      const realIgn = this.bot?.username || (this.bot?.player as any)?.username || this.config.username;
      const playerUuid = (this.bot as any)?._client?.uuid;

      // Broadcast real verified Java IGN back to frontend!
      this.broadcast({
        type: 'ACCOUNT_VERIFIED',
        payload: {
          botId: this.config.id,
          email: this.config.username,
          ign: realIgn,
          uuid: playerUuid,
        }
      });

      this.logConsole({
        type: 'system',
        raw: `[PocketAFK] Verified Java Account: ${realIgn}`,
        formattedText: `<span style="color:#55FF55">[PocketAFK] Verified Java IGN: <b>${realIgn}</b></span>`
      });
    });

    // Spawn event (Bot appears in world)
    this.bot.once('spawn', () => {
      this.setState('SPAWNED');
      this.logConsole({
        type: 'session_divider',
        raw: `[PocketAFK] Spawned in world! Dimension: ${this.bot?.game.dimension || 'overworld'}`,
        formattedText: `<span style="color:#55FFFF">[PocketAFK] Spawned in world! Dimension: <b>${this.bot?.game.dimension || 'overworld'}</b></span>`
      });

      this.startAntiAfk();
      this.startMobFarm();
      this.startTelemetry();
    });

    // Auto-accept Server Resource Packs
    // Many servers kick or freeze the bot if resource packs are not accepted
    if (this.config.settings.acceptResourcePacks) {
      (this.bot as any)._client?.on('resource_pack_send', (data: any) => {
        this.logConsole({
          type: 'system',
          raw: `[Server] Resource pack offered. Automatically accepting...`,
          formattedText: `<span style="color:#FFFF55">[Server] Resource pack offered. Automatically accepting...</span>`
        });
        
        try {
          if (typeof this.bot?.acceptResourcePack === 'function') {
            this.bot.acceptResourcePack();
          } else {
            (this.bot as any)._client?.write('resource_pack_receive', {
              result: 3 // Successfully loaded
            });
          }
        } catch (e) {
          // ignore error if client handled it
        }
      });
    }

    // Chat / Message handler
    this.bot.on('message', (jsonMsg: any) => {
      const rawText = jsonMsg.toString();
      const formatted = minecraftToHtml(jsonMsg.toAnsi ? jsonMsg.toAnsi() : rawText);

      this.logConsole({
        type: 'chat',
        raw: rawText,
        formattedText: formatted || rawText
      });
    });

    // Health / Hunger updates
    this.bot.on('health', () => {
      this.emitTelemetry();
      this.handleSurvivalFeatures();
    });

    // Window / Container Open (Server Chest Menus)
    this.bot.on('windowOpen', (window: any) => {
      this.currentWindow = window;
      this.sendContainerWindow(window);
    });

    // Window / Container Close
    this.bot.on('windowClose', (window: any) => {
      this.currentWindow = null;
      this.broadcast({
        type: 'WINDOW_CLOSE',
        payload: {
          botId: this.config.id,
          windowId: window.id
        }
      });
    });

    // Kicked handler
    this.bot.on('kicked', (reason: any) => {
      const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
      this.setState('KICKED', reasonStr);
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK] Kicked from server: ${reasonStr}`,
        formattedText: `<span style="color:#FF5555"><b>[PocketAFK] Kicked:</b> ${stripMinecraftCodes(reasonStr)}</span>`
      });
      this.cleanup();
      this.scheduleReconnect();
    });

    // Disconnect / End handler
    this.bot.on('end', (reason: string) => {
      this.setState('DISCONNECTED', reason);
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK] Connection closed: ${reason}`,
        formattedText: `<span style="color:#AAAAAA">[PocketAFK] Connection closed (${reason})</span>`
      });
      this.cleanup();
      this.scheduleReconnect();
    });

    // Error handler
    this.bot.on('error', (err: Error) => {
      this.setState('ERROR', err.message);
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK Error] ${err.message}`,
        formattedText: `<span style="color:#FF5555">[PocketAFK Error] ${err.message}</span>`
      });
    });

    // Death handler
    this.bot.on('death', () => {
      this.logConsole({
        type: 'death',
        raw: `[PocketAFK] Bot died!`,
        formattedText: `<span style="color:#FF5555;font-weight:bold">☠ [PocketAFK] Bot died! Respawning...</span>`
      });
    });
  }

  // --- MOB FARM / COMBAT SYSTEM ---
  // Fixes the issue where the bot swings its arm in the air without hitting mobs:
  // We locate the nearest entity, face it directly, and send a proper attack packet with weapon cooldown!
  private startMobFarm() {
    if (this.mobFarmInterval) clearInterval(this.mobFarmInterval);
    if (!this.config.settings.mobFarm) return;

    const interval = this.config.settings.mobFarmIntervalMs || 650;
    this.mobFarmInterval = setInterval(() => {
      this.attackNearestTarget();
    }, interval);
  }

  public async attackNearestTarget() {
    if (!this.bot || this.state !== 'SPAWNED') return;

    const now = Date.now();
    const cooldown = this.config.settings.mobFarmIntervalMs || 650;
    if (now - this.lastAttackTime < cooldown) return;

    const maxDistance = this.config.settings.mobFarmRange || 3.5;

    // Find nearest hostile or damageable entity (Enderman, Zombie, etc.)
    const target = this.bot.nearestEntity((entity) => {
      if (!entity || entity === this.bot?.entity) return false;
      // Allow attacking hostile mobs or entities in front
      const isMob = entity.type === 'mob' || entity.type === 'hostile' || entity.kind === 'Hostile mobs';
      const dist = this.bot!.entity.position.distanceTo(entity.position);
      return isMob && dist <= maxDistance;
    });

    if (target) {
      try {
        // Equip weapon if available
        const sword = this.bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'));
        if (sword && this.bot.heldItem?.name !== sword.name) {
          await this.bot.equip(sword, 'hand');
        }

        // Look directly at target entity's head/body
        await this.bot.lookAt(target.position.offset(0, target.height * 0.75, 0), true);

        // Execute real attack (interact_entity packet)
        this.bot.attack(target);
        this.lastAttackTime = Date.now();
      } catch (err) {
        // Combat target moved or unavailable
      }
    }
  }

  // --- SURVIVAL AUTOMATIONS (Disabled by default) ---
  private async handleSurvivalFeatures() {
    if (!this.bot || this.state !== 'SPAWNED') return;

    // 1. Auto-Eat (Disabled by default)
    if (this.config.settings.autoEat && this.bot.food < 15) {
      const foodItem = this.bot.inventory.items().find(i => 
        ['cooked_beef', 'golden_carrot', 'cooked_porkchop', 'bread', 'cooked_mutton', 'cooked_chicken', 'baked_potato'].includes(i.name)
      );

      if (foodItem && !(this.bot as any).isEating) {
        try {
          await this.bot.equip(foodItem, 'hand');
          await this.bot.consume();
        } catch (e) {
          // Food not edible or interrupted
        }
      }
    }

    // 2. Auto-Totem (Disabled by default)
    if (this.config.settings.autoTotem) {
      const offhandItem = (this.bot.inventory as any).slots[45];
      if (!offhandItem || offhandItem.name !== 'totem_of_undying') {
        const totem = this.bot.inventory.items().find(i => i.name === 'totem_of_undying');
        if (totem) {
          try {
            await this.bot.equip(totem, 'off-hand');
          } catch (e) {
            // Totem equip failed
          }
        }
      }
    }
  }

  // --- ANTI-AFK ACTIONS ---
  private startAntiAfk() {
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (!this.config.settings.antiAfk) return;

    const intervalSec = this.config.settings.antiAfkInterval || 10;
    this.antiAfkInterval = setInterval(async () => {
      if (!this.bot || this.state !== 'SPAWNED') return;

      try {
        // Random subtle pitch/yaw shift
        const randomYaw = (Math.random() - 0.5) * 0.4;
        const randomPitch = (Math.random() - 0.5) * 0.2;
        await this.bot.look(this.bot.entity.yaw + randomYaw, this.bot.entity.pitch + randomPitch, true);

        // Random subtle arm swing
        this.bot.swingArm('right');

        // Occasional sneak
        if (Math.random() > 0.6) {
          this.bot.setControlState('sneak', true);
          setTimeout(() => {
            this.bot?.setControlState('sneak', false);
          }, 350);
        }
      } catch (e) {
        // Ignore rotation interruption
      }
    }, intervalSec * 1000);
  }

  // --- TELEMETRY ---
  private startTelemetry() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(() => {
      this.emitTelemetry();
    }, 1500);
  }

  public emitTelemetry() {
    if (!this.bot || this.state !== 'SPAWNED') return;

    const pos = this.bot.entity.position;
    const payload: TelemetryPayload = {
      botId: this.config.id,
      health: this.bot.health || 20,
      maxHealth: 20,
      food: this.bot.food || 20,
      saturation: this.bot.foodSaturation || 5,
      position: {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
        yaw: Math.round(this.bot.entity.yaw * 100) / 100,
        pitch: Math.round(this.bot.entity.pitch * 100) / 100
      },
      dimension: this.bot.game.dimension || 'overworld',
      gamemode: this.bot.game.gameMode || 'survival',
      ping: (this.bot.player as any)?.ping || 0
    };

    this.broadcast({
      type: 'TELEMETRY',
      payload
    });
  }

  // --- CONTAINER / CHEST GUI ---
  public sendContainerWindow(window: any) {
    if (!window) return;

    const slots: (ContainerSlot | null)[] = window.slots.map((item: any, idx: number) => {
      if (!item) return null;

      let customName: string | undefined = undefined;
      let lore: string[] | undefined = undefined;

      if (item.nbt?.value?.display?.value?.Name?.value) {
        try {
          const parsed = JSON.parse(item.nbt.value.display.value.Name.value);
          customName = parsed.text || parsed;
        } catch {
          customName = item.nbt.value.display.value.Name.value;
        }
      }

      if (item.nbt?.value?.display?.value?.Lore?.value?.value) {
        lore = item.nbt.value.display.value.Lore.value.value.map((l: string) => {
          try {
            const parsed = JSON.parse(l);
            return parsed.text || parsed;
          } catch {
            return l;
          }
        });
      }

      return {
        slot: idx,
        name: item.name,
        displayName: item.displayName || item.name,
        count: item.count,
        customName,
        lore
      };
    });

    const payload: ContainerWindowPayload = {
      botId: this.config.id,
      windowId: window.id,
      title: window.title || 'Chest / Menu',
      type: window.type || 'chest',
      slotsCount: window.slots.length,
      slots
    };

    this.broadcast({
      type: 'CONTAINER_WINDOW',
      payload
    });
  }

  public async clickSlot(slot: number, mouseButton = 0, mode = 0) {
    if (!this.bot || !this.currentWindow) return;
    try {
      await this.bot.clickWindow(slot, mouseButton, mode);
      // Resend updated window slots
      setTimeout(() => {
        if (this.currentWindow) {
          this.sendContainerWindow(this.currentWindow);
        }
      }, 100);
    } catch (e: any) {
      this.logConsole({
        type: 'error',
        raw: `Failed to click slot ${slot}: ${e.message}`,
        formattedText: `<span style="color:#FF5555">Failed to click slot ${slot}: ${e.message}</span>`
      });
    }
  }

  public closeCurrentWindow() {
    if (!this.bot || !this.currentWindow) return;
    try {
      this.bot.closeWindow(this.currentWindow);
      this.currentWindow = null;
    } catch (e) {
      // Ignore
    }
  }

  // --- ACTIONS ---
  public chat(message: string) {
    if (!this.bot) return;
    this.bot.chat(message);
  }

  public updateSettings(newSettings: Partial<typeof this.config.settings>) {
    this.config.settings = { ...this.config.settings, ...newSettings };
    
    // Toggle physics dynamically
    if (this.bot && newSettings.physics !== undefined) {
      this.bot.physicsEnabled = newSettings.physics;
    }

    // Refresh loops
    this.startAntiAfk();
    this.startMobFarm();
  }

  private logConsole(data: Omit<ChatMessagePayload, 'botId' | 'id' | 'timestamp'>) {
    const payload: ChatMessagePayload = {
      botId: this.config.id,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      ...data
    };

    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload
    });
  }

  private scheduleReconnect() {
    if (this.isDestroyed || !this.config.settings.autoReconnect) return;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    
    // Add 1-3 seconds jitter to avoid rapid disconnect bans
    const jitter = Math.floor(Math.random() * 2000);
    const delay = (this.config.settings.autoReconnectDelay || 5000) + jitter;

    this.setState('RECONNECTING', `Reconnecting in ${Math.round(delay / 1000)}s...`);
    this.logConsole({
      type: 'session_divider',
      raw: `--- Reconnecting in ${Math.round(delay / 1000)}s ---`,
      formattedText: `<span style="color:#FFAA00">--- Reconnecting in ${Math.round(delay / 1000)}s ---</span>`
    });

    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.start();
      }
    }, delay);
  }

  private cleanup() {
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (this.mobFarmInterval) clearInterval(this.mobFarmInterval);
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.currentWindow = null;
    this.antiAfkInterval = null;
    this.mobFarmInterval = null;
    this.telemetryInterval = null;
  }

  public stop() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanup();

    if (this.bot) {
      try {
        this.bot.quit('PocketAFK bot stopped by user');
      } catch (e) {
        // Ignore
      }
      this.bot = null;
    }

    this.setState('DISCONNECTED', 'Stopped by user');
  }
}
