export type UserRank = 'standard' | 'iron' | 'gold' | 'diamond' | 'emerald';

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

export const RANKS: Record<string, RankConfig> = {
  standard: {
    id: 'standard',
    name: 'Universal',
    tier: 1,
    maxAccounts: 10,
    maxServers: 10,
    summary: '10 Accounts combined across all servers',
    description: 'Flat 10-account capacity across all connected servers.',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    cardBorder: 'border-emerald-300 hover:border-emerald-400',
    glowColor: 'shadow-emerald-500/25',
    accentBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    accentText: 'text-emerald-600',
    gemIcon: '⚡',
    features: [
      '10 Minecraft Accounts',
      'Unlimited Server Profiles',
      '24/7 Background Termux AFK',
      'Swarm & Multi-Server Support',
    ],
  },
};

export const RANK_ORDER: UserRank[] = ['standard'];

export function getRankConfig(_rank?: string | null): RankConfig {
  return RANKS.standard;
}
