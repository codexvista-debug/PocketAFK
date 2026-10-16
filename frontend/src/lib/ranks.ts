export type UserRank = 'iron' | 'gold' | 'diamond' | 'emerald';

export interface RankConfig {
  id: UserRank;
  name: string;
  tier: number;
  maxAccounts: number;
  maxServers: number;
  summary: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  glowColor: string;
  accentBg: string;
  accentText: string;
  gemIcon: string;
  features: string[];
}

export const RANKS: Record<UserRank, RankConfig> = {
  iron: {
    id: 'iron',
    name: 'Iron',
    tier: 1,
    maxAccounts: 1,
    maxServers: 1,
    summary: '1 Account / 1 Server Profile',
    description: 'Perfect for single-bot AFK farming on your primary server.',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    cardBorder: 'border-slate-300 hover:border-slate-400',
    glowColor: 'shadow-slate-500/10',
    accentBg: 'bg-slate-700 hover:bg-slate-800 text-white',
    accentText: 'text-slate-700',
    gemIcon: '🪙',
    features: [
      '1 Minecraft Account',
      '1 Server Profile',
      '24/7 Background Termux AFK',
      'Standard Reconnect & Physics',
    ],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    tier: 2,
    maxAccounts: 3,
    maxServers: 3,
    summary: '3 Accounts across all servers',
    description: 'Ideal for running multiple bots across multiple servers simultaneously.',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    cardBorder: 'border-amber-300 hover:border-amber-400',
    glowColor: 'shadow-amber-500/15',
    accentBg: 'bg-amber-500 hover:bg-amber-600 text-white',
    accentText: 'text-amber-600',
    gemIcon: '🥇',
    features: [
      '3 Minecraft Accounts',
      'Up to 3 Server Profiles',
      'Concurrent Multi-Server AFK',
      'Priority Reconnect & Movement',
    ],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    tier: 3,
    maxAccounts: 6,
    maxServers: 3,
    summary: '6 Accounts across all servers',
    description: 'Enhanced tier for bot farms, base protection, and clan utility.',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-300',
    cardBorder: 'border-sky-300 hover:border-sky-400',
    glowColor: 'shadow-sky-500/20',
    accentBg: 'bg-sky-600 hover:bg-sky-700 text-white',
    accentText: 'text-sky-600',
    gemIcon: '💎',
    features: [
      '6 Minecraft Accounts',
      'Up to 3 Server Profiles',
      'Full Bot Swarm Automation',
      'Advanced Anti-AFK & Fast Physics',
    ],
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    tier: 4,
    maxAccounts: 10,
    maxServers: 3,
    summary: '10 Accounts combined across servers',
    description: 'The ultimate rank for maximum account automation and full clan coverage.',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    cardBorder: 'border-emerald-300 hover:border-emerald-400',
    glowColor: 'shadow-emerald-500/25',
    accentBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    accentText: 'text-emerald-600',
    gemIcon: '❇️',
    features: [
      '10 Minecraft Accounts',
      'Up to 3 Server Profiles',
      'Unrestricted Account Assignment',
      'Real-time Chat, Inventory & Remote View',
    ],
  },
};

export const RANK_ORDER: UserRank[] = ['iron', 'gold', 'diamond', 'emerald'];

export function getRankConfig(rank?: string | null): RankConfig {
  const clean = (rank || '').toLowerCase().trim() as UserRank;
  return RANKS[clean] || RANKS.iron;
}
