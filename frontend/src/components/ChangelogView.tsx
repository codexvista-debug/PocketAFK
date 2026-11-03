'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Radio,
  ArrowUpRight,
  GitBranch,
  Search,
  CheckCircle2,
  Calendar,
  Flame,
} from 'lucide-react';

interface ChangeItem {
  type: 'feature' | 'improvement' | 'fix' | 'infra';
  title: string;
  description: string;
  badge?: string;
}

interface Release {
  version: string;
  title: string;
  date: string;
  relativeDate: string;
  tagline: string;
  isLatest?: boolean;
  highlightIcon: string;
  changes: ChangeItem[];
}

const RELEASES: Release[] = [
  {
    version: 'v2.4.2',
    title: '7-Day Zero-Drop & Real-Time Sync',
    date: 'Nov 3, 2026',
    relativeDate: 'Today',
    tagline: 'Instant 1-second WebSocket pairing, 7+ day continuous Android daemon stability, and smart session badges.',
    isLatest: true,
    highlightIcon: '⚡',
    changes: [
      {
        type: 'feature',
        title: 'Zero-Delay WebSocket Auto-Pairing',
        description: 'Termux 1-click launcher now pairs with the web dashboard within 1–2 seconds of startup, eliminating the previous connection delay.',
        badge: 'Instant Sync',
      },
      {
        type: 'infra',
        title: '7+ Day Termux Stability Supervisor',
        description: 'Added automated Cloudflare tunnel process supervision and non-terminating heartbeat loop to ensure sessions remain live without dropping for 7 days or more.',
        badge: 'High Availability',
      },
      {
        type: 'feature',
        title: 'Live Relative Timestamps on Sessions',
        description: 'Daemon history sessions now display dynamic live-updating relative timestamps (e.g. Started 2m ago) alongside the calendar date.',
        badge: 'Real-Time',
      },
      {
        type: 'feature',
        title: 'Connected Server Badges in Session Cards',
        description: 'Recent session cards visually display the Minecraft servers connected during that run, including server icons and names.',
        badge: 'Dashboard UI',
      },
      {
        type: 'improvement',
        title: 'Click-Outside Backdrop Dismiss for Logs Modal',
        description: 'Account audit and live logs popup can now be dismissed instantly by clicking anywhere on the background overlay or pressing Escape.',
        badge: 'UX Polish',
      },
      {
        type: 'fix',
        title: 'PostgreSQL Case-Insensitive Tunnel Normalization',
        description: 'Resolved database case conflicts between capitalized and lowercase usernames, ensuring flawless single-source-of-truth lookups.',
        badge: 'Database',
      },
    ],
  },
  {
    version: 'v2.4.1',
    title: 'Universal Capacity & Signet Mascot',
    date: 'Nov 2, 2026',
    relativeDate: 'Yesterday',
    tagline: 'Universal 10-account limit for all players, full server profile deletion freedom, and Signet 3D Allay mascot.',
    highlightIcon: '🧚',
    changes: [
      {
        type: 'feature',
        title: 'Universal 10-Account Capacity for Everyone',
        description: 'Completely abolished rank tier paywalls (Iron, Gold, Diamond, Emerald). All players now enjoy full flat capacity of 10 Minecraft accounts and 10 server profiles.',
        badge: 'Free Tier Unlimited',
      },
      {
        type: 'feature',
        title: 'Flexible Server Profile Deletion',
        description: 'Players can now delete and reconfigure any server profile freely, even if only one server profile exists on the account.',
        badge: 'Management',
      },
      {
        type: 'improvement',
        title: 'Default Landing View Switched to Dashboard',
        description: 'Upon login or site visit, users land directly on the Overview Dashboard instead of an empty profile view.',
        badge: 'Navigation',
      },
      {
        type: 'feature',
        title: 'Signet 3D Allay Live Mascot',
        description: 'Integrated custom 3D Allay mascot (Signet) into the header and bridge status indicators, visually signaling online vs offline daemon connectivity.',
        badge: 'Mascot',
      },
      {
        type: 'infra',
        title: 'Dual Dev & Prod Pipeline Separation',
        description: 'Automated preview testing branch (dev-pocketafk.vercel.app) isolated from production (pocketafk.vercel.app) to verify changes before rolling out.',
        badge: 'DevOps',
      },
    ],
  },
  {
    version: 'v2.4.0',
    title: 'Pure Java Core Engine Launch',
    date: 'Nov 1, 2026',
    relativeDate: '3 days ago',
    tagline: 'Android Termux headless Mineflayer engine with zero-port-forwarding WebSocket tunneling.',
    highlightIcon: '☕',
    changes: [
      {
        type: 'feature',
        title: 'Pure Java Mineflayer Engine for Android Termux',
        description: 'Engineered a 24/7 background AFK runner optimized for Android hardware with low CPU usage, battery wake-lock, and persistent notification service.',
        badge: 'Core Engine',
      },
      {
        type: 'feature',
        title: 'Encrypted Cloudflare Tunnel WebSocket Bridge',
        description: 'Zero-configuration cloud connection. No port forwarding, VPNs, or static IP addresses required to link phones to the web app.',
        badge: 'Security',
      },
      {
        type: 'feature',
        title: 'Bidirectional In-Game Chat Console',
        description: 'Stream in-game Minecraft chat live to your browser with full Minecraft §-color formatting, and send commands/messages directly from the web.',
        badge: 'Chat Stream',
      },
      {
        type: 'feature',
        title: 'Remote Container & Inventory Viewer',
        description: 'Inspect opened chests, barrels, and player inventory slots live from the dashboard with one-click slot interaction.',
        badge: 'Inventory',
      },
      {
        type: 'feature',
        title: 'Discord Webhook Notifications',
        description: 'Configurable real-time webhook alerts for bot spawn, disconnects, kicks, player deaths, and server reboots.',
        badge: 'Webhooks',
      },
    ],
  },
];

export const ChangelogView: React.FC = () => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    'v2.4.2': true,
    'v2.4.1': true,
    'v2.4.0': false,
  });

  const toggleVersion = (v: string) => {
    setExpandedVersions((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  const filteredReleases = RELEASES.map((rel) => {
    const matchingChanges = rel.changes.filter((c) => {
      const matchCat = selectedCategory === 'all' || c.type === selectedCategory;
      const q = filterQuery.toLowerCase();
      const matchQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        rel.version.toLowerCase().includes(q) ||
        (c.badge && c.badge.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });

    return {
      ...rel,
      matchingChanges,
    };
  }).filter((rel) => rel.matchingChanges.length > 0);

  const getCategoryBadge = (type: ChangeItem['type']) => {
    switch (type) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-2xs">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            NEW FEATURE
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-950/70 text-sky-300 border border-sky-700/60 shadow-2xs">
            <Zap className="w-3 h-3 text-sky-400" />
            IMPROVEMENT
          </span>
        );
      case 'fix':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-700/60 shadow-2xs">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            FIX
          </span>
        );
      case 'infra':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/70 text-purple-300 border border-purple-700/60 shadow-2xs">
            <GitBranch className="w-3 h-3 text-purple-400" />
            INFRASTRUCTURE
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-200 pb-12 text-[#eee9dc]">
      {/* Header Banner Card */}
      <section className="overflow-hidden rounded-2xl border border-[#514d43] bg-[#252421]/95 shadow-2xl mb-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#454239] bg-gradient-to-r from-[#2c2f25] via-[#282723] to-[#252421] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-950/60 text-emerald-300 shadow-md">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a8a18f]">PocketAFK Releases</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/70 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Dev → Prod Synced
                </span>
              </div>
              <h1 className="text-xl font-black sm:text-2xl tracking-tight text-[#f5f1e6]">System Changelog</h1>
              <p className="mt-0.5 text-xs text-[#bcb5a6]">All developer updates, core engine enhancements, and features deployed to production.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#514d43] bg-[#302e29] px-3 py-1.5 text-xs font-bold text-[#d8d1c2]">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Latest: v2.4.2
            </span>
          </div>
        </header>

        {/* Filter and Search Bar */}
        <div className="px-5 py-4 border-b border-[#454239] bg-[#211f1c]/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Updates' },
              { id: 'feature', label: 'Features' },
              { id: 'improvement', label: 'Improvements' },
              { id: 'fix', label: 'Fixes' },
              { id: 'infra', label: 'Infrastructure' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-900/70 text-emerald-200 border border-emerald-700/80 shadow-xs'
                    : 'bg-[#2b2925] text-[#bcb5a6] border border-[#4c493f] hover:text-[#eee9dc] hover:border-[#605a4e]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#8c8577] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search changes or features..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#2b2925] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#8c8577] focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Changelog Timeline List */}
        <div className="p-5 sm:p-7 space-y-6">
          {filteredReleases.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#bcb5a6]">
              No updates match your filter query.
            </div>
          ) : (
            filteredReleases.map((rel) => {
              const isExpanded = expandedVersions[rel.version] ?? true;
              return (
                <div
                  key={rel.version}
                  className="rounded-xl border border-[#4c493f] bg-[#2b2925] overflow-hidden transition-all shadow-md"
                >
                  {/* Version Header Card */}
                  <header
                    onClick={() => toggleVersion(rel.version)}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-[#32302a] border-b border-[#454239] cursor-pointer hover:bg-[#38362f] transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl select-none">{rel.highlightIcon}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base text-[#f5f1e6]">{rel.version}</span>
                          <span className="text-[#a8a18f] font-normal">—</span>
                          <span className="font-extrabold text-sm text-emerald-300">{rel.title}</span>
                          {rel.isLatest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-900/80 text-emerald-200 border border-emerald-600/70">
                              LATEST PRODUCTION
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#bcb5a6] mt-0.5">{rel.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#eee9dc] block">{rel.relativeDate}</span>
                        <span className="text-[10px] text-[#8c8577]">{rel.date}</span>
                      </div>
                      <span className="p-1 rounded-lg text-[#aaa393] hover:text-white">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </header>

                  {/* Changes List */}
                  {isExpanded && (
                    <div className="divide-y divide-[#3d3a33] p-1">
                      {rel.matchingChanges.map((change, cIdx) => (
                        <div
                          key={cIdx}
                          className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 hover:bg-[#2f2e29]/60 transition rounded-lg"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getCategoryBadge(change.type)}
                              <h3 className="text-xs sm:text-sm font-bold text-[#eee9dc]">
                                {change.title}
                              </h3>
                            </div>
                            <p className="mt-1 text-xs text-[#bcb5a6] leading-relaxed">
                              {change.description}
                            </p>
                          </div>

                          {change.badge && (
                            <span className="shrink-0 self-start sm:self-center inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#21201d] text-[#a8a18f] border border-[#4c493f]">
                              {change.badge}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#454239] bg-[#211f1c]/70 px-5 py-3.5 text-[11px] text-[#9f998c] sm:px-7">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dev pipeline verified & tested before production merge</span>
          </div>
          <span>Build v2.4.2 · Pure Java Core</span>
        </footer>
      </section>
    </div>
  );
};
