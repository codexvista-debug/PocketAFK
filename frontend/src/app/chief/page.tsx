'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ChevronDown,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Wifi,
  WifiOff,
  Smartphone,
  Globe,
  BarChart3,
  LogOut,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { MinecraftChatMessage } from '@/components/MinecraftChatMessage';

interface UserItem {
  id: string;
  username: string;
  rank?: string;
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
}

export default function ChiefAdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalAccounts: 0,
    totalConnected: 0,
    totalTunnels: 0,
  });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [tunnels, setTunnels] = useState<AdminTunnelItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'accounts'>('stats');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState<string>('');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Environment detection & prod security gate
  const [isDevSite, setIsDevSite] = useState<boolean>(true);
  const [isProdUnlocked, setIsProdUnlocked] = useState<boolean>(false);
  const [prodUnlockInput, setProdUnlockInput] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isDev = hostname.includes('dev-pocketafk') || hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('preview');
      setIsDevSite(isDev);
      if (isDev) {
        setIsProdUnlocked(true);
      } else {
        const storedAuth = localStorage.getItem('pocketafk_chief_admin_auth');
        if (storedAuth === 'unlocked') {
          setIsProdUnlocked(true);
        }
      }
    }
  }, []);

  // System Config States
  const [isRegistrationsPaused, setIsRegistrationsPaused] = useState<boolean>(false);
  const [isTogglingRegistrations, setIsTogglingRegistrations] = useState<boolean>(false);

  // Emergency Action Modal State
  const [emergencyModal, setEmergencyModal] = useState<{
    type: 'force_refresh' | 'force_logout' | 'force_close_termux';
    title: string;
    description: string;
  } | null>(null);
  const [isExecutingEmergency, setIsExecutingEmergency] = useState<boolean>(false);

  // User Management Modals
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState<boolean>(false);
  const [createUsername, setCreateUsername] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'account'; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Live chat drawer for bots
  const [activeChatBot, setActiveChatBot] = useState<AccountItem | null>(null);
  const [liveChats, setLiveChats] = useState<Record<string, Array<{ text: string; timestamp: number }>>>({});
  const daemonSocketsRef = useRef<Map<string, WebSocket>>(new Map());

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin data');

      setStats(data.stats || {
        totalUsers: (data.users || []).length,
        totalAccounts: (data.accounts || []).length,
        totalConnected: (data.accounts || []).filter((a: any) => a.isConnected).length,
        totalTunnels: (data.tunnels || []).filter((t: any) => t.isRecent).length,
      });
      setUsers(data.users || []);
      setAccounts(data.accounts || []);
      setTunnels(data.tunnels || []);
      setIsRegistrationsPaused(Boolean(data.isRegistrationsPaused));
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isProdUnlocked) {
      fetchData();
      const interval = setInterval(() => fetchData(true), 10000);
      return () => clearInterval(interval);
    }
  }, [fetchData, isProdUnlocked]);

  // Connect WebSockets to online tunnels to receive live server chat
  useEffect(() => {
    if (typeof window === 'undefined' || !isProdUnlocked) return;

    const targetTunnels = new Map<string, { url: string; owner: string; secret?: string }>();
    const userSecretMap = new Map<string, string>();
    users.forEach((u) => {
      if (u.secretCode) userSecretMap.set(u.username.toLowerCase(), u.secretCode);
    });

    accounts.forEach((a) => {
      if (a.isConnected) {
        const url = (a.daemonUrl || a.registeredTunnel || '').trim();
        const owner = (a.owner || '').trim().toLowerCase();
        if (url && url.startsWith('ws')) {
          targetTunnels.set(url, { url, owner, secret: userSecretMap.get(owner) });
        }
      }
    });

    daemonSocketsRef.current.forEach((ws, url) => {
      if (!targetTunnels.has(url)) {
        try { ws.close(); } catch {}
        daemonSocketsRef.current.delete(url);
      }
    });

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
            payload: { token: info.secret || '', username: info.owner || 'chief' },
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CHAT_MESSAGE' && data.payload) {
              const bId = data.payload.botId || 'default';
              const rawText = data.payload.text || data.payload.raw || data.payload.message || '';
              if (!rawText) return;

              setLiveChats((prev) => {
                const cur = prev[bId] || [];
                return {
                  ...prev,
                  [bId]: [...cur.slice(-25), { text: rawText, timestamp: data.payload.timestamp || Date.now() }],
                };
              });
            }
          } catch {}
        };
      } catch {}
    });

    return () => {
      daemonSocketsRef.current.forEach((ws) => {
        try { ws.close(); } catch {}
      });
      daemonSocketsRef.current.clear();
    };
  }, [accounts, users, isProdUnlocked]);

  // Handle Toggle Registrations
  const handleToggleRegistrations = async () => {
    setIsTogglingRegistrations(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_registrations', paused: !isRegistrationsPaused }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update registrations');

      setIsRegistrationsPaused(data.isRegistrationsPaused);
      showToast(data.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsTogglingRegistrations(false);
    }
  };

  // Handle Emergency Action Execution
  const handleExecuteEmergencyAction = async () => {
    if (!emergencyModal) return;
    setIsExecutingEmergency(true);
    try {
      const actionName =
        emergencyModal.type === 'force_refresh'
          ? 'emergency_force_refresh'
          : emergencyModal.type === 'force_logout'
          ? 'emergency_force_logout'
          : 'emergency_force_close_termux';

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Emergency action failed');

      showToast(data.message, 'success');
      setEmergencyModal(null);
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsExecutingEmergency(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', username: resetPasswordUser.username, newPassword }),
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

  // Handle Create User Submit
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
          rank: 'universal',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showToast(`User @${createUsername} registered with 10 Bots Universal Capacity!`, 'success');
      setIsCreateUserOpen(false);
      setCreateUsername('');
      setCreatePassword('');
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
      daemonSocketsRef.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'STOP_BOT', payload: { botId: ign, id: ign, username: ign } }));
        }
      });
    } catch {}

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_account', accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect account');

      showToast(`Disconnected bot ${ign}`, 'success');
      fetchData(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Disconnect User Tunnel
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
      const q = userSearch.toLowerCase().trim();
      return (
        !q ||
        u.username.toLowerCase().includes(q) ||
        (u.secretCode && u.secretCode.toLowerCase().includes(q))
      );
    });
  }, [users, userSearch]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((a) => {
        const q = accountSearch.toLowerCase().trim();
        const matchSearch =
          !q ||
          a.ign.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.serverHost.toLowerCase().includes(q) ||
          (a.daemonUrl && a.daemonUrl.toLowerCase().includes(q));

        let matchStatus = true;
        if (accountStatusFilter === 'online') matchStatus = a.isConnected;
        if (accountStatusFilter === 'offline') matchStatus = !a.isConnected;

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (a.isConnected && !b.isConnected) return -1;
        if (!a.isConnected && b.isConnected) return 1;
        return (b.connectedAt || 0) - (a.connectedAt || 0);
      });
  }, [accounts, accountSearch, accountStatusFilter]);

  // Server Host distribution
  const hostStats = useMemo(() => {
    const map = new Map<string, { total: number; online: number }>();
    accounts.forEach((acc) => {
      const host = (acc.serverHost || 'Unknown Server').toLowerCase().trim();
      const curr = map.get(host) || { total: 0, online: 0 };
      curr.total += 1;
      if (acc.isConnected) curr.online += 1;
      map.set(host, curr);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [accounts]);

  // Production Security Barrier
  if (!isDevSite && !isProdUnlocked) {
    return (
      <div className="min-h-screen bg-[#1a1916] text-[#eee9dc] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#4c493f] bg-[#252421] p-6 sm:p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-600/60 flex items-center justify-center text-amber-400 mb-4 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-center text-[#f5f1e6]">Chief Admin Security Barrier</h1>
          <p className="mt-2 text-xs text-center text-[#bcb5a6] leading-relaxed">
            This production host (<span className="text-amber-300 font-mono">pocketafk.vercel.app</span>) is restricted. For enhanced security, manage production data via the isolated Developer Console.
          </p>

          <div className="mt-5 space-y-3">
            <a
              href="https://dev-pocketafk.vercel.app/chief"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-md transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Secure Dev Admin Console</span>
            </a>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#454239]" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold"><span className="bg-[#252421] px-2 text-[#8c8577]">Or Unlock Direct Access</span></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (prodUnlockInput.trim().length >= 4) {
                  localStorage.setItem('pocketafk_chief_admin_auth', 'unlocked');
                  setIsProdUnlocked(true);
                } else {
                  showToast('Enter valid authorization secret', 'error');
                }
              }}
              className="space-y-2.5"
            >
              <input
                type="password"
                placeholder="Chief Master Secret Key..."
                value={prodUnlockInput}
                onChange={(e) => setProdUnlockInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#201f1c] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-[#302e29] border border-[#514d43] hover:border-emerald-600 text-xs font-bold text-[#ded8c9] transition"
              >
                Unlock Production Admin
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1916] text-[#eee9dc] font-sans flex flex-col md:flex-row">
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200' :
          toast.type === 'error' ? 'bg-rose-950/90 border-rose-600 text-rose-200' :
          'bg-[#302e29] border-[#514d43] text-[#ded8c9]'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR (Dark Theme) */}
      <aside className="w-full md:w-64 bg-[#21201d] border-r border-[#4c493f] flex flex-col shrink-0 shadow-2xl z-20 md:sticky md:top-0 md:h-screen">
        {/* Logo Bar */}
        <div className="p-4 border-b border-[#454239] bg-[#262420] flex items-center justify-between">
          <Link
            href="/?tab=dashboard"
            className="flex items-center gap-2.5 text-left group hover:opacity-90 transition cursor-pointer"
            title="Return to Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-emerald-500/20 group-hover:scale-105 transition-transform">
              ⛏
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-[#eee9dc] tracking-tight group-hover:text-emerald-300 transition-colors">
                  PocketAFK
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Chief Admin</span>
                <span className="text-[#514d43]">•</span>
                <span className="text-[10px] text-[#bcb5a6] font-mono">v2.4 Core</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Environment Security Badge */}
        <div className="px-4 py-2.5 bg-[#1b1a17] border-b border-[#3d3a33] text-[10px] font-mono flex items-center gap-2 text-[#bcb5a6]">
          <span className={`w-2 h-2 rounded-full ${isDevSite ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{isDevSite ? 'Dev Console • Prod DB Live' : 'Prod Host • Admin Unlocked'}</span>
        </div>

        {/* Sidebar Navigation */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-[#847e71] px-3 py-1">
            Admin Sections
          </div>

          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-xs'
                : 'text-[#bcb5a6] hover:text-[#eee9dc] hover:bg-[#2b2925]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Total Stats</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#302e29] border border-[#514d43] text-[#d8d1c2]">
              Overview
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-xs'
                : 'text-[#bcb5a6] hover:text-[#eee9dc] hover:bg-[#2b2925]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Registered Users</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#302e29] border border-[#514d43] text-[#d8d1c2]">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-xs'
                : 'text-[#bcb5a6] hover:text-[#eee9dc] hover:bg-[#2b2925]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>MC Accounts</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#302e29] border border-[#514d43] text-[#d8d1c2]">
              {accounts.length}
            </span>
          </button>

          <div className="pt-4 text-[10px] font-black uppercase tracking-wider text-[#847e71] px-3 py-1">
            Live Overview
          </div>
          <div className="px-3 py-2 space-y-1.5 text-xs text-[#bcb5a6]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-emerald-400" /> Active Bots</span>
              <span className="font-bold text-emerald-300">{stats.totalConnected}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-purple-400" /> Termux Daemons</span>
              <span className="font-bold text-purple-300">{stats.totalTunnels}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-sky-400" /> Supabase Sync</span>
              <span className="font-bold text-emerald-400 text-[10px] uppercase">Connected</span>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#454239] bg-[#262420]">
          <Link
            href="/?tab=dashboard"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#302e29] border border-[#514d43] hover:border-emerald-600 text-xs font-bold text-[#ded8c9] transition"
          >
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto">
        {/* Header Bar */}
        <header className="h-14 border-b border-[#454239] bg-[#22211e]/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <span className="text-[#a8a18f]">Chief Admin</span>
            <span className="text-[#514d43]">/</span>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
              {activeTab === 'stats' ? 'Total Stats & Emergency Controls' : activeTab === 'users' ? 'Registered Users' : 'Minecraft Accounts & Connections'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#514d43] bg-[#2b2925] text-xs font-bold text-[#d8d1c2] hover:border-emerald-600 hover:text-emerald-300 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>

            {activeTab === 'users' && (
              <button
                onClick={() => setIsCreateUserOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: TOTAL STATS & EMERGENCY ACTIONS */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Stat Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl border border-[#4c493f] bg-[#252421]/95 shadow-md">
                  <div className="flex items-center justify-between text-[#a8a18f] text-xs font-bold uppercase tracking-wider">
                    <span>Registered Users</span>
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#f5f1e6]">{stats.totalUsers}</div>
                  <p className="mt-1 text-[11px] text-[#bcb5a6]">Accounts in Supabase</p>
                </div>

                <div className="p-5 rounded-2xl border border-[#4c493f] bg-[#252421]/95 shadow-md">
                  <div className="flex items-center justify-between text-[#a8a18f] text-xs font-bold uppercase tracking-wider">
                    <span>Minecraft Accounts</span>
                    <Server className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#f5f1e6]">{stats.totalAccounts}</div>
                  <p className="mt-1 text-[11px] text-[#bcb5a6]">Linked across users</p>
                </div>

                <div className="p-5 rounded-2xl border border-[#4c493f] bg-[#252421]/95 shadow-md">
                  <div className="flex items-center justify-between text-[#a8a18f] text-xs font-bold uppercase tracking-wider">
                    <span>Active Connections</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-300">{stats.totalConnected}</div>
                  <p className="mt-1 text-[11px] text-[#bcb5a6]">Live online bots in-game</p>
                </div>

                <div className="p-5 rounded-2xl border border-[#4c493f] bg-[#252421]/95 shadow-md">
                  <div className="flex items-center justify-between text-[#a8a18f] text-xs font-bold uppercase tracking-wider">
                    <span>Termux Bridges</span>
                    <Radio className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-purple-300">{stats.totalTunnels}</div>
                  <p className="mt-1 text-[11px] text-[#bcb5a6]">Active phone tunnels</p>
                </div>
              </div>

              {/* EMERGENCY ACTIONS PANEL (Requested Feature) */}
              <div className="rounded-2xl border border-[#524e43] bg-[#252421]/95 overflow-hidden shadow-xl">
                <header className="px-6 py-4 bg-gradient-to-r from-[#2f2723] via-[#2a2522] to-[#252421] border-b border-[#454239] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-amber-950/70 border border-amber-600/70 flex items-center justify-center text-amber-300">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-[#f5f1e6]">Emergency Controls & Global Broadcasts</h2>
                      <p className="text-xs text-[#bcb5a6]">One-click emergency actions affecting connected dashboards and live Termux sessions.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleRegistrations}
                    disabled={isTogglingRegistrations}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                      isRegistrationsPaused
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/70'
                        : 'bg-amber-950/70 text-amber-300 border-amber-700/60 hover:bg-amber-900/70'
                    }`}
                  >
                    {isRegistrationsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isRegistrationsPaused ? 'Resume Registrations' : 'Pause Registrations'}</span>
                  </button>
                </header>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Action 1: Force Refresh */}
                  <div className="p-4 rounded-xl border border-[#4c493f] bg-[#2b2925] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-sm text-[#eee9dc]">
                        <RotateCcw className="w-4 h-4 text-sky-400" />
                        <span>Force Refresh All</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#bcb5a6] leading-relaxed">
                        Broadcasts an immediate reload signal to all active browsers on the website, synchronizing all users.
                      </p>
                    </div>
                    <button
                      onClick={() => setEmergencyModal({
                        type: 'force_refresh',
                        title: 'Broadcast Force Refresh?',
                        description: 'This will cause all user dashboards currently connected to automatically reload and fetch fresh state from Supabase.',
                      })}
                      className="mt-4 w-full py-2 rounded-lg bg-sky-950/60 border border-sky-700/60 text-sky-300 hover:bg-sky-900/60 font-bold text-xs transition cursor-pointer"
                    >
                      Trigger Global Refresh
                    </button>
                  </div>

                  {/* Action 2: Force Logout */}
                  <div className="p-4 rounded-xl border border-[#4c493f] bg-[#2b2925] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-sm text-[#eee9dc]">
                        <LogOut className="w-4 h-4 text-amber-400" />
                        <span>Force Logout All</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#bcb5a6] leading-relaxed">
                        Immediately terminates all active browser sessions across all devices, requiring everyone to re-authenticate.
                      </p>
                    </div>
                    <button
                      onClick={() => setEmergencyModal({
                        type: 'force_logout',
                        title: 'Force Logout All Users?',
                        description: 'All active sessions on both dev and production will be signed out immediately and sent back to the login screen.',
                      })}
                      className="mt-4 w-full py-2 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-300 hover:bg-amber-900/60 font-bold text-xs transition cursor-pointer"
                    >
                      Sign Out All Sessions
                    </button>
                  </div>

                  {/* Action 3: Force Close Termux */}
                  <div className="p-4 rounded-xl border border-[#4c493f] bg-[#2b2925] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-sm text-[#eee9dc]">
                        <Power className="w-4 h-4 text-rose-400" />
                        <span>Force Close All Termux</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#bcb5a6] leading-relaxed">
                        Terminates all active Cloudflare phone tunnels in Supabase and instantly marks all Minecraft bots as disconnected.
                      </p>
                    </div>
                    <button
                      onClick={() => setEmergencyModal({
                        type: 'force_close_termux',
                        title: 'Force Close All Termux Sessions?',
                        description: 'This will sever all active phone daemon connections and shut down all bot activity system-wide.',
                      })}
                      className="mt-4 w-full py-2 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-300 hover:bg-rose-900/60 font-bold text-xs transition cursor-pointer"
                    >
                      Halt All Termux Bridges
                    </button>
                  </div>
                </div>
              </div>

              {/* Server Distribution & Active Tunnels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Server Distribution */}
                <div className="rounded-2xl border border-[#4c493f] bg-[#252421]/95 overflow-hidden shadow-md">
                  <header className="px-5 py-4 border-b border-[#454239] bg-[#2b2925] flex items-center justify-between">
                    <div className="font-bold text-sm text-[#eee9dc] flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span>Server Distribution</span>
                    </div>
                    <span className="text-xs text-[#bcb5a6]">{hostStats.length} Unique Servers</span>
                  </header>
                  <div className="p-4 divide-y divide-[#3d3a33] max-h-72 overflow-y-auto">
                    {hostStats.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#8c8577]">No servers configured yet.</div>
                    ) : (
                      hostStats.map(([host, data]) => (
                        <div key={host} className="py-2.5 flex items-center justify-between text-xs">
                          <span className="font-mono text-[#ded8c9]">{host}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[#a8a18f]">{data.total} account{data.total === 1 ? '' : 's'}</span>
                            {data.online > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
                                {data.online} online
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Termux Bridges & Cloudflare Tunnels */}
                <div className="rounded-2xl border border-[#4c493f] bg-[#252421]/95 overflow-hidden shadow-md">
                  <header className="px-5 py-4 border-b border-[#454239] bg-[#2b2925] flex items-center justify-between">
                    <div className="font-bold text-sm text-[#eee9dc] flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-400" />
                      <span>Termux Bridges & Cloudflare Tunnels</span>
                    </div>
                    <span className="text-xs text-[#bcb5a6]">{tunnels.length} Registered</span>
                  </header>
                  <div className="p-4 divide-y divide-[#3d3a33] max-h-72 overflow-y-auto">
                    {tunnels.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#8c8577]">No phone daemons registered yet.</div>
                    ) : (
                      tunnels.map((t) => (
                        <div key={t.username} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-[#eee9dc]">@{t.username}</span>
                            <span className="block font-mono text-[10px] text-[#8c8577] truncate max-w-xs">{t.url}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.isRecent ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60' : 'bg-[#302e29] text-[#8c8577]'
                            }`}>
                              {t.isRecent ? 'Live' : 'Idle'}
                            </span>
                            <button
                              onClick={() => handleDisconnectTunnel(t.username)}
                              className="p-1 rounded text-[#8c8577] hover:text-rose-400 hover:bg-[#302e29]"
                              title="Disconnect Tunnel"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTERED USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[260px] flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-[#8c8577] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by username or secret code..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#252421] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="text-xs text-[#bcb5a6] font-bold">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl border border-[#4c493f] bg-[#252421]/95 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#2c2a25] border-b border-[#454239] text-[#a8a18f] font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Capacity</th>
                        <th className="py-3 px-4">Accounts & Bots</th>
                        <th className="py-3 px-4">Secret Launcher Code</th>
                        <th className="py-3 px-4">Tunnel Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d3a33]">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#8c8577]">No users matched your search.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-[#2b2925] transition">
                            <td className="py-3.5 px-4 font-bold text-[#eee9dc]">
                              @{u.username}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-2xs">
                                ⚡ Universal (10 Bots)
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-[#ded8c9]">{u.accountCount}/10 linked</span>
                              {u.connectedCount > 0 && (
                                <span className="ml-2 text-emerald-400 font-bold">({u.connectedCount} online)</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {u.secretCode ? (
                                <span
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.secretCode || '');
                                    showToast(`Copied secret code for @${u.username}`, 'info');
                                  }}
                                  className="font-mono text-[11px] text-[#bcb5a6] bg-[#201f1c] px-2 py-1 rounded border border-[#4c493f] cursor-pointer hover:border-emerald-600 transition inline-flex items-center gap-1.5"
                                  title="Click to copy"
                                >
                                  <span>{u.secretCode}</span>
                                  <Copy className="w-3 h-3 text-[#8c8577]" />
                                </span>
                              ) : (
                                <span className="text-[#8c8577] italic">None</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {u.tunnelUrl ? (
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-purple-300">
                                  <Radio className="w-3 h-3 text-purple-400" />
                                  <span className="max-w-[150px] truncate">{u.tunnelUrl}</span>
                                </span>
                              ) : (
                                <span className="text-[#8c8577] text-[11px]">No tunnel active</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1">
                              <button
                                onClick={() => {
                                  setResetPasswordUser(u);
                                  setNewPassword('');
                                }}
                                className="p-1.5 rounded-lg text-[#bcb5a6] hover:text-sky-300 hover:bg-[#302e29] transition"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.username })}
                                className="p-1.5 rounded-lg text-[#bcb5a6] hover:text-rose-400 hover:bg-[#302e29] transition"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MINECRAFT ACCOUNTS & BOT CONNECTIONS */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[260px] flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-[#8c8577] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search accounts, servers, IGNs..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#252421] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {(['all', 'online', 'offline'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setAccountStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                        accountStatusFilter === st
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 shadow-xs'
                          : 'bg-[#252421] text-[#bcb5a6] border border-[#4c493f] hover:text-[#eee9dc]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accounts Table */}
              <div className="rounded-2xl border border-[#4c493f] bg-[#252421]/95 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#2c2a25] border-b border-[#454239] text-[#a8a18f] font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Account IGN</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Configured Server</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Daemon Tunnel</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d3a33]">
                      {filteredAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#8c8577]">No Minecraft accounts matched your search.</td>
                        </tr>
                      ) : (
                        filteredAccounts.map((a) => (
                          <tr key={a.id} className="hover:bg-[#2b2925] transition">
                            <td className="py-3.5 px-4 font-bold text-[#eee9dc] flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md overflow-hidden bg-[#201f1c] border border-[#4c493f] shrink-0">
                                <img
                                  src={`https://crafthead.net/helm/${encodeURIComponent(a.ign)}/28`}
                                  alt={a.ign}
                                  className="w-full h-full object-cover [image-rendering:pixelated]"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = `https://mc-heads.net/avatar/${encodeURIComponent(a.ign)}/28`;
                                  }}
                                />
                              </div>
                              <span>{a.ign}</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[#bcb5a6]">
                              @{a.owner}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-[#ded8c9]">
                              {a.serverHost}{a.serverPort !== 25565 ? `:${a.serverPort}` : ''}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                a.isConnected
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60'
                                  : 'bg-[#302e29] text-[#8c8577]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${a.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-[#756f62]'}`} />
                                {a.isConnected ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[10px] text-[#8c8577] max-w-xs truncate">
                              {a.daemonUrl || a.registeredTunnel || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1">
                              {a.isConnected && (
                                <button
                                  onClick={() => setActiveChatBot(a)}
                                  className="p-1.5 rounded-lg text-emerald-400 hover:bg-[#302e29] transition"
                                  title="View In-Game Chat Stream"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              )}
                              {a.isConnected && (
                                <button
                                  onClick={() => handleDisconnectAccount(a.id, a.ign)}
                                  className="p-1.5 rounded-lg text-amber-400 hover:bg-[#302e29] transition"
                                  title="Disconnect Bot"
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteTarget({ type: 'account', id: a.id, name: `${a.ign} (@${a.owner})` })}
                                className="p-1.5 rounded-lg text-[#bcb5a6] hover:text-rose-400 hover:bg-[#302e29] transition"
                                title="Delete Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* EMERGENCY ACTION CONFIRMATION MODAL */}
      {emergencyModal && (
        <div
          onClick={() => !isExecutingEmergency && setEmergencyModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#524e43] bg-[#262420] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-400">
              <span className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-600/70 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-base text-[#f5f1e6]">{emergencyModal.title}</h3>
                <p className="text-xs text-[#bcb5a6]">Confirm Emergency Admin Action</p>
              </div>
            </div>

            <p className="text-xs text-[#bcb5a6] leading-relaxed bg-[#1d1c19] p-3.5 rounded-xl border border-[#454239]">
              {emergencyModal.description}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEmergencyModal(null)}
                disabled={isExecutingEmergency}
                className="px-4 py-2 rounded-xl bg-[#302e29] border border-[#514d43] text-xs font-bold text-[#ded8c9] hover:bg-[#38362f] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteEmergencyAction}
                disabled={isExecutingEmergency}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 text-white font-bold text-xs shadow-md hover:from-amber-500 hover:to-rose-500 transition flex items-center gap-2"
              >
                {isExecutingEmergency && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateUserOpen && (
        <div
          onClick={() => !isCreatingUser && setIsCreateUserOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#4c493f] bg-[#262420] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#454239] pb-3">
              <h3 className="font-black text-base text-[#f5f1e6]">Register New User</h3>
              <button onClick={() => setIsCreateUserOpen(false)} className="text-[#8c8577] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a18f] mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="e.g. steve"
                  className="w-full px-3 py-2 rounded-xl bg-[#1d1c19] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#a8a18f] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 rounded-xl bg-[#1d1c19] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#201f1c] border border-[#454239] text-xs text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automatically granted Universal 10-Account Capacity.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#302e29] border border-[#514d43] text-xs font-bold text-[#ded8c9] hover:bg-[#38362f] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-xs shadow-md hover:from-emerald-500 hover:to-emerald-600 transition flex items-center gap-2"
                >
                  {isCreatingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <div
          onClick={() => !isResettingPassword && setResetPasswordUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#4c493f] bg-[#262420] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#454239] pb-3">
              <h3 className="font-black text-base text-[#f5f1e6]">Reset Password for @{resetPasswordUser.username}</h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-[#8c8577] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#a8a18f] mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1d1c19] border border-[#4c493f] text-xs text-[#eee9dc] placeholder-[#756f62] focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#302e29] border border-[#514d43] text-xs font-bold text-[#ded8c9] hover:bg-[#38362f] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold text-xs shadow-md hover:from-sky-500 hover:to-sky-600 transition flex items-center gap-2"
                >
                  {isResettingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          onClick={() => !isDeleting && setDeleteTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-[#262420] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <span className="w-10 h-10 rounded-xl bg-rose-950/70 border border-rose-600/70 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-base text-[#f5f1e6]">Confirm Deletion</h3>
                <p className="text-xs text-[#bcb5a6]">Delete {deleteTarget.type === 'user' ? 'User Account' : 'Minecraft Account'}</p>
              </div>
            </div>

            <p className="text-xs text-[#bcb5a6] leading-relaxed bg-[#1d1c19] p-3.5 rounded-xl border border-[#454239]">
              Are you sure you want to delete <span className="font-bold text-[#eee9dc]">{deleteTarget.name}</span>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#302e29] border border-[#514d43] text-xs font-bold text-[#ded8c9] hover:bg-[#38362f] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-xs shadow-md hover:from-rose-500 hover:to-rose-600 transition flex items-center gap-2"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE IN-GAME CHAT DRAWER */}
      {activeChatBot && (
        <div
          onClick={() => setActiveChatBot(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-[#4c493f] bg-[#22211e] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="px-5 py-3.5 border-b border-[#454239] bg-[#2a2824] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-sm text-[#eee9dc]">Live Chat Stream: {activeChatBot.ign}</span>
                <span className="text-[10px] text-[#bcb5a6]">({activeChatBot.serverHost})</span>
              </div>
              <button onClick={() => setActiveChatBot(null)} className="text-[#8c8577] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 font-mono text-xs bg-[#1a1916]">
              {(!liveChats[activeChatBot.ign] || liveChats[activeChatBot.ign].length === 0) ? (
                <div className="py-12 text-center text-xs text-[#756f62] italic">
                  Awaiting chat messages from {activeChatBot.serverHost}...
                </div>
              ) : (
                liveChats[activeChatBot.ign].map((msg, i) => (
                  <div key={i} className="text-[#eee9dc] leading-relaxed">
                    <span className="text-[#756f62] mr-2">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                    <MinecraftChatMessage message={msg} showTimestamp={false} compact darkMode />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
