'use client';

import React from 'react';
import {
  Hammer,
  Construction,
  Bell,
  Sparkles,
  ShieldCheck,
  Zap,
  Activity,
  Bot,
  Radio,
  Clock,
} from 'lucide-react';
import { WebhookConfig } from '@/types';

interface WebhookViewProps {
  currentUser: string;
  config: WebhookConfig;
  onUpdateConfig: (nextConfig: WebhookConfig) => void;
  onSaveConfig: () => Promise<void>;
  isDaemonConnected: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function WebhookView({
  currentUser,
  config,
  onUpdateConfig,
  onSaveConfig,
  isDaemonConnected,
  showToast,
}: WebhookViewProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-[#252421] via-[#1e1d1a] to-[#161513] border border-[#4c493f] shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto space-y-4">
          {/* Construction Badge & Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
              <Construction className="w-8 h-8 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#2e2c26] border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Hammer className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Under Construction
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#eee9dc] tracking-tight">
              Discord Webhooks
            </h1>
            <p className="text-xs sm:text-sm text-[#b5af9f] leading-relaxed">
              Discord Webhook notifications and activity channels are currently undergoing an engine overhaul to support 7-day unattended background stability and unified multi-bot streaming.
            </p>
          </div>
        </div>
      </div>

      {/* What's Coming in the Redesign */}
      <div className="p-6 rounded-2xl bg-[#252421] border border-[#4c493f] shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9d9685]">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Planned Features In Active Development</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#1d1c19] border border-[#3e3b33] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#eee9dc] block">Instant Kick & Disconnect Alerts</span>
              <p className="text-[11px] text-[#9d9685] leading-relaxed">
                Direct push pings to your private channel when a bot gets kicked, AFK-routed, or disconnected.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1d1c19] border border-[#3e3b33] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#eee9dc] block">Survival & Health Warnings</span>
              <p className="text-[11px] text-[#9d9685] leading-relaxed">
                Emergency pings if your bot takes mob damage, suffers suffocation, or health drops below critical levels.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1d1c19] border border-[#3e3b33] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#eee9dc] block">Phone Daemon & Bridge Status</span>
              <p className="text-[11px] text-[#9d9685] leading-relaxed">
                Heartbeat pings from your Android Termux device or VPS so you know when the bridge is online.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1d1c19] border border-[#3e3b33] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#eee9dc] block">Unified Multi-Account Relays</span>
              <p className="text-[11px] text-[#9d9685] leading-relaxed">
                All 10 active bots stream join confirmations, server transfers, and AFK rewards to a single feed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
