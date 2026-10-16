'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Key,
  RefreshCw,
  Trash2,
  Edit3,
  Check,
  X,
  ExternalLink,
  Lock,
  Server,
  Activity,
  Clock,
  Sparkles,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Power,
  Copy,
  ArrowRight,
  ChevronDown,
  UserPlus,
  ShieldCheck,
  Sliders,
  Filter,
} from 'lucide-react';
import { RANKS, RANK_ORDER, UserRank } from '@/lib/ranks';

interface UserItem {
  id: string;
  username: string;
  rank: UserRank;
  accountCount: number;
  connectedCount: number;
  secretCode?: string;
  createdAt: string;
}

interface AccountItem {
  id: string;
  owner: string;
  ign: string;
  serverHost: string;
  serverPort: number;
  isConnected: boolean;
  connectedAt?: number;
  updatedAt?: string;
  createdAt?: string;
  settings?: any;
}

interface AdminStats {
  totalUsers: number;
  totalAccounts: number;
  totalConnected: number;
  rankBreakdown: Record<string, number>;
}

export default function ChiefAdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalAccounts: 0,
    totalConnected: 0,
    rankBreakdown: { iron: 0, gold: 0, diamond: 0, emerald: 0 },
  });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'users' | 'accounts' | 'overview'>('users');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRankFilter, setUserRankFilter] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Modal States
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState<boolean>(false);
  const [createUsername, setCreateUsername] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('');
  const [createRank, setCreateRank] = useState<UserRank>('iron');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'account'; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast / Banner feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Live timer for uptimes
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Fetch all admin data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load admin data (${res.status})`);
      }
      const data = await res.json();
      setStats(data.stats || {
        totalUsers: 0,
        totalAccounts: 0,
        totalConnected: 0,
        rankBreakdown: { iron: 0, gold: 0, diamond: 0, emerald: 0 },
      });
      setUsers(data.users || []);
      setAccounts(data.accounts || []);
    } catch (err: any) {
      showToast(err.message || 'Error fetching data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Rank Change
  const handleChangeRank = async (username: string, newRank: UserRank) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_rank', username, rank: newRank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update rank');

      showToast(`Updated @${username}'s rank to ${RANKS[newRank]?.name || newRank}!`, 'success');
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.username.toLowerCase() === username.toLowerCase() ? { ...u, rank: newRank } : u))
      );
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          username: resetPasswordUser.username,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      showToast(`Password for @${resetPasswordUser.username} successfully updated!`, 'success');
      setResetPasswordUser(null);
      setNewPassword('');
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Handle Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername || !createPassword) return;
    setIsCreatingUser(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_user',
          username: createUsername,
          password: createPassword,
          rank: createRank,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showToast(`User @${createUsername} registered with ${RANKS[createRank]?.name} rank!`, 'success');
      setIsCreateUserOpen(false);
      setCreateUsername('');
      setCreatePassword('');
      setCreateRank('iron');
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'user') {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_user', username: deleteTarget.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete user');
        showToast(`User @${deleteTarget.name} deleted.`, 'success');
      } else {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_account', accountId: deleteTarget.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete account');
        showToast(`Account ${deleteTarget.name} deleted.`, 'success');
      }
      setDeleteTarget(null);
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Disconnect Account
  const handleDisconnectAccount = async (accountId: string, ign: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_account', accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect account');

      showToast(`Marked ${ign} as disconnected.`, 'info');
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.secretCode && u.secretCode.toLowerCase().includes(userSearch.toLowerCase()));
      const matchRank = userRankFilter === 'all' || u.rank === userRankFilter;
      return matchSearch && matchRank;
    });
  }, [users, userSearch, userRankFilter]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchSearch =
        a.ign.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.owner.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.serverHost.toLowerCase().includes(accountSearch.toLowerCase());
      const matchStatus =
        accountStatusFilter === 'all' ||
        (accountStatusFilter === 'online' && a.isConnected) ||
        (accountStatusFilter === 'offline' && !a.isConnected);
      return matchSearch && matchStatus;
    });
  }, [accounts, accountSearch, accountStatusFilter]);

  // Format seconds into uptime
  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Banner: Reminder for future IP protection */}
      <div className="bg-gradient-to-r from-amber-600 via-emerald-600 to-teal-600 text-white text-[11px] py-2 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-white/20 font-black uppercase text-[10px] tracking-wider">
              Chief Admin Mode
            </span>
            <span>
              <strong>Admin Control Panel</strong> — Manage users, password resets, rank tiers, and active connections.
            </span>
          </div>
          <div className="text-amber-100 flex items-center gap-1.5 text-[11px]">
            <Lock className="w-3 h-3" />
            <span>IP protection can be activated upon project completion.</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black shadow-sm ring-2 ring-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900">PocketAFK Chief Admin</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Root Panel
                </span>
              </div>
              <p className="text-xs text-slate-500">Live Supabase Database & Bot Orchestration Control</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh all data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>

            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Back to App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in slide-in-from-top-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-sky-50 text-sky-900 border-sky-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {toast.type === 'info' && <Activity className="w-4 h-4 text-sky-600" />}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* 4 Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Users</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.totalUsers}</span>
              <span className="text-xs text-slate-400 font-medium">accounts in Supabase</span>
            </div>
          </div>

          {/* Minecraft Accounts */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Minecraft Accounts</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.totalAccounts}</span>
              <span className="text-xs text-slate-400 font-medium">linked across users</span>
            </div>
          </div>

          {/* Active Connections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Connections</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {stats.totalConnected}
              </span>
              <span className="text-xs text-slate-400 font-medium">online bots</span>
            </div>
          </div>

          {/* Rank Distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Rank Breakdown</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700">
                Iron: {stats.rankBreakdown?.iron || 0}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800">
                Gold: {stats.rankBreakdown?.gold || 0}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-800">
                Dia: {stats.rankBreakdown?.diamond || 0}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">
                Emr: {stats.rankBreakdown?.emerald || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Ranks ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Minecraft Accounts & Connections ({accounts.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS & RANKS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user or secret code..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Rank:</span>
                <select
                  value={userRankFilter}
                  onChange={(e) => setUserRankFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Ranks</option>
                  <option value="iron">Iron (1 Bot)</option>
                  <option value="gold">Gold (3 Bots)</option>
                  <option value="diamond">Diamond (6 Bots)</option>
                  <option value="emerald">Emerald (10 Bots)</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Assigned Rank</th>
                      <th className="p-3.5">Linked Accounts</th>
                      <th className="p-3.5">Secret Code</th>
                      <th className="p-3.5">Registered</th>
                      <th className="p-3.5 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span>Loading users from Supabase...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const rankCfg = RANKS[u.rank] || RANKS.iron;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition">
                            {/* User details */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-800 text-xs">
                                  {u.username.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">@{u.username}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">ID: {u.id.substring(0, 8)}...</span>
                                </div>
                              </div>
                            </td>

                            {/* Rank Selector */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <select
                                  value={u.rank}
                                  onChange={(e) => handleChangeRank(u.username, e.target.value as UserRank)}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-black border transition cursor-pointer shadow-2xs ${rankCfg.badgeBg} ${rankCfg.badgeText} ${rankCfg.badgeBorder}`}
                                >
                                  {RANK_ORDER.map((r) => (
                                    <option key={r} value={r}>
                                      {RANKS[r].gemIcon} {RANKS[r].name} ({RANKS[r].maxAccounts} Max)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>

                            {/* Accounts & Active */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {u.accountCount} / {rankCfg.maxAccounts}
                                </span>
                                {u.connectedCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {u.connectedCount} online
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Secret Code */}
                            <td className="p-3.5">
                              {u.secretCode ? (
                                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                                  <span>{u.secretCode}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(u.secretCode!);
                                      showToast(`Copied secret code for @${u.username}`, 'info');
                                    }}
                                    className="text-slate-400 hover:text-slate-700 p-0.5"
                                    title="Copy secret code"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">No password hash</span>
                              )}
                            </td>

                            {/* Date Registered */}
                            <td className="p-3.5 text-slate-500 text-[11px]">
                              {new Date(u.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setResetPasswordUser(u);
                                    setNewPassword('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Reset password for this user"
                                >
                                  <Key className="w-3 h-3 text-amber-600" />
                                  <span>Password</span>
                                </button>

                                <button
                                  onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.username })}
                                  className="p-1.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer shadow-2xs"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MINECRAFT ACCOUNTS & LIVE CONNECTIONS */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search account, owner, or server..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Status:</span>
                <select
                  value={accountStatusFilter}
                  onChange={(e) => setAccountStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Accounts</option>
                  <option value="online">Online Bots Only</option>
                  <option value="offline">Offline Only</option>
                </select>
              </div>
            </div>

            {/* Accounts Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3.5">Minecraft Account</th>
                      <th className="p-3.5">PocketAFK Owner</th>
                      <th className="p-3.5">Server Destination</th>
                      <th className="p-3.5">Connection Status</th>
                      <th className="p-3.5">Uptime</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span>Loading accounts...</span>
                        </td>
                      </tr>
                    ) : filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No Minecraft accounts found.
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((a) => {
                        const uptimeSec =
                          a.isConnected && a.connectedAt
                            ? Math.max(0, Math.floor((nowTick - a.connectedAt) / 1000))
                            : 0;

                        return (
                          <tr key={a.id} className="hover:bg-slate-50/80 transition">
                            {/* IGN & Head */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                                  <img
                                    src={`https://crafthead.net/helm/${encodeURIComponent(a.ign.split('@')[0])}/32`}
                                    alt={a.ign}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{a.ign}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">Row ID: {a.id.substring(0, 8)}...</span>
                                </div>
                              </div>
                            </td>

                            {/* Owner */}
                            <td className="p-3.5">
                              <span className="px-2 py-1 rounded-lg bg-slate-100 font-bold text-slate-800 text-xs">
                                @{a.owner}
                              </span>
                            </td>

                            {/* Server Host */}
                            <td className="p-3.5">
                              <div className="font-mono text-xs text-slate-700 flex items-center gap-1.5">
                                <Server className="w-3 h-3 text-slate-400" />
                                <span>{a.serverHost}:{a.serverPort}</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-3.5">
                              {a.isConnected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Connected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Offline
                                </span>
                              )}
                            </td>

                            {/* Uptime */}
                            <td className="p-3.5">
                              {a.isConnected ? (
                                <span className="font-mono text-emerald-700 font-bold text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatUptime(uptimeSec)}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {a.isConnected && (
                                  <button
                                    onClick={() => handleDisconnectAccount(a.id, a.ign)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 hover:text-amber-700 text-xs font-semibold transition cursor-pointer"
                                    title="Mark bot as disconnected"
                                  >
                                    <Power className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleteTarget({ type: 'account', id: a.id, name: a.ign })}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Delete account row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: RESET PASSWORD */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Reset Password</h3>
                  <p className="text-xs text-slate-500">For user @{resetPasswordUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Secure Password</label>
                <input
                  type="text"
                  required
                  placeholder="Enter new password (min 4 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || newPassword.length < 4}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isResettingPassword ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New User</h3>
                  <p className="text-xs text-slate-500">Register directly into Supabase</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username <span className="text-slate-400 font-normal">(1-6 alphanumeric characters)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. Chief"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="text"
                  required
                  placeholder="Password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Rank Tier</label>
                <select
                  value={createRank}
                  onChange={(e) => setCreateRank(e.target.value as UserRank)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="iron">Iron (1 Bot)</option>
                  <option value="gold">Gold (3 Bots)</option>
                  <option value="diamond">Diamond (6 Bots)</option>
                  <option value="emerald">Emerald (10 Bots)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser || !createUsername || !createPassword}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Delete {deleteTarget.type === 'user' ? 'User' : 'Account'}?
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {deleteTarget.type === 'user'
                ? 'This will delete the user account and all their linked Minecraft bots from Supabase.'
                : 'This will remove this Minecraft bot record from Supabase.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
