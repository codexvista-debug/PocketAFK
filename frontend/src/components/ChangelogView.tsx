'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  GitCommit,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Search,
  CheckCircle2,
  Globe,
  Clock,
  Sparkles,
  Shield,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { DeploymentItem } from '../app/api/changelog/route';

export function ChangelogView() {
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'Production' | 'Preview'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // 1-second interval to update relative times live
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchDeployments = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/changelog');
      const data = await res.json();
      if (data.success && Array.isArray(data.deployments)) {
        setDeployments(data.deployments);
        setLastRefreshed(Date.now());
      }
    } catch (e) {
      console.error('Failed to load changelog:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const formatRelativeTime = (timestamp: number) => {
    const elapsedSec = Math.max(0, Math.floor((nowTick - timestamp) / 1000));
    if (elapsedSec < 45) return 'just now';
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays}d ago`;
  };

  const filteredDeployments = useMemo(() => {
    return deployments.filter((d) => {
      if (activeFilter !== 'all' && d.environment !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchMsg = d.message.toLowerCase().includes(query);
        const matchSha = d.shortSha.toLowerCase().includes(query);
        const matchBranch = d.branch.toLowerCase().includes(query);
        const matchAuthor = d.author.name.toLowerCase().includes(query);
        return matchMsg || matchSha || matchBranch || matchAuthor;
      }
      return true;
    });
  }, [deployments, activeFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-[#252421] via-[#22211e] to-[#1a1916] border border-[#4c493f] shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-[10px] uppercase tracking-wider">
                Automated CI/CD Feed
              </span>
              <span className="text-[11px] text-[#8e8777] font-mono">
                Updated {formatRelativeTime(lastRefreshed)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#eee9dc] tracking-tight">
              Project Deployments & Changelog
            </h1>
            <p className="text-xs text-[#b5af9f] max-w-2xl leading-relaxed">
              Real-time changelog generated automatically from GitHub commits and Vercel builds. Every push to dev and production updates this ledger instantly.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={() => fetchDeployments(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-[#302e29] hover:bg-[#383630] border border-[#4c493f] text-[#eee9dc] text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-60 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <a
              href="https://github.com/codexvista-debug/PocketAFK"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-2 active:scale-95"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#252421] border border-[#4c493f] shadow-lg">
        {/* Environment Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-[#3e3b33] text-[#eee9dc] border border-[#5c584b]'
                : 'text-[#9d9685] hover:text-[#eee9dc] hover:bg-[#2e2c26]'
            }`}
          >
            <span>All Deployments</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#1a1916] text-[#b5af9f] font-mono">
              {deployments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('Production')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'Production'
                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/50'
                : 'text-[#9d9685] hover:text-blue-200 hover:bg-[#2e2c26]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Production</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#1a1916] text-[#b5af9f] font-mono">
              {deployments.filter((d) => d.environment === 'Production').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('Preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'Preview'
                ? 'bg-[#383630] text-[#eee9dc] border border-[#555246]'
                : 'text-[#9d9685] hover:text-[#eee9dc] hover:bg-[#2e2c26]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Preview (Dev)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#1a1916] text-[#b5af9f] font-mono">
              {deployments.filter((d) => d.environment === 'Preview').length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#8e8777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter commits, sha, or branch..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1d1c19] border border-[#3e3b33] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Deployments List (Vercel Style) */}
      <div className="rounded-2xl bg-[#252421] border border-[#4c493f] shadow-2xl overflow-hidden divide-y divide-[#383630]">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs text-[#b5af9f] font-mono">Fetching automated deployment history...</p>
          </div>
        ) : filteredDeployments.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-sm font-bold text-[#eee9dc]">No deployments found</p>
            <p className="text-xs text-[#8e8777]">Try clearing your search query or switching filters.</p>
          </div>
        ) : (
          filteredDeployments.map((item) => {
            const isProd = item.environment === 'Production';

            return (
              <div
                key={item.id}
                className="p-4 sm:px-5 sm:py-3.5 hover:bg-[#2d2b27] transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                {/* Left: Commit Message & Status */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Status Indicator */}
                  <div
                    className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md bg-[#1d1c19] border border-[#3e3b33]"
                    title={`Status: Ready in ${item.buildDuration}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[10px] text-emerald-300 font-bold">
                      {item.status} {item.buildDuration}
                    </span>
                  </div>

                  {/* Commit message text with syntax tag highlight */}
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#eee9dc] hover:text-emerald-300 transition truncate block max-w-xl"
                      title={item.fullMessage}
                    >
                      {item.message}
                    </a>
                  </div>
                </div>

                {/* Right: Environment, SHA, Branch, Time, Author */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap sm:flex-nowrap justify-between md:justify-end">
                  {/* Environment Badge */}
                  {isProd ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-xs tracking-tight">
                      <span className="text-[10px]">▲</span>
                      <span>Production</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#383630] border border-[#4c493f] text-[#c7bfb0] text-[11px] font-bold">
                      <span className="text-[10px]">◎</span>
                      <span>Preview</span>
                    </span>
                  )}

                  {/* Commit SHA */}
                  <a
                    href={item.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1d1c19] hover:bg-[#34322c] border border-[#3e3b33] font-mono text-[11px] text-[#b5af9f] hover:text-[#eee9dc] transition"
                    title="View commit on GitHub"
                  >
                    <span className="text-[#686358]">-o-</span>
                    <span>{item.shortSha}</span>
                  </a>

                  {/* Branch */}
                  <span className="flex items-center gap-1 text-[11px] text-[#a49e8e] font-mono">
                    <GitBranch className="w-3.5 h-3.5 text-[#756f62]" />
                    <span className={item.branch === 'main' ? 'text-blue-300 font-bold' : 'text-[#a49e8e]'}>
                      {item.branch}
                    </span>
                  </span>

                  {/* Relative Timestamp */}
                  <span className="text-[11px] text-[#8e8777] font-mono min-w-[55px] text-right">
                    {formatRelativeTime(item.timestamp)}
                  </span>

                  {/* Author Avatar */}
                  <a
                    href={item.author.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:opacity-80 transition"
                    title={`Committed by ${item.author.name} (@${item.author.login})`}
                  >
                    <img
                      src={item.author.avatarUrl}
                      alt={item.author.login}
                      className="w-5 h-5 rounded-full border border-[#4c493f] bg-[#1d1c19]"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </a>

                  {/* External Link */}
                  <a
                    href={item.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-[#756f62] hover:text-[#eee9dc] transition"
                    title="Open on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
