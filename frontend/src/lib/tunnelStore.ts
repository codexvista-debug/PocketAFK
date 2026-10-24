// Global in-memory tunnel store shared across Next.js API routes

export interface CachedTunnelRecord {
  url: string;
  token: string;
  updatedAt: number;
  daemonStartedAt?: number;
  lastDisconnectedAt?: number | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __pocketAfkTunnels: Map<string, CachedTunnelRecord> | undefined;
}

if (!global.__pocketAfkTunnels) {
  global.__pocketAfkTunnels = new Map<string, CachedTunnelRecord>();
}

export const sharedUserTunnels = global.__pocketAfkTunnels;
