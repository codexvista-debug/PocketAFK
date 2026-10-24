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
  joinDelay?: number;             // Delay before joining in seconds (Default: 0)
}

export interface BotConfig {
  id: string;
  serverId?: string;
  username: string;
  accountId?: string;
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
  serverId?: string;
  accountUsername?: string;
  id: string;
  timestamp: number;
  raw: string;
  formattedText: string;
  sender?: string;
  type: 'chat' | 'system' | 'session_divider' | 'death' | 'error';
}

export interface FarmMachineState {
  id: string;
  name: string;
  direction: 'north' | 'east' | 'south' | 'west';
  status: 'running' | 'idle' | 'jammed';
  pistonActive: boolean;
  blocksProduced: number;
}

export interface FarmTelemetry {
  detectedMachines: number;
  activePistons: number;
  cobbleNearby: number;
  lavaNearby: number;
  waterNearby: number;
  hoppersNearby: number;
  genRatePerMinute: number;
  machines?: FarmMachineState[];
}

export interface RadarEntity {
  id: number;
  type: 'player' | 'hostile' | 'passive';
  name: string;
  username?: string;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  distance: number;
}

export interface TelemetryPayload {
  botId: string;
  serverId?: string;
  accountUsername?: string;
  connectedAt?: number;
  version?: string;
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
  facing?: string;
  yaw?: number;
  pitch?: number;
  coordinates?: { x: number; y: number; z: number };
  currentBiome?: string;
  currentLandBlock?: string;
  nearbyPlayers?: MinimapPlayer[];
  nearbyMobs?: MinimapMob[];
  terrainGrid?: TerrainGridData | null;
  farm?: FarmTelemetry;
  entities?: RadarEntity[];
}

export interface MinimapPlayer {
  username: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  distance: number;
  yaw: number;
  facing?: string;
  health?: number;
}

export interface MinimapMob {
  id: number;
  name: string;
  type: string;
  distance: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  isHostile: boolean;
}

export interface TerrainPaletteItem {
  id: number;
  name: string;
  color: string;
}

export interface TerrainGridData {
  radius: number;
  size: number;
  currentBiome?: string;
  currentLandBlock?: string;
  palette: TerrainPaletteItem[];
  cells: number[];
  heights: number[];
  timeOfDay?: string;
  weather?: string;
  lightLevel?: number;
  groundElevation?: number;
  seaLevelDelta?: number;
  skyClearance?: string;
  landscapeSummary?: Array<{ name: string; percentage: number; color: string }>;
  hazards?: string[];
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

export interface WebhookConfig {
  daemonWebhookUrl: string;
  daemonEnabled: boolean;
  daemonNotifyOnline: boolean;
  daemonNotifyOffline: boolean;
  daemonNotifyErrors: boolean;
  daemonNotifyHeartbeat: boolean;

  botWebhookUrl: string;
  botEnabled: boolean;
  botNotifyJoined: boolean;
  botNotifyDisconnected: boolean;
  botNotifyAfkReward: boolean;
  botNotifyUptime: boolean;
  botNotifyChatMentions: boolean;
  botNotifyLowHealth: boolean;
}

export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  daemonWebhookUrl: '',
  daemonEnabled: true,
  daemonNotifyOnline: true,
  daemonNotifyOffline: true,
  daemonNotifyErrors: true,
  daemonNotifyHeartbeat: false,

  botWebhookUrl: '',
  botEnabled: true,
  botNotifyJoined: true,
  botNotifyDisconnected: true,
  botNotifyAfkReward: true,
  botNotifyUptime: true,
  botNotifyChatMentions: false,
  botNotifyLowHealth: true,
};

// Client to Daemon Messages
export type ClientMessage =
  | { type: 'AUTH'; payload: { token: string; username?: string } }
  | { type: 'START_BOT'; payload: BotConfig }
  | { type: 'STOP_BOT'; payload: { botId: string; accountId?: string; username?: string } }
  | { type: 'RESTART_BOT'; payload: { botId: string } }
  | { type: 'RESTART_DAEMON'; payload?: { reason?: string } }
  | { type: 'SHUTDOWN_DAEMON'; payload?: { reason?: string } }
  | { type: 'REVOKE_CONNECTION'; payload: { connectionId: string } }
  | { type: 'SEND_CHAT'; payload: { botId: string; message: string; targetAccount?: string } }
  | { type: 'CLICK_SLOT'; payload: { botId: string; windowId: number; slot: number; mouseButton?: number; mode?: number } }
  | { type: 'CLOSE_WINDOW'; payload: { botId: string; windowId: number } }
  | { type: 'UPDATE_SETTINGS'; payload: { botId: string; settings: Partial<BotSettings> } }
  | { type: 'VERIFY_ACCOUNT'; payload: { accountId: string; email: string } }
  | { type: 'IMPORT_ACCOUNT_TOKENS'; payload: { ign: string; tokenCache: any } }
  | { type: 'UPDATE_WEBHOOK_CONFIG'; payload: WebhookConfig }
  | { type: 'TEST_WEBHOOK'; payload: { target: 'daemon' | 'bot'; url: string } }
  | { type: 'REQUEST_SYNC'; payload?: { botId?: string } }
  | { type: 'PING' };

export interface ActivityLog {
  id: string;
  botId: string;
  timestamp: number;
  type: 'status' | 'connect' | 'spawn' | 'command' | 'survival' | 'anti_afk' | 'disconnect' | 'reconnect' | 'chat' | 'control';
  message: string;
}

// Daemon to Client Messages
export type DaemonMessage =
  | { type: 'AUTH_RESULT'; payload: { success: boolean; message?: string } }
  | { type: 'CONNECTION_STATUS'; payload: { connections: Array<{ id: string; connectedAt: number }>; currentConnectionId: string } }
  | { type: 'BOT_STATE'; payload: { botId: string; serverId?: string; username?: string; accountId?: string; version?: string; state: BotLifecycleState; reason?: string; connectedAt?: number; uptime?: number } }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'TELEMETRY'; payload: TelemetryPayload }
  | { type: 'CONTAINER_WINDOW'; payload: ContainerWindowPayload }
  | { type: 'WINDOW_CLOSE'; payload: { botId: string; windowId: number } }
  | { type: 'MS_AUTH_CODE'; payload: { botId: string; userCode: string; url: string; message: string } }
  | { type: 'ACCOUNT_VERIFIED'; payload: { botId: string; email: string; ign: string; uuid?: string } }
  | { type: 'ACTIVITY_LOG'; payload: ActivityLog }
  | { type: 'PONG'; payload: { timestamp: number } }
  | { type: 'SERVER_INFO'; payload: { version: string; activeBots: string[] } };
