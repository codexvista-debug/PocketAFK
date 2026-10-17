import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mineflayer, { Bot } from 'mineflayer';
const minecraftFolderPath = require('minecraft-folder-path');
import { BotConfig, BotLifecycleState, ChatMessagePayload, ContainerSlot, ContainerWindowPayload, TelemetryPayload } from '../types';
import { minecraftToHtml, stripMinecraftCodes } from '../utils/chatParser';
import { getAndSyncTokenFolder, ensureTokenAliases, backupTokens } from './tokenManager';

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
  private wasKicked: boolean = false;
  private reconnectAttempts: number = 0;
  private currentWindow: any = null;
  public connectedAt: number = 0;

  constructor(config: BotConfig, broadcast: MessageBroadcastFn) {
    this.config = config;
    this.broadcast = broadcast;
  }

  public async start() {
    if (this.state === 'CONNECTING' || this.state === 'LOGGED_IN' || this.state === 'SPAWNED') {
      return;
    }

    this.isDestroyed = false;
    this.wasKicked = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setState('CONNECTING');

    this.logConsole({
      type: 'session_divider',
      raw: `--- Connecting to ${this.config.host}:${this.config.port} (${this.config.username}) ---`,
      formattedText: `<span style="color:#FFAA00">--- Connecting to <b>${this.config.host}:${this.config.port}</b> as <b>${this.config.username}</b> ---</span>`
    });

    try {
      const joinDelay = this.config.settings?.joinDelay;
      if (typeof joinDelay === 'number' && joinDelay > 0) {
        this.logConsole({
          type: 'system',
          raw: `[Join Delay] Waiting ${joinDelay}s before connecting...`,
          formattedText: `<span style="color:#FFAA00">[Join Delay] Waiting <b>${joinDelay}s</b> before connecting...</span>`
        });
        await new Promise((r) => setTimeout(r, joinDelay * 1000));
        if (this.isDestroyed) return;
      }

      const cleanUsername = this.config.username.includes('@')
        ? this.config.username.split('@')[0]
        : this.config.username;

      // Central persistent tokens directory & 90-day rolling OAuth aliasing
      const tokenFolder = getAndSyncTokenFolder();
      ensureTokenAliases(tokenFolder, cleanUsername);

      // Always official Microsoft Java mode (100% compatible with real public Minecraft servers)
      const authMode: 'microsoft' = 'microsoft';

      this.bot = mineflayer.createBot({
        host: this.config.host,
        port: this.config.port,
        username: cleanUsername,
        auth: authMode,
        version: this.config.version && this.config.version !== 'auto' ? this.config.version : undefined,
        profilesFolder: tokenFolder,
        physicsEnabled: this.config.settings.physics !== false,
        viewDistance: 'tiny',
        checkTimeoutInterval: 120 * 1000,
        onMsaCode: (data: any) => {
          const userCode = data.user_code || data.userCode;
          const baseUri = data.verification_uri || 'https://www.microsoft.com/link';
          const directUri = userCode
            ? `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}&prompt=select_account`
            : baseUri;

          console.log('\n======================================================');
          console.log(`🔑 [MICROSOFT AUTHENTICATION REQUIRED]`);
          console.log(`👉 Link: ${directUri}`);
          console.log(`👉 Code: ${userCode}`);
          console.log(`Open the link in your browser to authorize Java account: ${cleanUsername}`);
          console.log('======================================================\n');

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

      // Safe fallback for bot.entity to prevent "Cannot read properties of null (reading 'id')"
      // when servers teleport, reset spectator entities, or switch dimensions
      let _currentEntity: any = null;
      Object.defineProperty(this.bot, 'entity', {
        get() {
          return _currentEntity || { id: -1, position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, height: 1.62 };
        },
        set(val: any) {
          _currentEntity = val;
        },
        configurable: true,
        enumerable: true
      });

      this.setupEventHandlers();
    } catch (err: any) {
      this.setState('ERROR', err.message);
      this.scheduleReconnect();
    }
  }

  private setState(state: BotLifecycleState, reason?: string) {
    this.state = state;
    const uptime = this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0;
    const detectedVer = this.bot?.version || (this.bot as any)?._client?.version || (this.config.version !== 'auto' ? this.config.version : undefined);
    this.broadcast({
      type: 'BOT_STATE',
      payload: {
        botId: this.config.id,
        serverId: this.config.serverId,
        username: this.config.username,
        accountId: this.config.accountId,
        version: detectedVer,
        state: this.state,
        reason,
        connectedAt: this.connectedAt || 0,
        uptime,
      }
    });
  }

  private setupEventHandlers() {
    if (!this.bot) return;

    // Login event
    this.bot.once('login', () => {
      this.setState('LOGGED_IN');
      if (!this.connectedAt) this.connectedAt = Date.now();
      const realIgn = this.bot?.username || (this.bot?.player as any)?.username || this.config.username;
      const playerUuid = (this.bot as any)?._client?.uuid;

      if (!this.config.username.includes('@') && realIgn.toLowerCase() !== this.config.username.toLowerCase()) {
        console.warn(`[PocketAFK Warning] Account name mismatch: Configured as '${this.config.username}', but authenticated on Minecraft as '${realIgn}'`);
      }

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

      // Mirror token cache under realIgn and cleanUsername and back up to persistent Android storage
      const cleanUsername = this.config.username.includes('@')
        ? this.config.username.split('@')[0]
        : this.config.username;
      const tokenFolder = getAndSyncTokenFolder();
      ensureTokenAliases(tokenFolder, cleanUsername, realIgn);
      backupTokens(tokenFolder);

      this.logConsole({
        type: 'system',
        raw: `[PocketAFK] Verified Java Account: ${realIgn}`,
        formattedText: `<span style="color:#55FF55">[PocketAFK] Verified Java IGN: <b>${realIgn}</b></span>`
      });
    });

    // Spawn event (Bot appears in world)
    this.bot.once('spawn', () => {
      this.setState('SPAWNED');
      this.reconnectAttempts = 0;
      this.wasKicked = false;
      if (!this.connectedAt) this.connectedAt = Date.now();
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
      let sourceText = '';
      try {
        if (typeof jsonMsg.toMotd === 'function') {
          sourceText = jsonMsg.toMotd();
        } else if (typeof jsonMsg.toAnsi === 'function') {
          sourceText = jsonMsg.toAnsi();
        }
      } catch (e) {
        sourceText = rawText;
      }

      const formatted = minecraftToHtml(sourceText || rawText);

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
      try {
        if (!window) return;
        this.currentWindow = window;
        this.sendContainerWindow(window);
      } catch (e) {
        // Safe fallback
      }
    });

    // Window / Container Close (Prevent null crash when transferring between servers)
    this.bot.on('windowClose', (window: any) => {
      try {
        this.currentWindow = null;
        if (window && window.id !== undefined) {
          this.broadcast({
            type: 'WINDOW_CLOSE',
            payload: {
              botId: this.config.id,
              windowId: window.id
            }
          });
        }
      } catch (e) {
        // Safe fallback
      }
    });

    // Respawn / Sub-server Transfer (BungeeCord / Velocity)
    this.bot.on('respawn', () => {
      this.logConsole({
        type: 'session_divider',
        raw: `[PocketAFK] Transferred / Respawned in world! Dimension: ${this.bot?.game?.dimension || 'overworld'}`,
        formattedText: `<span style="color:#55FFFF">[PocketAFK] Sub-server transfer / Respawned! Dimension: <b>${this.bot?.game?.dimension || 'overworld'}</b></span>`
      });
      this.setState('SPAWNED');
      this.startAntiAfk();
      this.startMobFarm();
      this.startTelemetry();
    });

    // Kicked handler
    this.bot.on('kicked', (reason: any) => {
      this.wasKicked = true;
      const analysis = this.analyzeKick(reason);

      this.setState('KICKED', analysis.uiReason);
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK] Kicked: ${analysis.cleanMessage}`,
        formattedText: `<span style="color:#FF5555"><b>[PocketAFK] Kicked:</b> ${stripMinecraftCodes(analysis.cleanMessage)}</span>`
      });

      this.cleanup();

      if (analysis.shouldReconnect) {
        this.scheduleReconnect(analysis.suggestedDelayMs);
      } else {
        this.logConsole({
          type: 'system',
          raw: `[PocketAFK] Auto-reconnect paused for safety (${analysis.uiReason}). Click Connect to retry.`,
          formattedText: `<span style="color:#FFAA00">[PocketAFK] Auto-reconnect paused: <b>${stripMinecraftCodes(analysis.uiReason)}</b>. Click Connect when ready.</span>`
        });
      }
    });

    // Disconnect / End handler
    this.bot.on('end', (reason: string) => {
      // If end was preceded by kicked, do not overwrite the kick reason or state, and do not trigger duplicate reconnect!
      if (this.wasKicked) {
        this.cleanup();
        return;
      }

      const reasonStr = typeof reason === 'string' ? reason : String(reason || 'Socket closed');
      this.setState('DISCONNECTED', reasonStr);
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK] Connection closed: ${reasonStr}`,
        formattedText: `<span style="color:#AAAAAA">[PocketAFK] Connection closed (${reasonStr})</span>`
      });
      this.cleanup();
      this.scheduleReconnect();
    });

    // Error handler
    this.bot.on('error', (err: Error) => {
      console.error('[PocketAFK Bot Error]', err);

      // If error is transient null reference during proxy dimension switch or keepalive queue lag, don't kill bot
      if (err.message.includes("reading 'id'") || err.message.includes('keepAliveError') || err.message.includes('timed out')) {
        this.logConsole({
          type: 'error',
          raw: `[PocketAFK Warning] Server queue/sync: ${err.message}`,
          formattedText: `<span style="color:#FFAA00">[PocketAFK Notice] Server queue/sync: ${err.message}</span>`
        });
        return;
      }

      const isSocketDead = !(this.bot as any)?._client?.socket?.writable;
      if (isSocketDead) {
        this.setState('ERROR', err.message);
      }
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
    if (!this.bot || !this.bot.entity || !this.bot.entity.position || this.state !== 'SPAWNED') return;

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
      if (!this.bot || !this.bot.entity || !this.bot.entity.position || this.state !== 'SPAWNED') return;

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
    if (!this.bot || !this.bot.entity || !this.bot.entity.position || this.state !== 'SPAWNED') return;

    const pos = this.bot.entity.position;
    const detectedVer = this.bot?.version || (this.bot as any)?._client?.version || (this.config.version !== 'auto' ? this.config.version : undefined);
    const payload: TelemetryPayload = {
      botId: this.config.id,
      serverId: this.config.serverId,
      accountUsername: this.bot?.username || this.config.username,
      connectedAt: this.connectedAt || 0,
      version: detectedVer,
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
      ping: (this.bot.player as any)?.ping || 0,
      uptime: this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0
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
      serverId: this.config.serverId,
      accountUsername: this.bot?.username || this.config.username,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      ...data
    };

    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload
    });
  }

  private extractKickText(reason: any): string {
    if (!reason) return '';
    if (typeof reason === 'string') {
      try {
        const parsed = JSON.parse(reason);
        return this.extractKickText(parsed);
      } catch {
        return reason;
      }
    }
    if (typeof reason === 'object') {
      if (typeof reason.toMotd === 'function') {
        try { return stripMinecraftCodes(reason.toMotd()); } catch {}
      }
      if (typeof reason.toAnsi === 'function') {
        try { return stripMinecraftCodes(reason.toAnsi()); } catch {}
      }
      let text = reason.text || reason.value || '';
      if (Array.isArray(reason.extra)) {
        text += reason.extra.map((e: any) => this.extractKickText(e)).join('');
      }
      if (Array.isArray(reason.with)) {
        text += reason.with.map((w: any) => this.extractKickText(w)).join(' ');
      }
      if (reason.translate) {
        text += ` ${reason.translate}`;
      }
      if (!text && typeof reason.toString === 'function' && reason.toString !== Object.prototype.toString) {
        text = reason.toString();
      }
      return text || JSON.stringify(reason);
    }
    return String(reason);
  }

  private analyzeKick(reason: any): {
    shouldReconnect: boolean;
    cleanMessage: string;
    uiReason: string;
    suggestedDelayMs?: number;
  } {
    const rawText = this.extractKickText(reason);
    const cleanText = stripMinecraftCodes(rawText).trim();
    const lower = cleanText.toLowerCase();

    // 1. Duplicate login / Logged in from another location
    // Real player logged in from PC client or another device.
    if (
      lower.includes('another location') ||
      lower.includes('somewhere else') ||
      lower.includes('duplicate login') ||
      lower.includes('already connected') ||
      lower.includes('already playing') ||
      lower.includes('duplicate_login') ||
      lower.includes('another device')
    ) {
      return {
        shouldReconnect: false,
        cleanMessage: 'Logged in from another location. Auto-reconnect paused so you can play without interruption.',
        uiReason: 'Logged in from another location (Paused so you can play)',
      };
    }

    // 2. Bans / Blacklist / Suspensions
    if (
      lower.includes('banned') ||
      lower.includes('blacklisted') ||
      lower.includes('suspended') ||
      lower.includes('permanently blocked') ||
      lower.includes('temporarily blocked')
    ) {
      const displayReason = cleanText.length > 60 ? cleanText.slice(0, 60) + '...' : cleanText;
      return {
        shouldReconnect: false,
        cleanMessage: `Account banned/suspended: ${cleanText}`,
        uiReason: displayReason || 'Banned from server',
      };
    }

    // 3. Whitelist
    if (
      lower.includes('whitelist') ||
      lower.includes('white-list') ||
      lower.includes('not whitelisted')
    ) {
      return {
        shouldReconnect: false,
        cleanMessage: 'You are not whitelisted on this server.',
        uiReason: 'Not on server whitelist',
      };
    }

    // 4. Invalid session / Auth failures
    if (
      lower.includes('invalid session') ||
      lower.includes('unverified username') ||
      lower.includes('failed to verify username') ||
      lower.includes('restart your game') ||
      lower.includes('authentication servers')
    ) {
      return {
        shouldReconnect: false,
        cleanMessage: 'Minecraft session token expired or invalid. Please re-authenticate your Microsoft account.',
        uiReason: 'Session invalid (Re-auth required)',
      };
    }

    // 5. Server is full (Wait 30s before retrying)
    if (lower.includes('server is full') || lower.includes('server full')) {
      return {
        shouldReconnect: true,
        suggestedDelayMs: 30000,
        cleanMessage: 'Server is currently full. Will retry in 30 seconds.',
        uiReason: 'Server full (Retrying in 30s)',
      };
    }

    // 6. Rate limited / connecting too fast (Wait 45s before retrying)
    if (
      lower.includes('too fast') ||
      lower.includes('too many login') ||
      lower.includes('rate limit') ||
      lower.includes('spamming')
    ) {
      return {
        shouldReconnect: true,
        suggestedDelayMs: 45000,
        cleanMessage: 'Connection rate-limited by server. Backing off for 45 seconds.',
        uiReason: 'Rate limited (Retrying in 45s)',
      };
    }

    // 7. Generic kick (AFK, server reboot, timeout, etc.)
    return {
      shouldReconnect: true,
      cleanMessage: cleanText || 'Kicked from server',
      uiReason: cleanText.length > 50 ? cleanText.slice(0, 50) + '...' : (cleanText || 'Kicked from server'),
    };
  }

  private scheduleReconnect(forcedDelay?: number) {
    if (this.isDestroyed || !this.config.settings.autoReconnect) return;

    if (this.reconnectAttempts >= 8) {
      this.setState('DISCONNECTED', 'Max reconnect attempts reached (Paused)');
      this.logConsole({
        type: 'error',
        raw: `[PocketAFK] Stopped auto-reconnecting after 8 consecutive failed attempts. Click Connect to retry.`,
        formattedText: `<span style="color:#FF5555">[PocketAFK] Stopped auto-reconnecting after 8 failed attempts. Click Connect to retry.</span>`
      });
      return;
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;

    // Add 1-2.5 seconds jitter to avoid rapid disconnect bans
    const jitter = Math.floor(Math.random() * 2000);
    const baseDelay = forcedDelay || (this.config.settings.autoReconnectDelay || 5000);
    const backoffMultiplier = Math.pow(1.3, Math.min(this.reconnectAttempts - 1, 5));
    const delay = Math.round(baseDelay * backoffMultiplier) + jitter;
    const delaySec = Math.round(delay / 1000);

    this.setState('RECONNECTING', `Reconnecting in ${delaySec}s (Attempt ${this.reconnectAttempts}/8)...`);
    this.logConsole({
      type: 'session_divider',
      raw: `--- Reconnecting in ${delaySec}s (Attempt ${this.reconnectAttempts}/8) ---`,
      formattedText: `<span style="color:#FFAA00">--- Reconnecting in <b>${delaySec}s</b> (Attempt ${this.reconnectAttempts}/8) ---</span>`
    });

    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.start();
      }
    }, delay);
  }

  private cleanup() {
    this.connectedAt = 0;
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
    this.wasKicked = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
