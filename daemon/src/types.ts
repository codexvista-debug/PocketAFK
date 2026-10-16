export interface BotSettings {
  physics: boolean;               // Enable gravity, water, collisions (Default: true)
  acceptResourcePacks: boolean;   // Auto-accept server resource packs (Default: true)
  autoEat: boolean;               // Auto eat when food < 14 (Default: false)
  autoTotem: boolean;             // Keep totem in offhand (Default: false)
  antiAfk: boolean;               // Subtle head movement, sneak, arm swing (Default: true)
  antiAfkInterval: number;        // Interval in seconds (Default: 10)
  mobFarm: boolean;               // Auto-attack nearby hostile mobs with sword/weapon (Default: false)
  mobFarmRange: number;           // Attack range in blocks (Default: 3.5)
  mobFarmIntervalMs: number;      // Attack cooldown in ms (Default: 650ms for 1.9+ sweep cooldown)
  autoReconnect: boolean;         // Auto reconnect on kick/disconnect (Default: true)
  autoReconnectDelay: number;     // Delay before reconnecting in ms (Default: 5000)
}

export interface BotConfig {
  id: string;
  username: string;
  authType: 'microsoft' | 'offline';
  host: string;
  port: number;
  version?: string;
  settings: BotSettings;
}

export type BotLifecycleState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LOGGED_IN'
  | 'SPAWNED'
  | 'RECONNECTING'
  | 'KICKED'
  | 'ERROR';

export interface ChatMessagePayload {
  botId: string;
  id: string;
  timestamp: number;
  raw: string;
  formattedText: string;
  sender?: string;
  type: 'chat' | 'system' | 'session_divider' | 'death' | 'error';
}

export interface TelemetryPayload {
  botId: string;
  health: number;
  maxHealth: number;
  food: number;
  saturation: number;
  position: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
  };
  dimension: string;
  gamemode: string;
  ping: number;
  uptime: number;
}

export interface ContainerSlot {
  slot: number;
  name: string;
  displayName: string;
  count: number;
  customName?: string;
  lore?: string[];
}

export interface ContainerWindowPayload {
  botId: string;
  windowId: number;
  title: string;
  type: string;
  slotsCount: number;
  slots: (ContainerSlot | null)[];
}

// Client to Daemon Messages
export type ClientMessage =
  | { type: 'AUTH'; payload: { token: string } }
  | { type: 'START_BOT'; payload: BotConfig }
  | { type: 'STOP_BOT'; payload: { botId: string } }
  | { type: 'RESTART_BOT'; payload: { botId: string } }
  | { type: 'SEND_CHAT'; payload: { botId: string; message: string } }
  | { type: 'CLICK_SLOT'; payload: { botId: string; windowId: number; slot: number; mouseButton?: number; mode?: number } }
  | { type: 'CLOSE_WINDOW'; payload: { botId: string; windowId: number } }
  | { type: 'UPDATE_SETTINGS'; payload: { botId: string; settings: Partial<BotSettings> } }
  | { type: 'VERIFY_ACCOUNT'; payload: { accountId: string; email: string } }
  | { type: 'REQUEST_SYNC'; payload?: { botId?: string } };

// Daemon to Client Messages
export type DaemonMessage =
  | { type: 'AUTH_RESULT'; payload: { success: boolean; message?: string } }
  | { type: 'BOT_STATE'; payload: { botId: string; state: BotLifecycleState; reason?: string } }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'TELEMETRY'; payload: TelemetryPayload }
  | { type: 'CONTAINER_WINDOW'; payload: ContainerWindowPayload }
  | { type: 'WINDOW_CLOSE'; payload: { botId: string; windowId: number } }
  | { type: 'MS_AUTH_CODE'; payload: { botId: string; userCode: string; url: string; message: string } }
  | { type: 'ACCOUNT_VERIFIED'; payload: { botId: string; email: string; ign: string; uuid?: string } }
  | { type: 'PONG'; payload: { timestamp: number } }
  | { type: 'SERVER_INFO'; payload: { version: string; activeBots: string[] } };
