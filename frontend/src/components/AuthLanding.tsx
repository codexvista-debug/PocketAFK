'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  AudioLines,
  Box,
  Check,
  ShieldCheck,
  Sparkles,
  Activity,
  Heart,
  Server,
  Terminal,
  Zap,
  Gift,
  Radio,
  ChevronRight,
  Swords,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface MockBotData {
  id: string;
  ign: string;
  avatarUrl: string;
  serverName: string;
  serverHost: string;
  status: string;
  uptime: string;
  coords: string;
  hearts: number;
  food: number;
  ping: string;
  tag: string;
  tagType: 'reward' | 'farm' | 'reconnect';
  tagTitle: string;
  tagDesc: string;
}

// Random fictional Minecraft accounts (do not belong to any real player)
const MOCK_BOTS: MockBotData[] = [
  {
    id: 'cobble_nomad',
    ign: 'CobbleNomad_42',
    avatarUrl: 'https://crafthead.net/helm/Steve/48',
    serverName: 'FreshSMP',
    serverHost: 'mc.freshsmp.fun',
    status: 'ONLINE · AFK',
    uptime: '18h 42m',
    coords: 'X: 412, Y: 72, Z: -188',
    hearts: 10,
    food: 19,
    ping: '14ms',
    tag: '🎁 REWARD READY',
    tagType: 'reward',
    tagTitle: 'Daily AFK Spin Ready',
    tagDesc: 'Type /afkrewards spin to claim 1x Netherite Crate',
  },
  {
    id: 'redstone_fox',
    ign: 'RedstoneFox_',
    avatarUrl: 'https://crafthead.net/helm/Alex/48',
    serverName: 'DonutSMP',
    serverHost: 'donutsmp.net',
    status: 'ONLINE · MOB FARM',
    uptime: '9h 15m',
    coords: 'X: -1280, Y: 64, Z: 540',
    hearts: 10,
    food: 20,
    ping: '22ms',
    tag: '⚔️ FARM ACTIVE',
    tagType: 'farm',
    tagTitle: 'Mob Farm Sweep Armed',
    tagDesc: 'Auto-attack active · 4,200 cobble & drops/hr',
  },
  {
    id: 'pixel_drifter',
    ign: 'PixelDrifter',
    avatarUrl: 'https://crafthead.net/helm/Oak/48',
    serverName: 'Hypixel',
    serverHost: 'mc.hypixel.net',
    status: 'ONLINE · LOBBY AFK',
    uptime: '4h 50m',
    coords: 'X: 0, Y: 100, Z: 0',
    hearts: 10,
    food: 20,
    ping: '18ms',
    tag: '🛡️ AUTO-RECONNECT',
    tagType: 'reconnect',
    tagTitle: 'Proxy Guard Active',
    tagDesc: 'Auto-reconnects in 5s if lobby resets',
  },
];

const LOG_MESSAGES = [
  { time: '16:21:04', icon: '⚡', text: 'Termux daemon bridge alive on ws://127.0.0.1:8080' },
  { time: '16:21:18', icon: '🛡️', text: 'Anti-AFK: natural micro-yaw rotation executed (+3.8°)' },
  { time: '16:21:32', icon: '🎰', text: 'FreshSMP: CobbleNomad_42 spin cooldown elapsed · ready' },
  { time: '16:21:49', icon: '⚔️', text: 'DonutSMP: RedstoneFox_ mob farm active · 3,420 items collected' },
  { time: '16:22:05', icon: '🟢', text: 'All 3 bots online & authenticated via official Microsoft MSA' },
];

function HeroCommandDeck({ onSignIn }: { onSignIn: () => void }) {
  const [activeBotIndex, setActiveBotIndex] = useState(0);
  const [activeLogIndex, setActiveLogIndex] = useState(0);

  const activeBot = MOCK_BOTS[activeBotIndex];

  // Rotate log ticker every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLogIndex((prev) => (prev + 1) % LOG_MESSAGES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      onClick={onSignIn}
      className="pa-deck-container group cursor-pointer w-full select-none"
      title="Click to launch PocketAFK Control Deck"
    >
      {/* Background with Command Deck Illustration */}
      <div className="pa-deck-bg" />
      <div className="pa-deck-overlay" />
      <div className="pa-deck-grid" />

      {/* Top Header Bar */}
      <div className="pa-deck-header flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="pa-deck-beacon shrink-0" />
          <span className="font-black text-[11px] sm:text-xs tracking-wider text-emerald-300 truncate">
            POCKETAFK LIVE DECK
          </span>
          <span className="hidden xs:inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shrink-0">
            v2.4 JAVA
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono font-bold text-slate-300 shrink-0">
          <span className="flex items-center gap-1 text-emerald-400 bg-black/50 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[9px] sm:text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            3 BOTS ACTIVE
          </span>
          <span className="hidden sm:inline-block text-slate-400 bg-black/40 px-2 py-0.5 rounded-full border border-slate-700 text-[10px]">
            ⚡ {activeBot.ping}
          </span>
        </div>
      </div>

      {/* Bot Fleet Selector Tabs (Touch-friendly & mobile scrollable) */}
      <div
        className="pa-deck-tabs flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 overflow-x-auto touch-pan-x"
        onClick={(e) => e.stopPropagation()}
      >
        {MOCK_BOTS.map((bot, idx) => {
          const isSelected = idx === activeBotIndex;
          return (
            <button
              key={bot.id}
              type="button"
              onClick={() => setActiveBotIndex(idx)}
              className={`pa-deck-tab-btn flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isSelected ? 'pa-deck-tab-active' : 'pa-deck-tab-idle'
              }`}
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded overflow-hidden shrink-0 border border-slate-600 bg-slate-800">
                <img
                  src={bot.avatarUrl}
                  alt={bot.ign}
                  className="w-full h-full object-cover [image-rendering:pixelated]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://minotar.net/helm/MHF_Steve/32.png';
                  }}
                />
              </div>
              <span className="truncate">{bot.ign}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Bot Telemetry Card */}
      <div className="pa-deck-body p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        <div className="pa-telemetry-card p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 border-emerald-400/60 bg-slate-900 shadow-md ring-2 ring-emerald-500/20">
                  <img
                    src={activeBot.avatarUrl}
                    alt={activeBot.ign}
                    className="w-full h-full object-cover [image-rendering:pixelated]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/helm/MHF_Steve/48.png';
                    }}
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-white tracking-tight drop-shadow-sm truncate">
                    {activeBot.ign}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-md">
                    {activeBot.serverName}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">
                    {activeBot.serverHost}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex xs:flex-col items-center xs:items-end justify-between xs:justify-center gap-1 shrink-0 pt-1 xs:pt-0 border-t xs:border-t-0 border-slate-800">
              <div className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeBot.status}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                AFK: <strong className="text-slate-200">{activeBot.uptime}</strong>
              </div>
            </div>
          </div>

          {/* Vitals: Hearts, Food & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-700/60 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-slate-300">
                <span className="text-rose-400 text-xs tracking-tighter">❤️❤️❤️❤️❤️</span>
                <span className="font-bold text-white text-[10px]">20/20 HP</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-amber-300 font-mono">
                <span>🍗 19 Hunger</span>
                <span className="text-slate-400">· Auto-Eat ON</span>
              </div>
            </div>

            <div className="sm:text-right font-mono text-[9px] sm:text-[10px] space-y-0.5">
              <div className="text-slate-400">
                POS: <span className="text-emerald-300 font-bold">{activeBot.coords}</span>
              </div>
              <div className="text-slate-400">
                TASK: <span className="text-sky-300 font-semibold">Anti-AFK Drift Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Project Feature Highlight Badge */}
        <div className="pa-feature-callout p-2.5 sm:p-3 rounded-xl sm:rounded-2xl">
          <div className="flex items-center gap-2 min-w-0">
            {activeBot.tagType === 'reward' && <Gift className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />}
            {activeBot.tagType === 'farm' && <Swords className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />}
            {activeBot.tagType === 'reconnect' && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />}
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                <span className="truncate">{activeBot.tagTitle}</span>
                <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30 shrink-0">
                  LIVE
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 line-clamp-1">
                {activeBot.tagDesc}
              </div>
            </div>
          </div>

          <div className="hidden xs:flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform ml-2">
            <span>Control</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Termux Phone Daemon Indicator */}
        <div className="pa-termux-pill px-3 py-2 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-black text-[9px] sm:text-[10px] text-slate-200 truncate">
              Android Termux Daemon
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 shrink-0">
            ● 0% CPU · 38MB RAM · 24/7
          </span>
        </div>
      </div>

      {/* Live Animated Event Console Stream */}
      <div className="pa-deck-footer px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span className="text-xs shrink-0">{LOG_MESSAGES[activeLogIndex].icon}</span>
          <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 shrink-0">
            [{LOG_MESSAGES[activeLogIndex].time}]
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono text-slate-200 truncate">
            {LOG_MESSAGES[activeLogIndex].text}
          </span>
        </div>
        <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider shrink-0 hidden sm:block">
          Open Deck →
        </div>
      </div>
    </div>
  );
}

export function AuthLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="pa-landing">
      {/* Nostalgic Cozy Overworld Background */}
      <div className="pa-atmosphere" aria-hidden="true" />

      {/* Navigation Header */}
      <header className="pa-nav">
        <a href="/" className="pa-brand" aria-label="PocketAFK home">
          <span className="pa-brand-mark">
            <img src="/pocketafk-emblem.png" alt="PocketAFK" />
          </span>
          <span className="pa-brand-copy">
            <b>PocketAFK</b>
            <small>JAVA CONTROL DECK</small>
          </span>
        </a>
        <div className="pa-nav-right">
          <span className="pa-edition-pill">
            <span /> MADE FOR JAVA
          </span>
          <button onClick={onSignIn} className="pa-nav-login cursor-pointer">
            Sign in <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pa-hero">
        <div className="pa-copy">
          <div className="pa-eyebrow">
            <span /> YOUR WORLD, UNDER CONTROL
          </div>
          <h1>
            Keep your<br />world <em>moving.</em>
          </h1>
          <p className="pa-intro">
            One home for your <strong>Java accounts</strong>, server profiles, live chat, and the Termux daemon that keeps your crew online 24/7.
          </p>
          <button onClick={onSignIn} className="pa-primary-cta cursor-pointer">
            <span className="pa-cta-icon">
              <ArrowRight size={17} />
            </span>
            <span>
              Sign in or create an account
              <small>Your next adventure is one click away</small>
            </span>
            <ArrowRight className="pa-cta-arrow" size={18} />
          </button>
          <div className="pa-trust">
            <ShieldCheck size={16} /> Your server credentials stay in your control.
          </div>
          <div className="pa-feature-row">
            <span><Box size={14} /> JAVA EDITION</span>
            <i />
            <span><AudioLines size={14} /> TERMUX READY</span>
            <i />
            <span><Check size={14} /> YOUR OWN ACCOUNTS</span>
          </div>
        </div>

        {/* Right Hero Showcase Element: Creative, eye-catching Live Command Deck */}
        <div className="pa-showcase-wrapper">
          <HeroCommandDeck onSignIn={onSignIn} />
        </div>
      </section>

      {/* Footer */}
      <footer className="pa-footer">
        <span>BUILT FOR YOUR LITTLE CORNER OF THE OVERWORLD</span>
        <span>POCKETAFK <i>/</i> JAVA EDITION</span>
      </footer>
    </main>
  );
}
