'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Key,
  RefreshCw,
  MessageSquare,
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
  ShieldAlert,
  Sliders,
  Filter,
  Radio,
  Wifi,
  WifiOff,
  Smartphone,
  Globe,
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
  tunnelUrl?: string;
  isTunnelActive?: boolean;
}

interface AdminTunnelItem {
  username: string;
  url: string;
  updatedAt: number;
  isRecent: boolean;
  activeBots: number;
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
  daemonUrl?: string;
  registeredTunnel?: string;
  legitimacy?: {
    status: 'legit' | 'leak' | 'unverified' | 'offline';
    badge: string;
    description: string;
    isLegit: boolean;
  };
}

interface AdminStats {
  totalUsers: number;
  totalAccounts: number;
  totalConnected: number;
  totalTunnels?: number;
  rankBreakdown: Record<string, number>;
}

export default function ChiefAdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalAccounts: 0,
    totalConnected: 0,
    totalTunnels: 0,
    rankBreakdown: { iron: 0, gold: 0, diamond: 0, emerald: 0 },
  });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [tunnels, setTunnels] = useState<AdminTunnelItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'users' | 'accounts' | 'overview'>('users');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRankFilter, setUserRankFilter] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'online' | 'offline' | 'legit' | 'suspicious'>('all');

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

  // Live Chat Map for Connected Bots: key -> array of up to 10 ChatMessage items
  const [liveChats, setLiveChats] = useState<Record<string, Array<{ text: string; formatted: string; timestamp: number }>>>({});
  const daemonSocketsRef = useRef<Map<string, WebSocket>>(new Map());

  // Connect WebSockets to online tunnels to receive live server chat & manage real-time disconnects
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Collect active tunnels from connected accounts
    const targetTunnels = new Map<string, { url: string; owner: string; secret?: string }>();
    
    // Build user -> secret map
    const userSecretMap = new Map<string, string>();
    users.forEach((u) => {
      if (u.secretCode) {
        userSecretMap.set(u.username.toLowerCase(), u.secretCode);
      }
    });

    accounts.forEach((a) => {
      if (a.isConnected) {
        const url = (a.daemonUrl || a.registeredTunnel || '').trim();
        const owner = (a.owner || '').trim().toLowerCase();
        if (url && url.startsWith('ws')) {
          targetTunnels.set(url, {
            url,
            owner,
            secret: userSecretMap.get(owner),
          });
        }
      }
    });

    // Close sockets no longer active
    daemonSocketsRef.current.forEach((ws, url) => {
      if (!targetTunnels.has(url)) {
        try { ws.close(); } catch {}
        daemonSocketsRef.current.delete(url);
      }
    });

    // Connect to each target tunnel
    targetTunnels.forEach((info, url) => {
      const existing = daemonSocketsRef.current.get(url);
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const ws = new WebSocket(url);
        daemonSocketsRef.current.set(url, ws);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'AUTH',
            payload: { username: info.owner, token: info.secret || '' }
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'AUTH_RESULT' && data.payload?.success) {
              ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
            } else if (data.type === 'CHAT_MESSAGE') {
              const msg = data.payload;
              const ignKey = (msg.accountUsername || '').toLowerCase().trim();
              const botKey = (msg.botId || '').toLowerCase().trim();
              const entry = {
                text: msg.raw || '',
                formatted: msg.formattedText || msg.raw || '',
                timestamp: msg.timestamp || Date.now(),
              };

              setLiveChats((prev) => {
                const next = { ...prev };
                if (ignKey) {
                  next[ignKey] = [...(next[ignKey] || []).slice(-9), entry];
                }
                if (botKey && botKey !== ignKey) {
                  next[botKey] = [...(next[botKey] || []).slice(-9), entry];
                }
                return next;
              });
            }
          } catch {}
        };

        ws.onclose = () => {
          daemonSocketsRef.current.delete(url);
        };

        ws.onerror = () => {
          try { ws.close(); } catch {}
          daemonSocketsRef.current.delete(url);
        };
      } catch (e) {}
    });
  }, [accounts, users]);

  useEffect(() => {
    return () => {
      daemonSocketsRef.current.forEach((ws) => {
        try { ws.close(); } catch {}
      });
      daemonSocketsRef.current.clear();
    };
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
        totalTunnels: 0,
        rankBreakdown: { iron: 0, gold: 0, diamond: 0, emerald: 0 },
      });
      setUsers(data.users || []);
      setAccounts(data.accounts || []);
      setTunnels(data.tunnels || []);
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
    // 1. Immediately send STOP_BOT via any connected daemon WebSockets
    try {
      daemonSocketsRef.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'STOP_BOT',
            payload: { botId: ign, id: ign, username: ign }
          }));
        }
      });
    } catch {}

    // 2. Call admin API to update Supabase and send backend STOP_BOT
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_account', accountId, ign }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect account');

      showToast(`Disconnected ${ign} from server.`, 'success');
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Disconnect / Clear Tunnel
  const handleDisconnectTunnel = async (username: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_tunnel', username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect tunnel');

      showToast(`Tunnel and bots disconnected for @${username}`, 'success');
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
      const q = accountSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.ign.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q) ||
        a.serverHost.toLowerCase().includes(q) ||
        (a.daemonUrl && a.daemonUrl.toLowerCase().includes(q)) ||
        (a.registeredTunnel && a.registeredTunnel.toLowerCase().includes(q)) ||
        (a.legitimacy?.badge && a.legitimacy.badge.toLowerCase().includes(q));

      let matchStatus = true;
      if (accountStatusFilter === 'online') {
        matchStatus = a.isConnected;
      } else if (accountStatusFilter === 'offline') {
        matchStatus = !a.isConnected;
      } else if (accountStatusFilter === 'legit') {
        matchStatus = a.isConnected && a.legitimacy?.status === 'legit';
      } else if (accountStatusFilter === 'suspicious') {
        matchStatus = a.isConnected && a.legitimacy?.status !== 'legit';
      }

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
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* LEFT SIDEBAR (Matching Dashboard Style) */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-2xs z-20 md:sticky md:top-0 md:h-screen">
        {/* Logo Bar - Clickable directly to Dashboard */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-left group hover:opacity-90 transition cursor-pointer"
            title="Return to PocketAFK Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400 text-white flex items-center justify-center font-black text-sm shadow-xs ring-2 ring-emerald-500/20 group-hover:scale-105 transition-transform">
              ⛏
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                  PocketAFK
                </span>
                <span className="w-2 h-2 rounded-full ring-2 bg-emerald-500 ring-emerald-500/30 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-700 font-mono font-bold uppercase tracking-wider">Chief Admin</span>
                <span className="text-slate-300">•</span>
                <span className="text-[10px] text-slate-400 font-mono">v2.4 Core</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1">
            Admin Sections
          </div>

          {/* Tab 1: Users & Ranks */}
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1 rounded-lg ${activeTab === 'users' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>Users & Ranks</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'users' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-600'
            }`}>
              {users.length}
            </span>
          </button>

          {/* Tab 2: MC Accounts & Connections */}
          <button
            onClick={() => setActiveTab('accounts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1 rounded-lg ${activeTab === 'accounts' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Server className="w-3.5 h-3.5" />
              </div>
              <span>MC Accounts</span>
            </div>
            <div className="flex items-center gap-1.5">
              {stats.totalConnected > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`${stats.totalConnected} online`} />
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'accounts' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-600'
              }`}>
                {accounts.length}
              </span>
            </div>
          </button>

          {/* Live Orchestration Quick Panel */}
          <div className="pt-4 mt-4 border-t border-slate-100 px-1 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2">
              Live Overview
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Activity className="w-3 h-3 text-emerald-600" />
                  Active Bots
                </span>
                <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {stats.totalConnected}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Radio className="w-3 h-3 text-purple-600" />
                  Termux Daemons
                </span>
                <span className="font-mono font-bold text-purple-600">
                  {tunnels.filter((t) => t.isRecent).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3 h-3 text-sky-600" />
                  Supabase Sync
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer with Admin Profile & Return to App */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-2 shrink-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                C
              </div>
              <span className="font-black text-xs text-slate-900">@Chief</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Root Panfi
            </span>
          </div>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer group"
          >
            <span>Back to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
          {/* Breadcrumb Left */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              {activeTab === 'users' ? <Users className="w-4 h-4" /> : <Server className="w-4 h-4" />}
            </div>
            <span className="text-xs font-bold text-slate-500">Chief Admin</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-black text-emerald-800 uppercase tracking-wide bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
              {activeTab === 'users' ? 'Users & Ranks' : 'Minecraft Accounts & Connections'}
            </span>
          </div>

          {/* Header Actions Right */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh Supabase data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
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
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <span className="hidden sm:inline">Dashboard</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
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
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                    <span className="font-mono">ID: {u.id.substring(0, 8)}...</span>
                                    <span>•</span>
                                    {u.isTunnelActive ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold" title={u.tunnelUrl}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Daemon Live
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">No Daemon</span>
                                    )}
                                  </div>
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
            {/* Live Phone Daemons & Cloudflare Tunnels (Termux Core) Overview Cards */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      Phone Daemons & Cloudflare Tunnels (Termux Core)
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        {tunnels.filter((t) => t.isRecent).length} Online
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Live SSL WebSocket bridges connecting Android Termux devices to PocketAFK</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Legit Owner Dedicated
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-300" /> Offline / Standby
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tunnels.length === 0 ? (
                  <div className="col-span-full py-4 text-center text-slate-400 text-xs italic">
                    No phone daemons registered yet. Users can start their daemon via the 1-click Termux command.
                  </div>
                ) : (
                  tunnels.map((tun) => {
                    const isLive = Boolean(tun.isRecent && tun.url);
                    const lastSyncSec = tun.updatedAt ? Math.max(0, Math.floor((nowTick - tun.updatedAt) / 1000)) : 0;
                    return (
                      <div
                        key={tun.username}
                        className={`p-3 rounded-xl border transition ${
                          isLive
                            ? 'bg-gradient-to-br from-emerald-50/50 to-teal-50/30 border-emerald-200 shadow-2xs'
                            : 'bg-slate-50/80 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-slate-900">@{tun.username}</span>
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Daemon
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 text-slate-600">
                                Inactive (Offline)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {tun.activeBots} {tun.activeBots === 1 ? 'bot' : 'bots'} running
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-1 text-[11px] font-mono bg-white/90 px-2 py-1 rounded-lg border border-slate-200/80">
                          <span className="truncate text-slate-700 select-all" title={tun.url}>
                            {tun.url || 'No active tunnel'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {tun.url && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tun.url);
                                  showToast(`Copied tunnel for @${tun.username}`, 'info');
                                }}
                                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                title="Copy tunnel URL"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            {tun.url && (
                              <button
                                onClick={() => handleDisconnectTunnel(tun.username)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                                title="Disconnect / clear daemon tunnel"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            Android Termux
                          </span>
                          <span>
                            {isLive
                              ? `Heartbeat ${formatUptime(lastSyncSec)} ago`
                              : tun.updatedAt
                              ? `Offline (last heartbeat ${formatUptime(lastSyncSec)} ago)`
                              : 'Offline'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-full sm:w-96">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search account, owner, server, or tunnel URL..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Filter:</span>
                <select
                  value={accountStatusFilter}
                  onChange={(e) => setAccountStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Accounts ({accounts.length})</option>
                  <option value="online">Online Bots Only ({accounts.filter((a) => a.isConnected).length})</option>
                  <option value="legit">Verified Legit Only ({accounts.filter((a) => a.isConnected && a.legitimacy?.status === 'legit').length})</option>
                  <option value="suspicious">Security Warnings / Leaks ({accounts.filter((a) => a.isConnected && a.legitimacy?.status !== 'legit').length})</option>
                  <option value="offline">Offline Only ({accounts.filter((a) => !a.isConnected).length})</option>
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
                      <th className="p-3.5">Tunnel & Daemon Endpoint</th>
                      <th className="p-3.5">Server Destination</th>
                      <th className="p-3.5">Security & Legitimacy</th>
                      <th className="p-3.5">Status & Uptime</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span>Loading accounts and analyzing tunnel security...</span>
                        </td>
                      </tr>
                    ) : filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No Minecraft accounts found matching your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((a) => {
                        const uptimeSec =
                          a.isConnected && a.connectedAt
                            ? Math.max(0, Math.floor((nowTick - a.connectedAt) / 1000))
                            : 0;

                        const displayTunnel = a.daemonUrl || a.registeredTunnel || '';

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

                            {/* Tunnel & Daemon Endpoint */}
                            <td className="p-3.5">
                              {displayTunnel ? (
                                <div className="space-y-1 max-w-[220px]">
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100/90 px-2 py-1 rounded-lg border border-slate-200">
                                    <span className="truncate" title={displayTunnel}>
                                      {displayTunnel}
                                    </span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(displayTunnel);
                                        showToast(`Copied tunnel URL`, 'info');
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0 cursor-pointer"
                                      title="Copy tunnel URL"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                    <Globe className="w-3 h-3 text-slate-400" />
                                    <span>Cloudflare SSL Tunnel</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-400 text-xs italic">
                                  No tunnel registered
                                </div>
                              )}
                            </td>

                            {/* Server Host & Live Chat */}
                            <td className="p-3.5">
                              <div className="font-mono text-xs text-slate-700 flex items-center gap-1.5 font-semibold">
                                <Server className="w-3 h-3 text-slate-400" />
                                <span>{a.serverHost}:{a.serverPort}</span>
                              </div>

                              {/* Live Server Chat for Connected Bot (up to 3 messages) */}
                              {a.isConnected && (
                                <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px] font-mono shadow-inner max-w-[280px] space-y-1">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                                    <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-emerald-400 uppercase tracking-wider">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      Live Chat
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-sans">last 3 msgs</span>
                                  </div>
                                  {(() => {
                                    const botChats =
                                      liveChats[a.ign.toLowerCase()] ||
                                      liveChats[(a.settings?.last_bot_id || '').toLowerCase()] ||
                                      [];
                                    if (botChats.length === 0) {
                                      return (
                                        <div className="text-slate-500 italic text-[9.5px] py-0.5">
                                          Listening for server messages...
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="space-y-1">
                                        {botChats.slice(-3).map((c, i) => (
                                          <div key={i} className="text-slate-300 truncate leading-snug" title={c.text}>
                                            <span className="text-slate-500 text-[8.5px] mr-1 select-none font-sans">
                                              {new Date(c.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                              })}
                                            </span>
                                            <span dangerouslySetInnerHTML={{ __html: c.formatted || c.text }} />
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </td>

                            {/* Security & Legitimacy Analysis */}
                            <td className="p-3.5">
                              {a.legitimacy?.status === 'legit' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    Verified Legit
                                  </span>
                                  <span className="text-[10px] text-emerald-700 font-medium">Owner Daemon Verified</span>
                                </div>
                              )}

                              {a.legitimacy?.status === 'leak' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 w-fit">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                    {a.legitimacy.badge}
                                  </span>
                                  <span className="text-[10px] text-rose-700 font-medium max-w-[200px] truncate" title={a.legitimacy.description}>
                                    {a.legitimacy.description}
                                  </span>
                                </div>
                              )}

                              {a.legitimacy?.status === 'unverified' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 w-fit">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    {a.legitimacy.badge}
                                  </span>
                                  <span className="text-[10px] text-amber-700 font-medium max-w-[200px] truncate" title={a.legitimacy.description}>
                                    {a.legitimacy.description}
                                  </span>
                                </div>
                              )}

                              {(!a.legitimacy || a.legitimacy.status === 'offline') && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Standby
                                  </span>
                                  <span className="text-[10px] text-slate-400">Offline</span>
                                </div>
                              )}
                            </td>

                            {/* Status & Uptime */}
                            <td className="p-3.5">
                              {a.isConnected ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Connected
                                  </span>
                                  <div className="font-mono text-emerald-700 font-bold text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatUptime(uptimeSec)}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Offline
                                  </span>
                                  <div className="text-slate-400 text-xs">-</div>
                                </div>
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
      </div>

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
