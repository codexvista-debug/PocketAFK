'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  GitCommit,
} from 'lucide-react';
import { Release, ChangeItem } from '../app/api/changelog/route';

type FilterCategory = 'all' | 'feature' | 'improvement' | 'fix' | 'infra';

export function ChangelogView() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    'v2.4.2': true,
    'v2.4.1': true,
    'v2.4.0': false,
  });

  const fetchChangelog = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/changelog');
      const data = await res.json();
      if (data.success && Array.isArray(data.releases)) {
        setReleases(data.releases);
      }
    } catch (e) {
      console.error('Failed to fetch changelog:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChangelog();
  }, []);

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const getCategoryBadge = (type: ChangeItem['type']) => {
    switch (type) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-600/60 shadow-xs">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>NEW FEATURE</span>
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-950/70 text-sky-300 border border-sky-600/60 shadow-xs">
            <ArrowUpRight className="w-3 h-3 text-sky-400" />
            <span>IMPROVEMENT</span>
          </span>
        );
      case 'fix':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-600/60 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-amber-400" />
            <span>FIX</span>
          </span>
        );
      case 'infra':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-950/70 text-purple-300 border border-purple-600/60 shadow-xs">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>INFRASTRUCTURE</span>
          </span>
        );
    }
  };

  const filteredReleases = useMemo(() => {
    return releases
      .map((rel) => {
        const matchingChanges = rel.changes.filter((change) => {
          if (activeFilter !== 'all' && change.type !== activeFilter) {
            return false;
          }
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchTitle = change.title.toLowerCase().includes(query);
            const matchDesc = change.description.toLowerCase().includes(query);
            const matchBadge = change.badge?.toLowerCase().includes(query);
            return matchTitle || matchDesc || matchBadge;
          }
          return true;
        });

        return {
          ...rel,
          matchingChanges,
        };
      })
      .filter((rel) => rel.matchingChanges.length > 0);
  }, [releases, activeFilter, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Main Hero Section */}
      <section className="rounded-2xl border border-[#4c493f] bg-[#252421] p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#a8a18f]">
                  PocketAFK Releases
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-600/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Dev — Prod Synced
                </span>
                {refreshing && (
                  <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                    Syncing GitHub...
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#eee9dc] tracking-tight">
                System Changelog
              </h1>
              <p className="text-xs text-[#bcb5a6] max-w-xl leading-relaxed">
                All developer updates, core engine enhancements, and features deployed automatically to production.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => fetchChangelog(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-[#1d1c19] hover:bg-[#32302a] border border-[#4c493f] text-[#bcb5a6] hover:text-[#eee9dc] transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Sync latest commits from GitHub"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1d1c19] border border-[#4c493f] text-xs font-bold text-[#eee9dc] shadow-sm">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Latest: v2.4.2</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar Section */}
      <section className="rounded-2xl border border-[#4c493f] bg-[#252421] p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#3d3a33] pb-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Updates' },
              { id: 'feature', label: 'Features' },
              { id: 'improvement', label: 'Improvements' },
              { id: 'fix', label: 'Fixes' },
              { id: 'infra', label: 'Infrastructure' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as FilterCategory)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/80 shadow-xs'
                    : 'bg-[#1e1d1a] text-[#a8a18f] hover:text-[#eee9dc] hover:bg-[#2c2a26] border border-[#3e3b33]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#8c8577] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search changes or features..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#1a1916] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#8c8577] focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Changelog Timeline List */}
        <div className="space-y-5 pt-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-[#bcb5a6]">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs font-mono">Loading automated changelog...</p>
            </div>
          ) : filteredReleases.length === 0 ? (
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
                              {change.sha && (
                                <a
                                  href={change.commitUrl || `https://github.com/codexvista-debug/PocketAFK/commit/${change.sha}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1c1b18] hover:bg-[#34322c] border border-[#3e3b33] text-[10px] font-mono text-[#8c8577] hover:text-emerald-300 transition"
                                  title="View commit on GitHub"
                                >
                                  <span>-o-</span>
                                  <span>{change.sha}</span>
                                </a>
                              )}
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

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#454239] bg-[#211f1c]/70 px-5 py-3.5 text-[11px] text-[#9f998c] sm:px-7 rounded-xl mt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dev pipeline verified & tested before production merge</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[#8c8577]">Auto-Synced from GitHub</span>
            <span>Build v2.4.2 · Pure Java Core</span>
          </div>
        </footer>
      </section>
    </div>
  );
}
