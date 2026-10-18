'use client';

import React from 'react';
import {
  Server,
  Users,
  ShieldCheck,
  Cpu,
  Zap,
  Lock,
  RefreshCw,
  Smartphone,
  Sparkles,
  Layers,
  ArrowRight,
  Activity,
  CheckCircle2,
  HardDrive,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { MinecraftAccount, ServerProfile, UserRank } from '../types';
import { getRankConfig } from '../lib/ranks';

interface DashboardOverviewProps {
  accounts: MinecraftAccount[];
  servers: ServerProfile[];
  socketStatus: string;
  currentUser: string | null;
  userRank: UserRank;
  onNavigate: (view: 'dashboard' | 'profile' | 'servers' | 'accounts', serverId?: string) => void;
  onOpenAddAccount: () => void;
  onOpenAddServer: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  accounts,
  servers,
  socketStatus,
  currentUser,
  userRank,
  onNavigate,
  onOpenAddAccount,
  onOpenAddServer,
}) => {
  const rankConfig = getRankConfig(userRank);
  const isOnline = socketStatus === 'AUTHENTICATED';
  const verifiedAccounts = accounts.filter((a) => a.verified);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-white text-slate-900 p-6 sm:p-8 border border-slate-200 shadow-xs">
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-sky-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>PocketAFK v2.4 Java Core • 24/7 Mobile AFK Engine</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">
              Your 24/7 Minecraft AFK Operations Hub
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              PocketAFK runs headless Java Minecraft bots directly on Android via Termux or lightweight background servers.
              Keep cobblestone generators running, chunks loaded, and accounts active around the clock with zero computer power consumption.
            </p>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                onClick={() => onNavigate('servers')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Server className="w-4 h-4" />
                <span>Go to Servers</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              <button
                onClick={() => onNavigate('accounts')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Users className="w-4 h-4 text-slate-600" />
                <span>Manage Accounts ({accounts.length}/{rankConfig.maxAccounts})</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Badge Card */}
          <div className="grid grid-cols-2 gap-3 shrink-0 lg:w-72 bg-slate-50/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Daemon Status</span>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20' : 'bg-rose-500'}`} />
                <span className="text-xs font-extrabold text-slate-900">{isOnline ? 'Active Online' : 'Standby / Offline'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">User Rank</span>
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">{rankConfig.gemIcon}</span>
                <span className="text-xs font-extrabold text-amber-600 truncate">{rankConfig.name}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Server Profiles</span>
              <span className="text-base font-black text-slate-900">{servers.length} <span className="text-xs text-slate-400 font-normal">/ {rankConfig.maxServers}</span></span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Linked Java IGNs</span>
              <span className="text-base font-black text-emerald-600">{verifiedAccounts.length} <span className="text-xs text-slate-400 font-normal">/ {rankConfig.maxAccounts}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE THREE CORE KNOWLEDGE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: What is PocketAFK */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Smartphone className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900">What is PocketAFK?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                A purpose-built Minecraft Java client engineered to run headless 24/7 on Android smartphones via Termux or background Linux instances.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 pt-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>Zero Battery Drain:</b> Consumes under ~50MB RAM with zero 3D GPU rendering required.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>24/7 Persistence:</b> Keeps chunk loaders active and mob farms harvesting all night without heating your PC.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>Autonomous Reconnect:</b> Automatically logs back in after server restarts or network hiccups.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 inline-flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Native Node.js Protocol
            </span>
          </div>
        </div>

        {/* Card 2: How Accounts Are Stored */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900">How Are Accounts Stored?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                PocketAFK uses official Microsoft OAuth 2.0 Device Code authorization (the exact same method used by Xbox &amp; Nintendo Switch).
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 pt-1">
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span><b>Zero Passwords:</b> You never type your Microsoft password on PocketAFK. Microsoft handles authentication directly.</span>
              </li>
              <li className="flex items-start gap-2">
                <HardDrive className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span><b>Local 90-Day Tokens:</b> Rolling refresh tokens are saved locally in Termux (<code>~/.pocketafk_tokens/</code>) and survive restarts.</span>
              </li>
              <li className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span><b>Private Isolation:</b> Every verification forces <code>prompt=login</code> so you can safely link multiple Microsoft accounts.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200/60 inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              100% Official Microsoft OAuth
            </span>
          </div>
        </div>

        {/* Card 3: How Does It Work */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900">How Does It Work?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                A distributed architecture connecting your phone or browser to the background daemon via real-time WebSockets.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 pt-1">
              <li className="flex items-start gap-2">
                <Layers className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span><b>Dashboard UI:</b> Beautiful Next.js frontend gives full control over bots, live inventory, chat, and POV minimap.</span>
              </li>
              <li className="flex items-start gap-2">
                <Activity className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span><b>Live Telemetry:</b> Coordinates, health, yaw, nearby machines, and online players stream instantly in real-time.</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span><b>Automated Survival:</b> Background handlers manage Auto-Eat, Anti-AFK rotations, Totem equipping, and mob attacks.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/60 inline-flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              WebSocket Bidirectional Sync
            </span>
          </div>
        </div>
      </div>

      {/* 3. ARCHITECTURE VISUALIZATION */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-black text-slate-900">Architecture &amp; Pipeline Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How PocketAFK orchestrates communication from your browser to your Minecraft server.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              1
            </div>
            <h4 className="font-bold text-xs text-slate-900">Web Dashboard</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Provides responsive controls, quick commands, inventory slots, chat receiver switching, and live player activity logs.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              2
            </div>
            <h4 className="font-bold text-xs text-slate-900">WebSocket Bridge</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Maintains secure bidirectional communication between the dashboard and the background daemon on port 3001.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              3
            </div>
            <h4 className="font-bold text-xs text-slate-900">Termux Daemon</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Runs in the background on your phone 24/7. Manages Mineflayer bot instances, token cache, and reconnect loops.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              4
            </div>
            <h4 className="font-bold text-xs text-slate-900">Minecraft Java Server</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Connects to Paper, Purpur, Spigot, or Vanilla servers. Emulates official client packets to prevent kicks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
