'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDaemonSocket, AccountVerifiedData } from '../lib/useDaemonSocket';
import { MinecraftAccount, ServerProfile, BotSettings, BotLifecycleState } from '../types';
import { Header } from '../components/Header';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { QuickCommands } from '../components/QuickCommands';
import { Terminal } from '../components/Terminal';
import { ContainerModal } from '../components/ContainerModal';
import { SettingsModal } from '../components/SettingsModal';
import { AccountModal } from '../components/AccountModal';
import { ServerProfileModal } from '../components/ServerProfileModal';
import { AuthModal } from '../components/AuthModal';
import { MicrosoftAuthModal } from '../components/MicrosoftAuthModal';
import { supabase } from '../lib/supabaseClient';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Settings2, 
  Plus, 
  Server, 
  Globe, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  Sparkles, 
  Swords, 
  Shield, 
  Activity,
  CheckCircle2
} from 'lucide-react';

const DEFAULT_BOT_SETTINGS: BotSettings = {
  physics: true,
  acceptResourcePacks: true,
  autoEat: false,
  autoTotem: false,
  antiAfk: true,
  antiAfkInterval: 10,
  mobFarm: false,
  mobFarmRange: 3.5,
  mobFarmIntervalMs: 650,
  autoReconnect: true,
  autoReconnectDelay: 5000,
};

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_user') || null;
    }
    return null;
  });

  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [autoSynced, setAutoSynced] = useState(false);

  // Handle Account Verification callback from daemon
  const handleAccountVerified = useCallback((data: AccountVerifiedData) => {
    setAccounts((prevAccounts) => {
      const nextAccounts = prevAccounts.map((acc) => {
        if (
          acc.username.toLowerCase() === data.email.toLowerCase() ||
          acc.id === data.botId ||
          (acc.ign && acc.ign.toLowerCase() === data.ign.toLowerCase())
        ) {
          return {
            ...acc,
            ign: data.ign,
            uuid: data.uuid,
            verified: true,
          };
        }
        return acc;
      });

      // Persist verified info
      const userKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
      if (typeof window !== 'undefined') {
        localStorage.setItem(userKey, JSON.stringify(nextAccounts));
      }

      // Sync to Supabase if logged in
      if (supabase && currentUser) {
        supabase
          .from('accounts')
          .update({
            bot_name: data.ign,
            auth_type: 'microsoft',
          })
          .eq('username', currentUser)
          .then(
            () => {},
            () => {}
          );
      }

      return nextAccounts;
    });
  }, [currentUser]);

  // WebSocket Connection Hook
  const {
    status: socketStatus,
    botState,
    botStateReason,
    telemetry,
    messages,
    containerWindow,
    botStates,
    botStateReasons,
    daemonUrl,
    authToken,
    saveSettings,
    startBot,
    stopBot,
    restartBot,
    sendChat,
    clickSlot,
    closeWindow,
    updateSettings,
    clearMessages,
    msAuthData,
    clearMsAuth,
  } = useDaemonSocket(activeServerId, handleAccountVerified);

  // Active Server Profile
  const activeServer = useMemo(() => {
    return servers.find((s) => s.id === activeServerId) || servers[0] || null;
  }, [servers, activeServerId]);

  // Assigned Account for active server
  const activeAccount = useMemo(() => {
    if (!activeServer) return null;
    return accounts.find((a) => a.id === activeServer.accountId) || null;
  }, [accounts, activeServer]);

  // Count running bots
  const activeRunningCount = useMemo(() => {
    return Object.values(botStates).filter(
      (s) => s === 'SPAWNED' || s === 'LOGGED_IN' || s === 'CONNECTING'
    ).length;
  }, [botStates]);

  const effectiveUser = currentUser || 'default';
  const termuxCommand = `curl -sL https://pocketafk.vercel.app/install | bash -s -- ${effectiveUser}`;

  // Auto-sync tunnel from API or URL
  useEffect(() => {
    async function syncTunnel() {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const queryTunnel = urlParams.get('tunnel');
      if (queryTunnel && queryTunnel.startsWith('wss://')) {
        saveSettings(queryTunnel, authToken);
        setAutoSynced(true);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      try {
        const res = await fetch(`/api/tunnel?username=${encodeURIComponent(effectiveUser)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.url && data.url.startsWith('wss://') && data.url !== daemonUrl) {
            saveSettings(data.url, data.token || authToken);
            setAutoSynced(true);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    syncTunnel();
  }, [daemonUrl, authToken, saveSettings, effectiveUser]);

  // Load accounts & servers from localStorage & Supabase
  useEffect(() => {
    async function loadData() {
      const accKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
      const srvKey = currentUser ? `pocketafk_servers_${currentUser}` : 'pocketafk_servers_guest';

      // 1. Load accounts
      const storedAcc = localStorage.getItem(accKey);
      let loadedAccounts: MinecraftAccount[] = [];
      if (storedAcc) {
        try {
          const parsed = JSON.parse(storedAcc);
          loadedAccounts = parsed.filter((a: any) => !a.id.startsWith('starter-'));
        } catch (e) {
          // ignore
        }
      }
      setAccounts(loadedAccounts);

      // 2. Load servers
      const storedSrv = localStorage.getItem(srvKey);
      let loadedServers: ServerProfile[] = [];
      if (storedSrv) {
        try {
          loadedServers = JSON.parse(storedSrv);
        } catch (e) {
          // ignore
        }
      }
      setServers(loadedServers);
      if (loadedServers.length > 0) {
        setActiveServerId(loadedServers[0].id);
      }

      // 3. Supabase sync if logged in
      if (supabase && currentUser) {
        try {
          const { data, error } = await supabase.from('accounts').select('*').eq('username', currentUser);
          if (data && data.length > 0 && !error) {
            // Build accounts from Supabase
            const dbAccounts: MinecraftAccount[] = [];
            const dbServers: ServerProfile[] = [];

            data.forEach((row) => {
              const accId = `acc_${row.id}`;
              dbAccounts.push({
                id: accId,
                username: row.bot_name || 'player@outlook.com',
                auth_type: 'microsoft',
                ign: row.bot_name && !row.bot_name.includes('@') ? row.bot_name : undefined,
                verified: !!(row.bot_name && !row.bot_name.includes('@')),
                addedAt: Date.now(),
              });

              dbServers.push({
                id: `srv_${row.id}`,
                name: row.bot_name ? `${row.bot_name}'s Server` : 'Minecraft Server',
                accountId: accId,
                serverHost: row.server_host || 'donutsmp.net',
                serverPort: row.server_port || 25565,
                serverVersion: row.server_version || 'auto',
                autoReconnect: row.auto_reconnect ?? true,
                settings: row.settings || DEFAULT_BOT_SETTINGS,
              });
            });

            if (dbAccounts.length > 0) {
              setAccounts(dbAccounts);
              setServers(dbServers);
              setActiveServerId(dbServers[0].id);
              localStorage.setItem(accKey, JSON.stringify(dbAccounts));
              localStorage.setItem(srvKey, JSON.stringify(dbServers));
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    loadData();
  }, [currentUser]);

  // Account Management
  const handleAddAccount = async (email: string) => {
    const accKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
    const newAccount: MinecraftAccount = {
      id: `acc_${Math.random().toString(36).substring(2, 9)}`,
      username: email.trim(),
      auth_type: 'microsoft',
      verified: false,
      addedAt: Date.now(),
    };

    const updated = [...accounts, newAccount];
    setAccounts(updated);
    localStorage.setItem(accKey, JSON.stringify(updated));
  };

  const handleDeleteAccount = async (id: string) => {
    const accKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    localStorage.setItem(accKey, JSON.stringify(updated));
  };

  // Server Management
  const handleSaveServer = async (profile: ServerProfile) => {
    const srvKey = currentUser ? `pocketafk_servers_${currentUser}` : 'pocketafk_servers_guest';
    const existingIndex = servers.findIndex((s) => s.id === profile.id);
    let updated: ServerProfile[];
    if (existingIndex >= 0) {
      updated = [...servers];
      updated[existingIndex] = profile;
    } else {
      updated = [...servers, profile];
    }

    setServers(updated);
    setActiveServerId(profile.id);
    localStorage.setItem(srvKey, JSON.stringify(updated));

    // Also sync to Supabase if user logged in
    if (supabase && currentUser) {
      try {
        const assignedAcc = accounts.find((a) => a.id === profile.accountId);
        await supabase.from('accounts').upsert([{
          username: currentUser,
          bot_name: assignedAcc?.ign || assignedAcc?.username || profile.name,
          auth_type: 'microsoft',
          server_host: profile.serverHost,
          server_port: profile.serverPort,
          server_version: profile.serverVersion,
          auto_reconnect: profile.autoReconnect,
          settings: profile.settings,
        }]);
      } catch (e) {
        // ignore
      }
    }
  };

  const handleDeleteServer = async (profileId: string) => {
    const srvKey = currentUser ? `pocketafk_servers_${currentUser}` : 'pocketafk_servers_guest';
    // Stop running bot if active
    stopBot(profileId);

    const updated = servers.filter((s) => s.id !== profileId);
    setServers(updated);
    localStorage.setItem(srvKey, JSON.stringify(updated));
    if (activeServerId === profileId) {
      setActiveServerId(updated[0]?.id || null);
    }
  };

  // Start / Stop active server
  const handleStartServer = (profile: ServerProfile) => {
    const acc = accounts.find((a) => a.id === profile.accountId);
    if (!acc) {
      alert('Please assign a Minecraft Java account to this server first!');
      return;
    }

    startBot({
      id: profile.id,
      username: acc.username, // Microsoft email
      authType: 'microsoft',
      host: profile.serverHost,
      port: profile.serverPort,
      version: profile.serverVersion === 'auto' ? false : profile.serverVersion,
      settings: profile.settings || DEFAULT_BOT_SETTINGS,
    });
  };

  const handleStopServer = (profileId: string) => {
    stopBot(profileId);
  };

  const handleRestartServer = (profile: ServerProfile) => {
    restartBot(profile.id);
  };

  const handleUpdateActiveSettings = (updated: Partial<BotSettings>) => {
    if (!activeServer) return;
    const nextSettings = { ...activeServer.settings, ...updated };
    const nextProfile = { ...activeServer, settings: nextSettings };
    handleSaveServer(nextProfile);
    updateSettings(activeServer.id, nextSettings);
  };

  const handleSendMessage = (msg: string) => {
    if (!activeServer) return;
    sendChat(activeServer.id, msg);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pocketafk_user');
  };

  const handleLoginSuccess = (user: string) => {
    setCurrentUser(user);
    localStorage.setItem('pocketafk_user', user);
  };

  // Status helper for server cards
  const getStatusBadge = (state: BotLifecycleState) => {
    switch (state) {
      case 'SPAWNED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            In-Game
          </span>
        );
      case 'LOGGED_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            Logged In
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Connecting
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            Reconnecting
          </span>
        );
      case 'KICKED':
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
            {state}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
            Offline
          </span>
        );
    }
  };

  const isActiveServerRunning =
    botState === 'SPAWNED' || botState === 'LOGGED_IN' || botState === 'CONNECTING';

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/50 via-slate-50 to-sky-100/40 text-slate-900 flex flex-col selection:bg-emerald-500/20">
      {/* Navigation Header */}
      <Header
        socketStatus={socketStatus}
        activeCount={activeRunningCount}
        accountsCount={accounts.length}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAccounts={() => setIsAccountsOpen(true)}
        onOpenAddServer={() => {
          setEditingServer(null);
          setIsServerModalOpen(true);
        }}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Auto-Sync Confirmation Banner */}
        {autoSynced && socketStatus === 'AUTHENTICATED' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
            <span className="flex items-center gap-2 font-bold">
              ✨ Auto-Synced with Termux! WebSocket tunnel paired automatically.
            </span>
            <span className="text-[11px] font-mono text-emerald-600 truncate max-w-xs">{daemonUrl}</span>
          </div>
        )}

        {/* Connection Banner if no tunnel URL configured */}
        {!daemonUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <b>Termux Bridge Not Connected:</b> Run the 1-click command on your Android phone to link automatically.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(termuxCommand);
                  alert(`Copied 1-click Termux command for user @${effectiveUser}!`);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
              >
                📋 Copy Termux Command
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1 font-bold text-amber-800 hover:text-amber-900 underline cursor-pointer"
              >
                Settings <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout: Left Server Manager & Right Active Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Server Instances Manager (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                    Servers & Instances
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setEditingServer(null);
                    setIsServerModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Server
                </button>
              </div>

              {servers.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">No servers configured</div>
                  <p className="text-[11px] text-slate-500">
                    Create a server instance to connect your Minecraft account.
                  </p>
                  <button
                    onClick={() => {
                      setEditingServer(null);
                      setIsServerModalOpen(true);
                    }}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    + Add First Server
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {servers.map((srv) => {
                    const isSelected = srv.id === activeServerId;
                    const srvState: BotLifecycleState = botStates[srv.id] || 'DISCONNECTED';
                    const isRunning =
                      srvState === 'SPAWNED' || srvState === 'LOGGED_IN' || srvState === 'CONNECTING';
                    const assignedAcc = accounts.find((a) => a.id === srv.accountId);
                    const avatarName = assignedAcc?.ign || 'MHF_Steve';
                    const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(avatarName)}/28`;

                    return (
                      <div
                        key={srv.id}
                        className={`p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-50/80 to-slate-50 border-emerald-400 shadow-xs ring-1 ring-emerald-400/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => setActiveServerId(srv.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-slate-900 truncate">
                                {srv.name}
                              </span>
                              {getStatusBadge(srvState)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{srv.serverHost}:{srv.serverPort}</span>
                              <span className="text-[10px] text-slate-400">({srv.serverVersion})</span>
                            </div>
                          </div>

                          {/* Quick Start / Stop button on card */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {!isRunning ? (
                              <button
                                onClick={() => handleStartServer(srv)}
                                disabled={socketStatus !== 'AUTHENTICATED' || !assignedAcc}
                                title="Start this bot"
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition shadow-2xs cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStopServer(srv.id)}
                                title="Stop this bot"
                                className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-2xs cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingServer(srv);
                                setIsServerModalOpen(true);
                              }}
                              title="Edit server settings"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Assigned Account Info */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={avatarUrl}
                              alt={avatarName}
                              className="w-4 h-4 rounded-xs shrink-0 rendering-pixelated"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/28';
                              }}
                            />
                            <span className="font-semibold text-slate-700 truncate">
                              {assignedAcc ? (assignedAcc.ign || assignedAcc.username) : 'No Account'}
                            </span>
                          </div>
                          {assignedAcc?.verified && (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] leading-relaxed shadow-xs">
              <span className="font-bold text-slate-800 block mb-1">💡 Multi-Server AFK:</span>
              You can connect one Java account to multiple servers at once, or link different accounts to different servers. Each server runs independently on Termux.
            </div>
          </div>

          {/* Right Column: Active Server Dashboard (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {activeServer ? (
              <>
                {/* Active Server Header Bar */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-black text-slate-900 text-sm">{activeServer.name}</h2>
                        {getStatusBadge(botState)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span>{activeServer.serverHost}:{activeServer.serverPort}</span>
                        <span>&bull;</span>
                        <span>Ver: {activeServer.serverVersion}</span>
                        {activeAccount && (
                          <>
                            <span>&bull;</span>
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {activeAccount.ign || activeAccount.username}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Server */}
                  <div className="flex items-center gap-2">
                    {!isActiveServerRunning ? (
                      <button
                        onClick={() => handleStartServer(activeServer)}
                        disabled={socketStatus !== 'AUTHENTICATED' || !activeAccount}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start Bot
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStopServer(activeServer.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          Stop
                        </button>
                        <button
                          onClick={() => handleRestartServer(activeServer)}
                          title="Restart Bot"
                          className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition shadow-2xs cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setEditingServer(activeServer);
                        setIsServerModalOpen(true);
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Edit server configuration"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Telemetry HUD */}
                <TelemetryHUD telemetry={telemetry} />

                {/* Instance Quick Feature Toggles Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Physics */}
                    <button
                      onClick={() => handleUpdateActiveSettings({ physics: !activeServer.settings.physics })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        activeServer.settings.physics
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Physics: {activeServer.settings.physics ? 'ON' : 'OFF'}
                    </button>

                    {/* Resource Packs */}
                    <button
                      onClick={() => handleUpdateActiveSettings({ acceptResourcePacks: !activeServer.settings.acceptResourcePacks })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        activeServer.settings.acceptResourcePacks
                          ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Resource Packs: {activeServer.settings.acceptResourcePacks ? 'Auto' : 'Off'}
                    </button>

                    {/* Mob Farm */}
                    <button
                      onClick={() => handleUpdateActiveSettings({ mobFarm: !activeServer.settings.mobFarm })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        activeServer.settings.mobFarm
                          ? 'bg-red-50 border-red-300 text-red-700 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      Mob Farm: {activeServer.settings.mobFarm ? 'ACTIVE' : 'OFF'}
                    </button>

                    {/* Auto Eat */}
                    <button
                      onClick={() => handleUpdateActiveSettings({ autoEat: !activeServer.settings.autoEat })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        activeServer.settings.autoEat
                          ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      Auto-Eat: {activeServer.settings.autoEat ? 'ON' : 'OFF'}
                    </button>

                    {/* Auto Totem */}
                    <button
                      onClick={() => handleUpdateActiveSettings({ autoTotem: !activeServer.settings.autoTotem })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        activeServer.settings.autoTotem
                          ? 'bg-yellow-50 border-yellow-300 text-yellow-800 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Auto-Totem: {activeServer.settings.autoTotem ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <span className="text-slate-500 text-[11px] font-mono">
                    {botStateReason || (botState === 'SPAWNED' ? 'Operational' : 'Standby')}
                  </span>
                </div>

                {/* Quick Commands Bar */}
                <QuickCommands
                  onSendCommand={handleSendMessage}
                  disabled={!isActiveServerRunning}
                />

                {/* Live Terminal Console for this Server */}
                <Terminal
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onClear={() => clearMessages(activeServer.id)}
                  disabled={!isActiveServerRunning}
                />
              </>
            ) : (
              /* Empty State when no server is selected */
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                  <Server className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="font-extrabold text-slate-900 text-base">
                    No Server Instance Selected
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Create a server instance to connect your Minecraft account. You can configure custom IP, port, version, and survival features per server.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setEditingServer(null);
                      setIsServerModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Server Instance
                  </button>
                  <button
                    onClick={() => setIsAccountsOpen(true)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    Manage Minecraft Accounts
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Interactive Chest / Menu Modal */}
      <ContainerModal
        window={containerWindow}
        onClose={() => {
          if (activeServer && containerWindow) {
            closeWindow(activeServer.id, containerWindow.windowId);
          }
        }}
        onClickSlot={(slot, mouseButton) => {
          if (activeServer && containerWindow) {
            clickSlot(activeServer.id, containerWindow.windowId, slot, mouseButton || 0);
          }
        }}
      />

      {/* Server Profile Modal */}
      <ServerProfileModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        accounts={accounts}
        initialProfile={editingServer}
        onSaveProfile={handleSaveServer}
        onDeleteProfile={handleDeleteServer}
        onOpenAddAccount={() => {
          setIsServerModalOpen(false);
          setIsAccountsOpen(true);
        }}
      />

      {/* Minecraft Accounts Modal */}
      <AccountModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccount?.id || null}
        onSelectAccount={(acc) => {
          // If we have an active server, link this account to it
          if (activeServer) {
            handleSaveServer({ ...activeServer, accountId: acc.id });
          }
          setIsAccountsOpen(false);
        }}
        onAddAccount={handleAddAccount}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Settings Modal (Daemon & Termux Command) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        daemonUrl={daemonUrl}
        authToken={authToken}
        onSaveDaemonSettings={saveSettings}
        botSettings={activeServer?.settings || DEFAULT_BOT_SETTINGS}
        onUpdateBotSettings={handleUpdateActiveSettings}
        termuxCommand={termuxCommand}
      />

      {/* User Login & Register Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Microsoft 1-Time Device Authentication Modal */}
      <MicrosoftAuthModal
        authData={msAuthData}
        accountEmail={activeAccount?.username}
        onClose={clearMsAuth}
      />
    </div>
  );
}
