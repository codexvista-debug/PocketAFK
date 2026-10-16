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
}

export interface Account {
  id: string;
  user_id?: string;
  username: string;
  auth_type: 'microsoft' | 'offline';
  server_host: string;
  server_port: number;
  server_version?: string;
  auto_reconnect: boolean;
  anti_afk: {
    enabled: boolean;
    interval: number;
  };
  survival: {
    autoEat: boolean;
    autoTotem: boolean;
  };
  mob_farm: {
    enabled: boolean;
    targetRange: number;
    attackCooldownMs: number;
  };
  settings: {
    physics: boolean;
    acceptResourcePacks: boolean;
    muteErrors?: boolean;
    autoDisconnectOnBan?: boolean;
  };
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
  id: string;
  timestamp: number;
  raw: string;
  formattedText: string;
  sender?: string;
  type: 'chat' | 'system' | 'session_divider' | 'death' | 'error';
}

export interface Telemetry {
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
