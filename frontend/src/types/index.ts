export interface BotSettings {
  physics: boolean;               // Enable gravity, water, collisions (Default: true)
  acceptResourcePacks: boolean;   // Auto-accept server resource packs (Default: true)
  autoEat: boolean;               // Auto eat when food < 14 (Default: false)
  autoTotem: boolean;             // Keep totem in offhand (Default: false)
  antiAfk: boolean;               // Subtle head movement, sneak, arm swing (Default: true)
  antiAfkInterval: number;        // Interval in seconds (Default: 10)
  mobFarm: boolean;               // Auto-attack nearby hostile mobs (Default: false)
  mobFarmRange: number;           // Attack range in blocks (Default: 3.5)
  mobFarmIntervalMs: number;      // Attack cooldown in ms (Default: 650)
  autoReconnect: boolean;         // Auto reconnect on kick/disconnect (Default: true)
  autoReconnectDelay: number;     // Delay before reconnecting in ms (Default: 5000)
  joinDelay?: number;             // Delay before joining in seconds (Default: 0)
}

export type UserRank = 'iron' | 'gold' | 'diamond' | 'emerald';

export interface MinecraftAccount {
  id: string;                     // Unique account identifier (e.g. "acc_abc123")
  username: string;               // Microsoft account email (e.g. "player@outlook.com")
  auth_type: 'microsoft';         // Strictly 100% official Java
  ign?: string;                   // Real verified In-Game Name once authenticated (e.g. "Notch")
  uuid?: string;                  // Minecraft Java UUID
  verified: boolean;              // True once authenticated via Microsoft MSA
  addedAt: number;
  authError?: string;             // Error details if verification failed or mismatched
  expectedIgn?: string;           // Target Minecraft username expected when verification was started
  settings?: Record<string, any>; // Account session settings stored in Supabase
}

// Backward compatibility alias
export type Account = MinecraftAccount;

export interface QuickCommandItem {
  cmd: string;
  label?: string;
  color?: string;
}

export interface ServerProfile {
  id: string;                     // Unique instance ID (passed as botId to daemon)
  name: string;                   // Custom display name (e.g. "Hypixel AFK", "DonutSMP Base")
  pocketUser?: string | null;     // PocketAFK website username (e.g. "Chief")
  accountId: string;              // Linked MinecraftAccount id or IGN
  assignedAccountIds?: string[];  // Accounts assigned to this server profile
  serverHost: string;             // Hostname / IP (e.g. "donutsmp.net", "mc.hypixel.net")
  serverPort: number;             // Port (default: 25565)
  serverVersion: string;          // Minecraft version (default: "auto", or "1.20.4", etc.)
  authType?: 'offline' | 'microsoft'; // Direct / Instant vs Microsoft Online
  autoReconnect: boolean;         // Auto reconnect on kick
  settings: BotSettings;          // Instance-specific AFK & physics settings
  quickCommands?: QuickCommandItem[]; // Custom quick command macros for this server
  createdAt?: number;             // Timestamp when profile was created
  connectionsCount?: number;      // Total connections made
}

export type BotLifecycleState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LOGGED_IN'
  | 'SPAWNED'
  | 'RECONNECTING'
  | 'KICKED'
  | 'ERROR';

export interface ChatMessage {
  botId: string;
  accountUsername?: string;
  id: string;
  timestamp: number;
  raw: string;
  formattedText: string;
  sender?: string;
  type: 'chat' | 'system' | 'session_divider' | 'death' | 'error';
}

export interface Telemetry {
  botId: string;
  accountUsername?: string;
  connectedAt?: number;
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
  uptime?: number;
  version?: string;
}

export interface ContainerSlot {
  slot: number;
  name: string;
  displayName: string;
  count: number;
  customName?: string;
  lore?: string[];
}

export interface ContainerWindow {
  botId: string;
  windowId: number;
  title: string;
  type: string;
  slotsCount: number;
  slots: (ContainerSlot | null)[];
}

export type PlayerLogType =
  | 'connecting'
  | 'handshake'
  | 'connected'
  | 'spawned'
  | 'kicked'
  | 'error'
  | 'disconnected'
  | 'reconnecting'
  | 'chat'
  | 'info';

export interface PlayerLogEntry {
  id: string;
  accountName: string;
  serverHost: string;
  timestamp: number;
  type: PlayerLogType;
  message: string;
  details?: string;
  status: 'info' | 'success' | 'warning' | 'error';
}
