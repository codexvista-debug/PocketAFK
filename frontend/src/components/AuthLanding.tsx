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

const MOCK_BOTS: MockBotData[] = [
  {
    id: 'gambit',
    ign: 'Gambit25X51916',
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
    id: 'smoothbard',
    ign: 'SmoothBard81224',
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
    id: 'kjchris',
    ign: 'kjchris7',
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
  { time: '16:21:18', icon: '🛡️', text: 'Anti-AFK: subtle micro-yaw rotation executed (+3.8°)' },
  { time: '16:21:32', icon: '🎰', text: 'FreshSMP: AFK spin cooldown elapsed · 1 spin ready' },
  { time: '16:21:49', icon: '⚔️', text: 'DonutSMP: Mob farm active · 3,420 items collected' },
  { time: '16:22:05', icon: '🟢', text: 'All 3 accounts authenticated via official Microsoft MSA' },
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
      className="pa-deck-container group cursor-pointer"
      title="Click to launch PocketAFK Control Deck"
    >
      {/* Background with Command Deck Illustration */}
      <div className="pa-deck-bg" />
      <div className="pa-deck-overlay" />
      <div className="pa-deck-grid" />

      {/* Top Header Bar */}
      <div className="pa-deck-header">
        <div className="flex items-center gap-2">
          <span className="pa-deck-beacon" />
          <span className="font-black text-xs tracking-wider text-emerald-300">
            POCKETAFK LIVE DECK
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            v2.4 JAVA
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-300">
          <span className="flex items-center gap-1 text-emerald-400 bg-black/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            3 BOTS ACTIVE
          </span>
          <span className="hidden sm:inline-block text-slate-400 bg-black/30 px-2 py-0.5 rounded-full border border-slate-700">
            ⚡ {activeBot.ping}
          </span>
        </div>
      </div>

      {/* Bot Fleet Selector Tabs */}
      <div
        className="pa-deck-tabs"
        onClick={(e) => e.stopPropagation()}
      >
        {MOCK_BOTS.map((bot, idx) => {
          const isSelected = idx === activeBotIndex;
          return (
            <button
              key={bot.id}
              type="button"
              onClick={() => setActiveBotIndex(idx)}
              className={`pa-deck-tab-btn ${
                isSelected ? 'pa-deck-tab-active' : 'pa-deck-tab-idle'
              }`}
            >
              <div className="w-5 h-5 rounded-md overflow-hidden shrink-0 border border-slate-600 bg-slate-800">
                <img
                  src={`https://crafthead.net/helm/${encodeURIComponent(bot.ign)}/24`}
                  alt={bot.ign}
                  className="w-full h-full object-cover [image-rendering:pixelated]"
                />
              </div>
              <span className="truncate max-w-[90px]">{bot.ign}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Bot Telemetry Card */}
      <div className="pa-deck-body">
        <div className="pa-telemetry-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-400/60 bg-slate-900 shadow-md ring-2 ring-emerald-500/20">
                  <img
                    src={`https://crafthead.net/helm/${encodeURIComponent(activeBot.ign)}/48`}
                    alt={activeBot.ign}
                    className="w-full h-full object-cover [image-rendering:pixelated]"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-white tracking-tight drop-shadow-sm">
                    {activeBot.ign}
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    {activeBot.serverName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeBot.serverHost}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeBot.status}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                AFK: <strong className="text-slate-200">{activeBot.uptime}</strong>
              </div>
            </div>
          </div>

          {/* Vitals: Hearts, Food & Position */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                <span className="text-rose-400 text-xs">❤️❤️❤️❤️❤️</span>
                <span className="font-bold text-white text-[10px]">20/20 HP</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-300 font-mono">
                <span>🍗 19 Hunger</span>
                <span className="text-slate-400">· Auto-Eat ON</span>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] space-y-0.5">
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
        <div className="pa-feature-callout">
          <div className="flex items-center gap-2">
            {activeBot.tagType === 'reward' && <Gift className="w-4 h-4 text-amber-400 animate-bounce" />}
            {activeBot.tagType === 'farm' && <Swords className="w-4 h-4 text-purple-400 animate-pulse" />}
            {activeBot.tagType === 'reconnect' && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
            <div>
              <div className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                <span>{activeBot.tagTitle}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  LIVE
                </span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                {activeBot.tagDesc}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform">
            <span>Control</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Termux Phone Daemon Indicator */}
        <div className="pa-termux-pill">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-black text-[10px] text-slate-200">
              Android Termux Daemon
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            ● 0% CPU · 38MB RAM · Standby 24/7
          </span>
        </div>
      </div>

      {/* Live Animated Event Console Stream */}
      <div className="pa-deck-footer">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0">{LOG_MESSAGES[activeLogIndex].icon}</span>
          <span className="text-[9px] font-mono text-slate-400 shrink-0">
            [{LOG_MESSAGES[activeLogIndex].time}]
          </span>
          <span className="text-[10px] font-mono text-slate-200 truncate">
            {LOG_MESSAGES[activeLogIndex].text}
          </span>
        </div>
        <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider shrink-0 hidden sm:block">
          Click to open deck →
        </div>
      </div>
    </div>
  );
}

export function AuthLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="pa-landing">
      {/* Dynamic Atmospheric Overworld Background */}
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
