'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDaemonSocket, AccountVerifiedData } from '../lib/useDaemonSocket';
import { MinecraftAccount, ServerProfile, BotSettings, BotLifecycleState } from '../types';
import { Terminal } from '../components/Terminal';
import { ContainerModal } from '../components/ContainerModal';
import { SettingsModal } from '../components/SettingsModal';
import { AccountModal } from '../components/AccountModal';
import { ServerProfileModal } from '../components/ServerProfileModal';
import { AuthModal } from '../components/AuthModal';
import { MicrosoftAuthModal } from '../components/MicrosoftAuthModal';
import { ModernToast, ToastMessage } from '../components/ModernToast';
import { supabase } from '../lib/supabaseClient';
import { syncAllToSupabase, deleteAccountFromSupabase } from '../lib/supabaseSync';
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
  CheckCircle2,
  LogIn,
  LogOut,
  Lock,
  Cpu,
  Smartphone,
  Users,
  Radio,
  Home,
  MessageSquare,
  Compass,
  Box,
  Eye,
  Sliders,
  Search,
  Pin,
  Trash2,
  ExternalLink,
  ChevronRight,
  Heart,
  Utensils,
  Terminal as TerminalIcon,
  Check
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

type MainView = 'profile' | 'servers' | 'proxies';
type SubTab = 'connect' | 'chat' | 'movement' | 'inventory' | 'pov' | 'settings';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_user') || null;
    }
    return null;
  });
  const [secretCode, setSecretCode] = useState<string>('');

  // Sync secretCode for current user
  useEffect(() => {
    if (!currentUser) {
      setSecretCode('');
      return;
    }
    const cachedSecret = localStorage.getItem(`pocketafk_secret_${currentUser}`);
    if (cachedSecret) {
      setSecretCode(cachedSecret);
    }
  }, [currentUser]);

  // Views & Tabs (MinecraftAFK Architecture)
  const [activeMainView, setActiveMainView] = useState<MainView>('profile');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('connect');

  // Accounts & Servers state
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');

  // Connect table state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState('');
  const [accountNotes, setAccountNotes] = useState<Record<string, string>>({});
  const [pinnedAccountIds, setPinnedAccountIds] = useState<string[]>([]);

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContainerOpen, setIsContainerOpen] = useState(false);
  const [autoSynced, setAutoSynced] = useState(false);

  // In-app Microsoft OAuth Polling state
  const [isPollingMs, setIsPollingMs] = useState(false);
  const [apiMsAuthData, setApiMsAuthData] = useState<{
    botId: string;
    userCode: string;
    url: string;
    deviceCode?: string;
  } | null>(null);
  const [msAuthError, setMsAuthError] = useState<string | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modern in-app toast notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Math.random().toString(36).substring(2, 9), message, type });
  };

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

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

      const userKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
      if (typeof window !== 'undefined') {
        localStorage.setItem(userKey, JSON.stringify(nextAccounts));
      }

      if (currentUser) {
        syncAllToSupabase(currentUser, nextAccounts, servers);
      }

      return nextAccounts;
    });
  }, [currentUser, servers]);

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
    verifyAccount,
    clearMessages,
    msAuthData,
    clearMsAuth,
  } = useDaemonSocket(activeServerId, handleAccountVerified, Boolean(currentUser));

  // Helper to resolve an account for a server profile
  const resolveServerAccount = useCallback(
    (srv: ServerProfile | null | undefined): MinecraftAccount | null => {
      if (!srv || accounts.length === 0) return null;
      if (srv.accountId) {
        const byId = accounts.find((a) => a.id === srv.accountId);
        if (byId) return byId;
        const byName = accounts.find(
          (a) => (a.ign || a.username).toLowerCase() === srv.accountId?.toLowerCase()
        );
        if (byName) return byName;
      }
      return accounts[0] || null;
    },
    [accounts]
  );

  // Active Server Profile
  const activeServer = useMemo(() => {
    return servers.find((s) => s.id === activeServerId) || servers[0] || null;
  }, [servers, activeServerId]);

  // Assigned Account for active server
  const activeAccount = useMemo(() => {
    return resolveServerAccount(activeServer);
  }, [resolveServerAccount, activeServer]);

  // Ensure active server selected account is in selectedAccountIds
  useEffect(() => {
    if (activeAccount && !selectedAccountIds.includes(activeAccount.id)) {
      setSelectedAccountIds([activeAccount.id]);
    }
  }, [activeAccount?.id]);

  const effectiveUser = currentUser || 'default';
  const termuxCommand = secretCode
    ? `curl -sL https://pocketafk.vercel.app/install | bash -s -- ${effectiveUser} ${secretCode}`
    : `curl -sL https://pocketafk.vercel.app/install | bash -s -- ${effectiveUser}`;

  // Auto-sync tunnel from API or URL
  useEffect(() => {
    if (!currentUser) return;

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
          if (data && data.tunnel_url && data.tunnel_url.startsWith('wss://')) {
            saveSettings(data.tunnel_url, authToken);
            setAutoSynced(true);
          }
        }
      } catch (err) {
        // ignore
      }
    }

    syncTunnel();
  }, [currentUser, effectiveUser, authToken, saveSettings]);

  // Load Notes & Pinned state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedNotes = localStorage.getItem(`pocketafk_notes_${currentUser || 'guest'}`);
      if (storedNotes) setAccountNotes(JSON.parse(storedNotes));
      const storedPinned = localStorage.getItem(`pocketafk_pinned_${currentUser || 'guest'}`);
      if (storedPinned) setPinnedAccountIds(JSON.parse(storedPinned));
    } catch (e) {
      // ignore
    }
  }, [currentUser]);

  // Save notes
  const handleUpdateNote = (accId: string, noteText: string) => {
    const updated = { ...accountNotes, [accId]: noteText };
    setAccountNotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketafk_notes_${currentUser || 'guest'}`, JSON.stringify(updated));
    }
  };

  // Toggle pin
  const handleTogglePin = (accId: string) => {
    const isPinned = pinnedAccountIds.includes(accId);
    const updated = isPinned ? pinnedAccountIds.filter((id) => id !== accId) : [...pinnedAccountIds, accId];
    setPinnedAccountIds(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketafk_pinned_${currentUser || 'guest'}`, JSON.stringify(updated));
    }
  };

  // Load Accounts & Servers
  useEffect(() => {
    if (!currentUser) {
      setAccounts([]);
      setServers([]);
      return;
    }

    async function loadData() {
      const accKey = `pocketafk_accounts_${currentUser}`;
      const srvKey = `pocketafk_servers_${currentUser}`;

      // 1. Load accounts from storage
      const storedAcc = localStorage.getItem(accKey);
      let loadedAccounts: MinecraftAccount[] = [];
      const seenIgns = new Set<string>();

      if (storedAcc) {
        try {
          const parsed = JSON.parse(storedAcc);
          loadedAccounts = parsed
            .filter((a: any) => !a.id.startsWith('starter-') && a.verified === true)
            .map((a: any) => {
              const cleanIgn = (a.ign && !a.ign.includes('@'))
                ? a.ign
                : (!a.username.includes('@') ? a.username : 'Player');
              return {
                ...a,
                username: cleanIgn,
                ign: cleanIgn,
              };
            })
            .filter((a: any) => {
              const key = (a.ign || a.username || '').trim().toLowerCase();
              if (!key || seenIgns.has(key)) return false;
              seenIgns.add(key);
              return true;
            });
          localStorage.setItem(accKey, JSON.stringify(loadedAccounts));
        } catch (e) {
          // ignore
        }
      }
      setAccounts(loadedAccounts);

      // 2. Load servers from storage
      const storedSrv = localStorage.getItem(srvKey);
      let loadedServers: ServerProfile[] = [];
      if (storedSrv) {
        try {
          loadedServers = JSON.parse(storedSrv);
        } catch (e) {
          // ignore
        }
      }

      // Default starter server if none exist
      if (loadedServers.length === 0) {
        loadedServers = [
          {
            id: 'srv_freshsmp',
            name: 'FreshSMP',
            pocketUser: currentUser,
            accountId: loadedAccounts[0]?.id || '',
            serverHost: 'play.freshsmp.fun',
            serverPort: 25565,
            serverVersion: 'auto',
            authType: 'microsoft',
            autoReconnect: true,
            settings: DEFAULT_BOT_SETTINGS,
          },
        ];
        localStorage.setItem(srvKey, JSON.stringify(loadedServers));
      }

      setServers(loadedServers);
      if (loadedServers.length > 0) {
        setActiveServerId(loadedServers[0].id);
      }

      // 3. Supabase Sync: pull missing database records & push verified accounts
      if (supabase && currentUser) {
        try {
          const { data, error } = await supabase.from('accounts').select('*').ilike('username', currentUser);
          if (data && data.length > 0 && !error) {
            const dbAccountMap = new Map<string, MinecraftAccount>();
            loadedAccounts.forEach((acc) => {
              const key = (acc.ign || acc.username || '').trim().toLowerCase();
              if (key) dbAccountMap.set(key, acc);
            });

            data.forEach((row) => {
              const cleanName = (row.bot_name && !row.bot_name.includes('@')) ? row.bot_name.trim() : null;
              if (cleanName) {
                const lower = cleanName.toLowerCase();
                if (!dbAccountMap.has(lower)) {
                  dbAccountMap.set(lower, {
                    id: `acc_${row.id}`,
                    username: cleanName,
                    ign: cleanName,
                    auth_type: 'microsoft',
                    verified: true,
                    addedAt: Date.now(),
                  });
                }
              }
            });

            const finalAccounts = Array.from(dbAccountMap.values());
            setAccounts(finalAccounts);
            localStorage.setItem(accKey, JSON.stringify(finalAccounts));
          }

          // Push local accounts & servers back to Supabase to guarantee Termux summary accuracy
          await syncAllToSupabase(currentUser, loadedAccounts, loadedServers);
        } catch (e) {
          // ignore
        }
      }
    }

    loadData();
  }, [currentUser]);

  // Microsoft OAuth Device Code Sign-In
  const handleStartMicrosoftLogin = async () => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    if (accounts.filter((a) => a.verified).length >= 5) {
      showToast('Maximum limit of 5 accounts reached.', 'error');
      return;
    }

    setIsAccountsOpen(false);
    setMsAuthError(null);
    setIsPollingMs(true);

    try {
      showToast('Requesting Microsoft sign-in code...', 'info');
      const res = await fetch('/api/minecraft-auth');
      const data = await res.json();

      if (!res.ok || !data.success || !data.deviceCode) {
        throw new Error(data.error || 'Failed to initiate Microsoft login');
      }

      setApiMsAuthData({
        botId: 'new_account',
        userCode: data.userCode,
        url: data.verificationUri,
        deviceCode: data.deviceCode,
      });

      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

      pollingTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/minecraft-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceCode: data.deviceCode }),
          });

          const pollData = await pollRes.json();

          if (pollData.status === 'success' && pollData.ign) {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsPollingMs(false);
            setApiMsAuthData(null);

            const finalIgn = pollData.ign;
            const finalUuid = pollData.uuid || '';

            const newAccount: MinecraftAccount = {
              id: `acc_${Math.random().toString(36).substring(2, 9)}`,
              username: finalIgn,
              ign: finalIgn,
              uuid: finalUuid,
              auth_type: 'microsoft',
              verified: true,
              addedAt: Date.now(),
            };

            setAccounts((prev) => {
              const filtered = prev.filter((a) => (a.ign || a.username).toLowerCase() !== finalIgn.toLowerCase());
              const updated = [...filtered, newAccount];
              const accKey = `pocketafk_accounts_${currentUser}`;
              localStorage.setItem(accKey, JSON.stringify(updated));

              // Sync immediately to Supabase
              syncAllToSupabase(currentUser, updated, servers);
              return updated;
            });

            showToast(`🎉 Linked Microsoft Java account @${finalIgn}!`, 'success');
          } else if (pollData.status === 'error') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsPollingMs(false);
            setMsAuthError(pollData.error || 'Authentication failed.');
            showToast(pollData.error || 'Authentication error', 'error');
          }
        } catch (err: any) {
          console.warn('Poll error:', err);
        }
      }, 3500);
    } catch (err: any) {
      setIsPollingMs(false);
      setMsAuthError(err.message);
      showToast(`Microsoft login failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!currentUser) return;
    const target = accounts.find((a) => a.id === id);
    const accKey = `pocketafk_accounts_${currentUser}`;
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    localStorage.setItem(accKey, JSON.stringify(updated));

    if (target) {
      deleteAccountFromSupabase(currentUser, target.ign || target.username);
    }
    showToast('Minecraft account unlinked.', 'info');
  };

  // Server Profile Management
  const handleSaveServer = async (profile: ServerProfile) => {
    if (!currentUser) return;
    const srvKey = `pocketafk_servers_${currentUser}`;
    profile.pocketUser = currentUser;

    const matched = resolveServerAccount(profile);
    if (matched) {
      profile.accountId = matched.id;
    }

    const existingIndex = servers.findIndex((s) => s.id === profile.id);

    if (existingIndex < 0 && servers.length >= 3) {
      showToast('Maximum of 3 servers reached.', 'error');
      return;
    }

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

    syncAllToSupabase(currentUser, accounts, updated);
    showToast(`Saved server profile "${profile.name}"`, 'success');
  };

  const handleDeleteServer = async (profileId: string) => {
    if (!currentUser) return;
    if (servers.length <= 1) {
      showToast('You must keep at least 1 server profile.', 'error');
      return;
    }
    const srvKey = `pocketafk_servers_${currentUser}`;
    const updated = servers.filter((s) => s.id !== profileId);
    setServers(updated);
    if (activeServerId === profileId) {
      setActiveServerId(updated[0]?.id || '');
    }
    localStorage.setItem(srvKey, JSON.stringify(updated));
    showToast('Server profile removed.', 'info');
  };

  // Bot Lifecycle Controls
  const handleStartServer = (profile: ServerProfile, targetAcc?: MinecraftAccount | null) => {
    if (!currentUser) return;
    const assignedAcc = targetAcc || resolveServerAccount(profile);
    const cleanPlayerName = assignedAcc?.ign || assignedAcc?.username || profile.name;

    startBot({
      id: profile.id,
      username: cleanPlayerName,
      authType: 'microsoft',
      host: profile.serverHost,
      port: profile.serverPort,
      version: profile.serverVersion === 'auto' ? false : profile.serverVersion,
      settings: profile.settings || DEFAULT_BOT_SETTINGS,
    });
    showToast(`Connecting to ${profile.serverHost} as @${cleanPlayerName}...`, 'info');
  };

  const handleStopServer = (profileId: string) => {
    stopBot(profileId);
    showToast('Bot connection stopped.', 'info');
  };

  // Connect Selected / Disconnect Selected
  const handleConnectSelected = () => {
    if (!activeServer) return;
    const target = accounts.find((a) => selectedAccountIds.includes(a.id)) || activeAccount;
    if (!target) {
      showToast('Please select an account to connect.', 'error');
      return;
    }
    // Update activeServer's assigned accountId
    const updatedProfile = { ...activeServer, accountId: target.id };
    handleSaveServer(updatedProfile);
    handleStartServer(updatedProfile, target);
  };

  const handleDisconnectSelected = () => {
    if (!activeServer) return;
    handleStopServer(activeServer.id);
  };

  // Select all toggle
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const q = accountFilter.toLowerCase().trim();
      if (!q) return true;
      const ign = (a.ign || a.username).toLowerCase();
      const note = (accountNotes[a.id] || '').toLowerCase();
      return ign.includes(q) || note.includes(q);
    });
  }, [accounts, accountFilter, accountNotes]);

  const handleSelectAllToggle = () => {
    if (selectedAccountIds.length === filteredAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(filteredAccounts.map((a) => a.id));
    }
  };

  const handleAccountCheckbox = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSecretCode('');
    localStorage.removeItem('pocketafk_user');
  };

  const handleLoginSuccess = (user: string, secret?: string) => {
    setCurrentUser(user);
    localStorage.setItem('pocketafk_user', user);
    if (secret) {
      setSecretCode(secret);
      localStorage.setItem(`pocketafk_secret_${user}`, secret);
    }
  };

  // Bot Status Badge
  const getStatusBadge = (state: BotLifecycleState) => {
    switch (state) {
      case 'SPAWNED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        );
      case 'LOGGED_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Logged In
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Connecting
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
            Reconnecting
          </span>
        );
      case 'KICKED':
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            {state}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1e2535] text-slate-400 border border-[#2a3449]">
            Offline
          </span>
        );
    }
  };

  const isActiveServerRunning =
    botState === 'SPAWNED' || botState === 'LOGGED_IN' || botState === 'CONNECTING';

  return (
    <div className="min-h-screen bg-[#0e1117] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20">
      {/* Toast Notification Container */}
      <ModernToast toast={toast} onDismiss={() => setToast(null)} />

      {/* Microsoft In-App Device Auth Modal */}
      {(msAuthData || apiMsAuthData) && (
        <MicrosoftAuthModal
          authData={msAuthData || apiMsAuthData}
          onClose={() => {
            clearMsAuth();
            setApiMsAuthData(null);
            setIsPollingMs(false);
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          }}
          isPolling={isPollingMs}
          errorMessage={msAuthError}
        />
      )}

      {/* Account Management Modal */}
      <AccountModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={accounts}
        onStartMicrosoftLogin={handleStartMicrosoftLogin}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Server Profile Configuration Modal */}
      <ServerProfileModal
        isOpen={isServerModalOpen}
        onClose={() => {
          setIsServerModalOpen(false);
          setEditingServer(null);
        }}
        accounts={accounts}
        initialProfile={editingServer}
        currentUser={currentUser}
        onSaveProfile={handleSaveServer}
        onDeleteProfile={handleDeleteServer}
        onOpenAddAccount={handleStartMicrosoftLogin}
      />

      {/* Settings / Bridge Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        daemonUrl={daemonUrl}
        authToken={authToken}
        onSaveDaemonSettings={(url, token) => {
          saveSettings(url, token);
          showToast('Termux daemon bridge settings saved.', 'success');
        }}
        botSettings={activeServer?.settings || DEFAULT_BOT_SETTINGS}
        onUpdateBotSettings={(newSettings) => {
          if (activeServer) {
            handleSaveServer({
              ...activeServer,
              settings: { ...activeServer.settings, ...newSettings },
            });
          }
        }}
        termuxCommand={termuxCommand}
      />

      {/* Auth / Login Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Container / Chest Menu Modal */}
      <ContainerModal
        window={containerWindow}
        onClose={() => {
          if (containerWindow) {
            closeWindow(activeServerId, containerWindow.windowId);
          }
          setIsContainerOpen(false);
        }}
        onClickSlot={(slot, mouseButton) => {
          if (containerWindow) {
            clickSlot(activeServerId, containerWindow.windowId, slot, mouseButton || 0);
          }
        }}
      />

      {/* LOGGED OUT GATEWAY */}
      {!currentUser ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#131722] border border-[#202736] rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-white text-3xl shadow-lg shadow-emerald-500/20 mx-auto">
              P
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white tracking-tight">PocketAFK</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                24/7 Pure Java Minecraft AFK bot powered by Termux on Android. Sign in with your username to manage server profiles & bots.
              </p>
            </div>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In / Register
            </button>
          </div>
        </div>
      ) : (
        /* MINECRAFTAFK MAIN DASHBOARD LAYOUT */
        <div className="flex-1 flex flex-col md:flex-row min-h-screen">
          {/* LEFT SIDEBAR (Dark, MinecraftAFK Style) */}
          <aside className="w-full md:w-64 bg-[#131722] border-r border-[#202736] flex flex-col shrink-0">
            {/* Logo Bar */}
            <div className="p-4 border-b border-[#202736] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-sm">
                  P
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-white tracking-tight">PocketAFK</span>
                    <span className={`w-2 h-2 rounded-full ${socketStatus === 'AUTHENTICATED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">24/7 Java Core</span>
                </div>
              </div>
            </div>

            {/* Top Navigation Items */}
            <div className="p-3 space-y-1">
              <button
                onClick={() => setActiveMainView('servers')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'servers'
                    ? 'bg-[#1c2333] text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                }`}
              >
                <Server className="w-4 h-4 text-emerald-400" />
                Servers
              </button>

              <button
                onClick={() => setIsAccountsOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-[#181e2b] transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Accounts
                </div>
                <span className="text-[10px] bg-[#222b3d] text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  {accounts.length}/5
                </span>
              </button>

              <button
                onClick={() => setActiveMainView('proxies')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'proxies'
                    ? 'bg-[#1c2333] text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                }`}
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                Proxies & Termux
              </button>
            </div>

            <div className="border-t border-[#202736] my-1" />

            {/* Server Profiles Section */}
            <div className="p-3 flex-1 overflow-y-auto space-y-1">
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Server profiles</span>
                <button
                  disabled={servers.length >= 3}
                  onClick={() => {
                    if (servers.length >= 3) {
                      showToast('Maximum limit of 3 servers reached.', 'error');
                      return;
                    }
                    setEditingServer(null);
                    setIsServerModalOpen(true);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1e2535] disabled:opacity-40 transition cursor-pointer"
                  title="Add Server Profile (Max 3)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Profiles List */}
              {servers.map((srv) => {
                const isSelected = srv.id === activeServerId;
                const srvState = botStates[srv.id] || 'DISCONNECTED';
                const isRunning = srvState === 'SPAWNED' || srvState === 'LOGGED_IN' || srvState === 'CONNECTING';

                return (
                  <div key={srv.id} className="space-y-1 pt-1">
                    {/* Server Profile Row */}
                    <button
                      onClick={() => {
                        setActiveServerId(srv.id);
                        setActiveMainView('profile');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected && activeMainView === 'profile'
                          ? 'bg-[#1c2333] text-white shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-[#181e2b]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                          {srv.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{srv.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 shrink-0">
                        <Radio className={`w-3 h-3 ${isRunning ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span>{isRunning ? '1' : '0'}/1</span>
                      </div>
                    </button>

                    {/* Sub-Feature Tabs (expanded under the selected server) */}
                    {isSelected && activeMainView === 'profile' && (
                      <div className="ml-3 pl-3 border-l border-[#263145] space-y-0.5 pt-0.5">
                        <button
                          onClick={() => setActiveSubTab('connect')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'connect'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <Home className="w-3.5 h-3.5" />
                          Connect
                        </button>

                        <button
                          onClick={() => setActiveSubTab('chat')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'chat'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat
                        </button>

                        <button
                          onClick={() => setActiveSubTab('movement')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'movement'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5" />
                          Movement
                        </button>

                        <button
                          onClick={() => setActiveSubTab('inventory')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'inventory'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <Box className="w-3.5 h-3.5" />
                          Inventory
                        </button>

                        <button
                          onClick={() => setActiveSubTab('pov')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'pov'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          POV
                        </button>

                        <button
                          onClick={() => setActiveSubTab('settings')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'settings'
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Settings
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom User Pill */}
            <div className="p-3 border-t border-[#202736] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-200 font-mono truncate">
                  @{effectiveUser}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1c2333] rounded-lg transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#0e1117] overflow-y-auto">
            {/* Top Navigation & Status Bar */}
            <header className="h-14 border-b border-[#202736] bg-[#121620]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold">
                {activeMainView === 'profile' ? (
                  <>
                    <span className="text-slate-400">{activeServer?.name || 'Server'}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-emerald-400 uppercase tracking-wider">{activeSubTab}</span>
                  </>
                ) : (
                  <span className="text-emerald-400 uppercase tracking-wider">{activeMainView}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Termux Tunnel Status */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border border-[#263145] bg-[#161c28] hover:border-slate-600 transition cursor-pointer"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      socketStatus === 'AUTHENTICATED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-slate-300">
                    {socketStatus === 'AUTHENTICATED' ? 'Daemon Online' : 'Daemon Offline'}
                  </span>
                </button>

                {/* 1-Click Termux Command Pill */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(termuxCommand);
                    showToast(`Copied 1-click launcher command!`, 'success');
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-[#1b2230] hover:bg-[#232c3f] border border-[#2b364c] text-emerald-400 transition cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>1-Click Termux</span>
                </button>

                {/* Settings icon */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2333] transition cursor-pointer"
                  title="Bridge Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* TAB CONTENT PANELS */}
            <div className="p-4 sm:p-6 flex-1 max-w-6xl w-full">
              {/* VIEW: SERVERS OVERVIEW */}
              {activeMainView === 'servers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">Server Profiles</h2>
                      <p className="text-xs text-slate-400">Configure up to 3 Minecraft servers to AFK simultaneously.</p>
                    </div>
                    <button
                      disabled={servers.length >= 3}
                      onClick={() => {
                        setEditingServer(null);
                        setIsServerModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" /> Add Server Profile
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servers.map((srv) => {
                      const srvState = botStates[srv.id] || 'DISCONNECTED';
                      const assigned = resolveServerAccount(srv);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => {
                            setActiveServerId(srv.id);
                            setActiveMainView('profile');
                            setActiveSubTab('connect');
                          }}
                          className="p-4 rounded-2xl bg-[#141824] border border-[#202736] hover:border-emerald-500/50 transition cursor-pointer space-y-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm text-white">{srv.name}</span>
                            {getStatusBadge(srvState)}
                          </div>
                          <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-500" />
                            <span>{srv.serverHost}:{srv.serverPort}</span>
                          </div>
                          {assigned && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[#202736]">
                              <div className="w-5 h-5 rounded-xs overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                                <img
                                  src={`https://crafthead.net/helm/${encodeURIComponent((assigned.uuid || assigned.ign || assigned.username).split('@')[0])}/32`}
                                  alt={assigned.ign || assigned.username}
                                  className="w-full h-full object-cover [image-rendering:pixelated]"
                                />
                              </div>
                              <span className="text-xs text-slate-300 font-bold">{assigned.ign || assigned.username}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW: PROXIES & TERMUX */}
              {activeMainView === 'proxies' && (
                <div className="max-w-2xl space-y-4">
                  <div>
                    <h2 className="text-lg font-black text-white">Proxies & Termux Bridge</h2>
                    <p className="text-xs text-slate-400">Connect your Android Termux daemon to run 24/7 bots headless.</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#141824] border border-[#202736] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-bold text-white">Termux 1-Click Command</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${socketStatus === 'AUTHENTICATED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {socketStatus === 'AUTHENTICATED' ? 'Connected' : 'Waiting for connection'}
                      </span>
                    </div>

                    <div className="p-3 bg-[#0d1017] border border-[#1f2637] rounded-xl font-mono text-xs text-emerald-300 break-all select-all">
                      {termuxCommand}
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(termuxCommand);
                        showToast('Copied Termux 1-click command!', 'success');
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      📋 Copy Termux Command
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW: PROFILE SUB-TABS */}
              {activeMainView === 'profile' && activeServer && (
                <>
                  {/* SUB-TAB 1: CONNECT (Exact match of Screenshot 5) */}
                  {activeSubTab === 'connect' && (
                    <div className="space-y-4">
                      {/* Top Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={handleConnectSelected}
                            disabled={socketStatus !== 'AUTHENTICATED' || selectedAccountIds.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Connect Selected
                          </button>
                          <button
                            onClick={handleDisconnectSelected}
                            disabled={!isActiveServerRunning}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            Disconnect Selected
                          </button>
                        </div>

                        {/* Search / Filter Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Filter accounts..."
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-xl bg-[#141824] border border-[#202736] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>

                      {/* Accounts Table for this Server Profile */}
                      <div className="bg-[#141824] border border-[#202736] rounded-2xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#181e2c] border-b border-[#202736] text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                            <tr>
                              <th className="p-3 w-8">
                                <input
                                  type="checkbox"
                                  checked={selectedAccountIds.length > 0 && selectedAccountIds.length === filteredAccounts.length}
                                  onChange={handleSelectAllToggle}
                                  className="rounded bg-[#1e2535] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                                />
                              </th>
                              <th className="p-3">Account Name</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Note</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#202736]">
                            {filteredAccounts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400">
                                  <div className="space-y-2">
                                    <p className="text-xs">No Minecraft accounts linked yet.</p>
                                    <button
                                      onClick={handleStartMicrosoftLogin}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Link Microsoft Java Account
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredAccounts.map((acc) => {
                                const isChecked = selectedAccountIds.includes(acc.id);
                                const isAssignedActive = activeAccount?.id === acc.id;
                                const currentBotState = isAssignedActive ? botState : 'DISCONNECTED';
                                const isPinned = pinnedAccountIds.includes(acc.id);

                                return (
                                  <tr
                                    key={acc.id}
                                    className={`hover:bg-[#181e2b] transition ${
                                      isChecked ? 'bg-[#181e2b]/60' : ''
                                    }`}
                                  >
                                    <td className="p-3">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleAccountCheckbox(acc.id)}
                                        className="rounded bg-[#1e2535] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-md overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                                          <img
                                            src={`https://crafthead.net/helm/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/32`}
                                            alt={acc.ign || acc.username}
                                            className="w-full h-full object-cover [image-rendering:pixelated]"
                                            onError={(e) => {
                                              const img = e.target as HTMLImageElement;
                                              if (!img.src.includes('mc-heads')) {
                                                img.src = `https://mc-heads.net/avatar/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/32`;
                                              }
                                            }}
                                          />
                                        </div>
                                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                          <span>{acc.ign || acc.username}</span>
                                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {getStatusBadge(currentBotState)}
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        placeholder="Add note (e.g. at hashi's farm)..."
                                        value={accountNotes[acc.id] || ''}
                                        onChange={(e) => handleUpdateNote(acc.id, e.target.value)}
                                        className="w-full max-w-xs px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#202736] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => handleTogglePin(acc.id)}
                                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            isPinned ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300'
                                          }`}
                                          title={isPinned ? 'Unpin' : 'Pin'}
                                        >
                                          <Pin className="w-3.5 h-3.5" />
                                        </button>

                                        {isAssignedActive && isActiveServerRunning ? (
                                          <button
                                            onClick={() => handleStopServer(activeServer.id)}
                                            className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition cursor-pointer"
                                            title="Disconnect bot"
                                          >
                                            <Square className="w-3.5 h-3.5 fill-current" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              const updated = { ...activeServer, accountId: acc.id };
                                              handleSaveServer(updated);
                                              handleStartServer(updated, acc);
                                            }}
                                            disabled={socketStatus !== 'AUTHENTICATED'}
                                            className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 transition cursor-pointer"
                                            title="Connect this account"
                                          >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                          </button>
                                        )}

                                        <button
                                          onClick={() => handleDeleteAccount(acc.id)}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                          title="Unlink account"
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

                      {/* Add Account Button at Bottom of Table */}
                      <div className="flex justify-start">
                        <button
                          disabled={accounts.length >= 5}
                          onClick={handleStartMicrosoftLogin}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141824] hover:bg-[#1a2030] border border-[#202736] text-emerald-400 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4" /> Link Another Microsoft Account ({accounts.length}/5)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: CHAT (Exact match of Screenshot 4) */}
                  {activeSubTab === 'chat' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">Chat receivers:</span>
                          <span className="px-2.5 py-1 rounded-lg bg-[#141824] border border-[#202736] text-xs font-bold text-emerald-400">
                            {activeAccount?.ign || activeAccount?.username || 'All accounts'}
                          </span>
                        </div>
                      </div>

                      {/* In-Game Minecraft Styled Console */}
                      <div className="h-[480px]">
                        <Terminal
                          messages={messages}
                          onSendMessage={(msg) => sendChat(activeServer.id, msg)}
                          onClear={() => clearMessages(activeServer.id)}
                          disabled={!isActiveServerRunning}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: MOVEMENT */}
                  {activeSubTab === 'movement' && (
                    <div className="max-w-2xl space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-white">Movement & Controls</h2>
                        <p className="text-xs text-slate-400">Control your bot movements and trigger in-game macros.</p>
                      </div>

                      <div className="p-6 rounded-2xl bg-[#141824] border border-[#202736] space-y-6">
                        {/* Directional Pad */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => sendChat(activeServer.id, '/jump')}
                            className="w-14 h-14 rounded-2xl bg-[#1b2232] hover:bg-[#253046] border border-[#2a364d] text-slate-200 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                          >
                            ▲ W
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => sendChat(activeServer.id, '/left')}
                              className="w-14 h-14 rounded-2xl bg-[#1b2232] hover:bg-[#253046] border border-[#2a364d] text-slate-200 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                            >
                              ◀ A
                            </button>
                            <button
                              onClick={() => sendChat(activeServer.id, '/jump')}
                              className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                            >
                              JUMP
                            </button>
                            <button
                              onClick={() => sendChat(activeServer.id, '/right')}
                              className="w-14 h-14 rounded-2xl bg-[#1b2232] hover:bg-[#253046] border border-[#2a364d] text-slate-200 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                            >
                              ▶ D
                            </button>
                          </div>
                          <button
                            onClick={() => sendChat(activeServer.id, '/back')}
                            className="w-14 h-14 rounded-2xl bg-[#1b2232] hover:bg-[#253046] border border-[#2a364d] text-slate-200 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                          >
                            ▼ S
                          </button>
                        </div>

                        {/* Quick Command Macros */}
                        <div className="pt-4 border-t border-[#202736]">
                          <span className="text-xs font-bold text-slate-400 block mb-2">In-Game Command Macros</span>
                          <div className="flex flex-wrap gap-2">
                            {['/afk', '/lifesteal', '/afkrewards', '/home', '/spawn'].map((cmd) => (
                              <button
                                key={cmd}
                                onClick={() => sendChat(activeServer.id, cmd)}
                                className="px-3 py-1.5 rounded-xl bg-[#1b2232] hover:bg-[#253046] border border-[#2a364d] text-emerald-400 font-mono text-xs font-bold transition cursor-pointer"
                              >
                                {cmd}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 4: INVENTORY */}
                  {activeSubTab === 'inventory' && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-white">Inventory & Container Menus</h2>
                        <p className="text-xs text-slate-400">View opened server chest menus and player inventory slots.</p>
                      </div>

                      {containerWindow ? (
                        <div className="p-6 rounded-2xl bg-[#141824] border border-[#202736] space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-white">{containerWindow.title || 'Chest / Menu'}</h3>
                            <span className="text-xs font-mono text-emerald-400">Window #{containerWindow.windowId}</span>
                          </div>

                          <div className="grid grid-cols-9 gap-1.5 p-3 bg-[#0d1017] border border-[#202736] rounded-xl">
                            {containerWindow.slots.map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() => clickSlot(activeServer.id, containerWindow.windowId, idx, 0)}
                                className="aspect-square rounded-lg border border-slate-700 bg-[#161c28] hover:border-emerald-500 flex items-center justify-center relative cursor-pointer"
                              >
                                {item && (
                                  <span className="text-[10px] font-mono text-slate-200 truncate px-1">
                                    {item.displayName || item.name}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-12 text-center rounded-2xl bg-[#141824] border border-[#202736] text-slate-400 space-y-2">
                          <Box className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-xs">No active chest or container menu open on this server.</p>
                          <p className="text-[11px] text-slate-500">When the bot opens a chest or server GUI, slots appear here automatically.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 5: POV / TELEMETRY */}
                  {activeSubTab === 'pov' && (
                    <div className="max-w-2xl space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-white">POV & World Telemetry</h2>
                        <p className="text-xs text-slate-400">Live coordinates, health, hunger, and world dimension data.</p>
                      </div>

                      <div className="p-6 rounded-2xl bg-[#141824] border border-[#202736] space-y-5">
                        {/* Health & Hunger */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-[#0e1117] border border-[#202736] space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                              <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 fill-current" /> Health</span>
                              <span>{telemetry?.health ?? 20} / 20</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-rose-500 rounded-full"
                                style={{ width: `${Math.min(100, ((telemetry?.health ?? 20) / 20) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#0e1117] border border-[#202736] space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                              <span className="flex items-center gap-1.5"><Utensils className="w-4 h-4" /> Hunger</span>
                              <span>{telemetry?.food ?? 20} / 20</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, ((telemetry?.food ?? 20) / 20) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Coordinates & Dimension */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-3 rounded-xl bg-[#0e1117] border border-[#202736]">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">X</span>
                            <span className="text-sm font-mono font-bold text-white">{telemetry?.position?.x ?? 0}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-[#0e1117] border border-[#202736]">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Y</span>
                            <span className="text-sm font-mono font-bold text-white">{telemetry?.position?.y ?? 0}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-[#0e1117] border border-[#202736]">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Z</span>
                            <span className="text-sm font-mono font-bold text-white">{telemetry?.position?.z ?? 0}</span>
                          </div>
                        </div>

                        {/* Dimension & Ping */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#202736] text-xs font-mono">
                          <span className="text-slate-400">Dimension: <b className="text-emerald-400">{telemetry?.dimension || 'Overworld'}</b></span>
                          <span className="text-slate-400">Ping: <b className="text-emerald-400">{telemetry?.ping ?? 0}ms</b></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 6: SETTINGS (Exact match of Screenshot 3) */}
                  {activeSubTab === 'settings' && (
                    <div className="max-w-2xl space-y-6">
                      <div>
                        <h2 className="text-lg font-black text-white">Settings</h2>
                        <p className="text-xs text-slate-400">Configure connection details, anti-AFK intervals, and survival automations.</p>
                      </div>

                      {/* Server Information */}
                      <div className="p-5 rounded-2xl bg-[#141824] border border-[#202736] space-y-4">
                        <h3 className="font-bold text-sm text-white">Server information</h3>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Profile name</label>
                          <input
                            type="text"
                            value={activeServer.name}
                            onChange={(e) => handleSaveServer({ ...activeServer, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-[#0e1117] border border-[#202736] text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400">Server IP</label>
                          <input
                            type="text"
                            value={activeServer.serverHost}
                            onChange={(e) => handleSaveServer({ ...activeServer, serverHost: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-[#0e1117] border border-[#202736] text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400">Java version</label>
                            <select
                              value={activeServer.serverVersion}
                              onChange={(e) => handleSaveServer({ ...activeServer, serverVersion: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-[#0e1117] border border-[#202736] text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              <option value="auto">Auto Detect</option>
                              <option value="1.20.4">1.20.4</option>
                              <option value="1.20.2">1.20.2</option>
                              <option value="1.20.1">1.20.1</option>
                              <option value="1.19.4">1.19.4</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400">Server Port</label>
                            <input
                              type="number"
                              value={activeServer.serverPort}
                              onChange={(e) => handleSaveServer({ ...activeServer, serverPort: parseInt(e.target.value, 10) || 25565 })}
                              className="w-full px-3 py-2 rounded-xl bg-[#0e1117] border border-[#202736] text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Extra Settings */}
                      <div className="p-5 rounded-2xl bg-[#141824] border border-[#202736] space-y-4">
                        <h3 className="font-bold text-sm text-white">Extra settings</h3>

                        {/* Auto Reconnect */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Auto reconnect</span>
                            <span className="text-[11px] text-slate-400">Reconnect bot if kicked or server restarts</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={activeServer.autoReconnect}
                            onChange={(e) => handleSaveServer({ ...activeServer, autoReconnect: e.target.checked })}
                            className="rounded bg-[#0e1117] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Anti-AFK */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Anti-AFK Actions</span>
                            <span className="text-[11px] text-slate-400">Random pitch, yaw shifts, arm swings and sneaks</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={activeServer.settings.antiAfk}
                            onChange={(e) =>
                              handleSaveServer({
                                ...activeServer,
                                settings: { ...activeServer.settings, antiAfk: e.target.checked },
                              })
                            }
                            className="rounded bg-[#0e1117] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Physics */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Physics Engine</span>
                            <span className="text-[11px] text-slate-400">Keep enabled for servers that require gravity & velocity sync</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={activeServer.settings.physics}
                            onChange={(e) =>
                              handleSaveServer({
                                ...activeServer,
                                settings: { ...activeServer.settings, physics: e.target.checked },
                              })
                            }
                            className="rounded bg-[#0e1117] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Mob Farm Combat */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Mob Farm Attack</span>
                            <span className="text-[11px] text-slate-400">Auto attack hostile mobs within 3.5 blocks</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={activeServer.settings.mobFarm}
                            onChange={(e) =>
                              handleSaveServer({
                                ...activeServer,
                                settings: { ...activeServer.settings, mobFarm: e.target.checked },
                              })
                            }
                            className="rounded bg-[#0e1117] border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Dangerous Settings */}
                      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-rose-400 block">Delete Server Profile</span>
                          <span className="text-[11px] text-slate-400">Permanently remove this server configuration</span>
                        </div>
                        <button
                          onClick={() => handleDeleteServer(activeServer.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
                        >
                          Delete Profile
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
