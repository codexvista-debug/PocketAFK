'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDaemonSocket, AccountVerifiedData } from '../lib/useDaemonSocket';
import { MinecraftAccount, ServerProfile, BotSettings, BotLifecycleState, QuickCommandItem, PlayerLogEntry, PlayerLogType, ActivityLog, WebhookConfig, DEFAULT_WEBHOOK_CONFIG } from '../types';
import { Terminal } from '../components/Terminal';
import { ContainerModal } from '../components/ContainerModal';
import { SettingsModal } from '../components/SettingsModal';
import { AccountModal } from '../components/AccountModal';
import { ServerProfileModal } from '../components/ServerProfileModal';
import { ServerPlayerCount } from '../components/ServerPlayerCount';
import { AuthModal } from '../components/AuthModal';
import { MicrosoftAuthModal } from '../components/MicrosoftAuthModal';
import { ServerLogo } from '../components/ServerLogo';
import { ModernToast, ToastMessage } from '../components/ModernToast';
import { RankModal } from '../components/RankModal';
import { DangerousSettingsModal } from '../components/DangerousSettingsModal';
import { QuickCommandsModal, DEFAULT_QUICK_COMMANDS } from '../components/QuickCommandsModal';
import { AccountLogsModal } from '../components/AccountLogsModal';
import { XaerosMinimap } from '../components/XaerosMinimap';
import { MinecraftChatMessage } from '../components/MinecraftChatMessage';
import { WebhookView } from '../components/WebhookView';
import { RANKS, UserRank, getRankConfig } from '../lib/ranks';
import { supabase } from '../lib/supabaseClient';
import {
  syncAllToSupabase,
  deleteAccountFromSupabase,
  recordAccountConnectionStart,
  recordAccountConnectionStop,
  loadAccountSessionsFromSupabase,
  saveServersToSupabase,
  loadServersFromSupabase,
  loadAccountsFromSupabase,
  saveQuickCommandsToSupabase,
  loadQuickCommandsFromSupabase,
  saveAccountLogsToSupabase,
  loadAccountLogsFromSupabase,
  saveNotesToSupabase,
  loadNotesFromSupabase,
  saveWebhookConfigToSupabase,
  loadWebhookConfigFromSupabase,
} from '../lib/supabaseSync';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Settings2, 
  Plus, 
  Minus,
  Clock,
  Server, 
  Globe, 
  ShieldCheck, 
  ShieldAlert,
  AlertCircle, 
  AlertTriangle,
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
  ChevronDown,
  ChevronUp,
  Heart,
  Utensils,
  Terminal as TerminalIcon,
  Check,
  Copy,
  ArrowUpDown,
  Upload,
  LayoutDashboard,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { DashboardOverview } from '../components/DashboardOverview';
import { AuthLanding } from '../components/AuthLanding';
import { AccountSettingsView } from '../components/AccountSettingsView';
import { TermuxStreamView } from '../components/TermuxStreamView';

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

type MainView = 'dashboard' | 'termux' | 'webhook' | 'profile' | 'servers' | 'accounts' | 'account';
type SubTab = 'connect' | 'chat' | 'movement' | 'inventory' | 'pov' | 'settings';

function safeMinecraftText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
      try {
        const obj = JSON.parse(val);
        return safeMinecraftText(obj);
      } catch {}
    }
    return val;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    let t = val.text || val.value || '';
    if (Array.isArray(val.extra)) {
      t += val.extra.map((e: any) => safeMinecraftText(e)).join('');
    }
    if (Array.isArray(val.with)) {
      t += val.with.map((w: any) => safeMinecraftText(w)).join(' ');
    }
    if (!t && val.translate) {
      t = val.translate;
    }
    return t || (typeof val.toString === 'function' && val.toString !== Object.prototype.toString ? val.toString() : '');
  }
  return String(val || '');
}

function purgeLocalUserData(username: string) {
  if (typeof window === 'undefined' || !username) return;
  const raw = username.trim();
  const lower = raw.toLowerCase();
  const prefixes = [
    'pocketafk_accounts_',
    'pocketafk_servers_',
    'pocketafk_secret_',
    'pocketafk_rank_',
    'pocketafk_notes_',
    'pocketafk_pinned_',
    'pocketafk_pinned_servers_',
    'pocketafk_server_connections_',
    'pocketafk_player_logs_',
    'pocketafk_sessions_',
  ];
  for (const prefix of prefixes) {
    localStorage.removeItem(`${prefix}${raw}`);
    localStorage.removeItem(`${prefix}${lower}`);
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const kLower = k.toLowerCase();
      if (
        kLower === `pocketafk_secret_${lower}` ||
        kLower === `pocketafk_accounts_${lower}` ||
        kLower === `pocketafk_servers_${lower}` ||
        kLower.endsWith(`_${lower}`) ||
        kLower.includes(`_${lower}_`)
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

function sanitizeAccounts(list: MinecraftAccount[]): MinecraftAccount[] {
  return (list || []).filter((a) => {
    const n = (a.ign || a.username || '').toLowerCase();
    return n !== 'new_account' && a.id !== 'new_account';
  });
}

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_user') || null;
    }
    return null;
  });
  const sessionRevokedHandlerRef = useRef<() => void>(() => {});
  const [chatAutoScrollEnabled, setChatAutoScrollEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const userKey = (localStorage.getItem('pocketafk_user') || 'guest').trim().toLowerCase();
    return localStorage.getItem(`pocketafk_chat_auto_scroll_${userKey}`) !== 'false';
  });

  useEffect(() => {
    const userKey = (currentUser || 'guest').trim().toLowerCase();
    setChatAutoScrollEnabled(localStorage.getItem(`pocketafk_chat_auto_scroll_${userKey}`) !== 'false');
  }, [currentUser]);
  const [secretCode, setSecretCode] = useState<string>('');
  const [accountConnections, setAccountConnections] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('pocketafk_connections');
      if (stored) setAccountConnections(JSON.parse(stored));
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || params.get('view');
      if (tab === 'dashboard') {
        setActiveMainView('dashboard');
      } else if (tab === 'servers' || tab === 'accounts' || tab === 'profile' || tab === 'account' || tab === 'termux') {
        setActiveMainView(tab as MainView);
      }
    } catch (e) {}
  }, []);

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
    // Fetch authoritative user-specific secret key from server to keep 1-click command current
    fetch(`/api/auth?username=${encodeURIComponent(currentUser)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.secretCode) {
          setSecretCode(data.secretCode);
          try {
            localStorage.setItem(`pocketafk_secret_${currentUser}`, data.secretCode);
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // Views & Tabs (MinecraftAFK Architecture)
  const [activeMainView, setActiveMainView] = useState<MainView>('profile');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('connect');

  // Accounts & Servers state
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  const [daemonStatusHistory, setDaemonStatusHistory] = useState<{
    daemonStartedAt: number | null;
    lastDisconnectedAt: number | null;
    statusStorageAvailable: boolean;
  }>({ daemonStartedAt: null, lastDisconnectedAt: null, statusStorageAvailable: false });

  // Connect table state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState('');
  const [accountNotes, setAccountNotes] = useState<Record<string, string>>({});
  const [pinnedAccountIds, setPinnedAccountIds] = useState<string[]>([]);

  // Server view & table state
  const [pinnedServerIds, setPinnedServerIds] = useState<string[]>([]);
  const [serverConnections, setServerConnections] = useState<Record<string, number>>({});
  const [serverFilter, setServerFilter] = useState('');

  // User Rank State (Iron, Gold, Diamond, Emerald)
  const [userRank, setUserRank] = useState<UserRank>('iron');
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const currentRankConfig = useMemo(() => getRankConfig(userRank), [userRank]);

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDangerousSettingsOpen, setIsDangerousSettingsOpen] = useState(false);
  const [isContainerOpen, setIsContainerOpen] = useState(false);
  const [isQuickCommandsModalOpen, setIsQuickCommandsModalOpen] = useState(false);
  const [autoSynced, setAutoSynced] = useState(false);
  const [selectedLogsAccount, setSelectedLogsAccount] = useState<MinecraftAccount | null>(null);
  const [selectedLogsServerContext, setSelectedLogsServerContext] = useState<{ id: string; host: string } | null>(null);
  const [isAccountLogsOpen, setIsAccountLogsOpen] = useState(false);
  const [accountLogsMap, setAccountLogsMap] = useState<Record<string, PlayerLogEntry[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('pocketafk_user') || 'guest';
        const saved = localStorage.getItem(`pocketafk_player_logs_${u}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Discord Webhooks State (Universal All-Bots & Daemon Alerts)
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('pocketafk_user') || 'guest';
        const saved = localStorage.getItem(`pocketafk_webhooks_${u}`);
        if (saved) return { ...DEFAULT_WEBHOOK_CONFIG, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return DEFAULT_WEBHOOK_CONFIG;
  });

  // Ensure clean light mode
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
      localStorage.removeItem('pocketafk_theme');
    }
  }, []);

  // Player Audit & Connection Logs Handlers
  const addPlayerLog = useCallback(
    (
      accountName: string,
      serverHost: string,
      type: PlayerLogType,
      message: string,
      details?: string,
      status: 'info' | 'success' | 'warning' | 'error' = 'info'
    ) => {
      if (!accountName) return;
      const cleanName = accountName.replace(/^@/, '').trim();
      const newEntry: PlayerLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        accountName: cleanName,
        serverHost: serverHost || 'Configured Server',
        timestamp: Date.now(),
        type,
        message,
        details,
        status,
      };

      setAccountLogsMap((prev) => {
        const currentList = prev[cleanName] || [];
        if (
          currentList.length > 0 &&
          currentList[0].message === message &&
          Date.now() - currentList[0].timestamp < 2000
        ) {
          return prev;
        }
        const updatedList = [newEntry, ...currentList].slice(0, 150);
        const updatedMap = { ...prev, [cleanName]: updatedList };

        if (typeof window !== 'undefined') {
          const u = currentUser || 'guest';
          try {
            localStorage.setItem(`pocketafk_player_logs_${u}`, JSON.stringify(updatedMap));
          } catch (e) {}
        }

        if (currentUser) {
          saveAccountLogsToSupabase(currentUser, cleanName, updatedList).catch(() => {});
        }

        return updatedMap;
      });
    },
    [currentUser]
  );

  const handleOpenAccountLogs = async (acc: MinecraftAccount) => {
    setSelectedLogsAccount(acc);
    const selectedServer = servers.find((server) => server.id === activeServerId);
    setSelectedLogsServerContext(
      activeMainView === 'profile' && activeSubTab === 'connect' && selectedServer
        ? { id: selectedServer.id, host: selectedServer.serverHost }
        : null
    );
    setIsAccountLogsOpen(true);
    const cleanName = (acc.ign || acc.expectedIgn || acc.username || '').replace(/^@/, '').trim();
    if (currentUser && cleanName) {
      try {
        const remoteLogs = await loadAccountLogsFromSupabase(currentUser, cleanName);
        if (remoteLogs && remoteLogs.length > 0) {
          setAccountLogsMap((prev) => {
            const current = prev[cleanName] || [];
            const map = new Map<string, PlayerLogEntry>();
            [...current, ...remoteLogs].forEach((l) => map.set(l.id, l));
            const merged = Array.from(map.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 150);
            return { ...prev, [cleanName]: merged };
          });
        }
      } catch (err) {}
    }
  };

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

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Math.random().toString(36).substring(2, 9), message, type });
  }, []);

  const handleDismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // The selected sender also controls which account's chat is displayed.
  const [chatSenderAccountId, setChatSenderAccountId] = useState<string>('all');

  // Handle Account Verification callback from daemon
  const handleAccountVerified = useCallback((data: AccountVerifiedData) => {
    setIsPollingMs(false);
    if (!data.ign || data.ign.toLowerCase() === 'new_account') {
      showToast('Verification failed: No valid Minecraft Java profile found.', 'error');
      return;
    }

    setAccounts((prevAccounts) => {
      const cleanAccounts = sanitizeAccounts(prevAccounts);

      // Find the account targeted by botId or username/email (if explicitly targeting an existing account)
      const targetAcc = cleanAccounts.find(
        (acc) =>
          acc.id !== 'new_account' &&
          ((data.botId && data.botId !== 'new_account' && acc.id === data.botId) ||
           (data.email && data.email !== 'new_account' && acc.username.toLowerCase() === data.email.toLowerCase()) ||
           (data.email && data.email !== 'new_account' && acc.expectedIgn && acc.expectedIgn.toLowerCase() === data.email.toLowerCase()))
      );

      // Expected Minecraft IGN
      const rawExpected = targetAcc?.expectedIgn || (targetAcc && !targetAcc.username.includes('@') ? targetAcc.username : null);
      const expectedName = rawExpected && rawExpected.toLowerCase() !== 'new_account' ? rawExpected : null;

      // ACCOUNT MISMATCH GUARD: Check if targeted account was expecting a different name
      if (expectedName && expectedName.toLowerCase() !== data.ign.toLowerCase()) {
        const errorText = `Account mismatch: Authenticated as '${data.ign}', but expected '${expectedName}'. Verification aborted.`;
        showToast(errorText, 'error');

        const updatedWithMismatch = cleanAccounts.map((acc) => {
          if (acc.id === targetAcc?.id) {
            return {
              ...acc,
              verified: false,
              authError: `Verification failed: Logged into Microsoft account '${data.ign}', but expected '${expectedName}'. Please log into the correct Microsoft account.`,
            };
          }
          return acc;
        });

        const userKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
        if (typeof window !== 'undefined') {
          localStorage.setItem(userKey, JSON.stringify(updatedWithMismatch));
        }
        return updatedWithMismatch;
      }

      // DUPLICATE GUARD: Prevent duplicate linked accounts
      const alreadyLinked = cleanAccounts.find(
        (acc) =>
          acc.id !== targetAcc?.id &&
          ((acc.ign && acc.ign.toLowerCase() === data.ign.toLowerCase()) ||
           (acc.uuid && data.uuid && acc.uuid === data.uuid))
      );

      if (alreadyLinked) {
        showToast(
          `Account '@${data.ign}' is already linked! Please enter the Microsoft email for your other Minecraft account.`,
          'error'
        );
        return cleanAccounts;
      }

      let nextAccounts: MinecraftAccount[];
      const exists = cleanAccounts.some(
        (acc) =>
          (data.botId && data.botId !== 'new_account' && acc.id === data.botId) ||
          (acc.ign && acc.ign.toLowerCase() === data.ign.toLowerCase()) ||
          (data.email && data.email !== 'new_account' && acc.username.toLowerCase() === data.email.toLowerCase())
      );

      if (exists) {
        nextAccounts = cleanAccounts.map((acc) => {
          if (
            (data.email && data.email !== 'new_account' && acc.username.toLowerCase() === data.email.toLowerCase()) ||
            (data.botId && data.botId !== 'new_account' && acc.id === data.botId) ||
            (acc.ign && acc.ign.toLowerCase() === data.ign.toLowerCase())
          ) {
            return {
              ...acc,
              username: data.ign,
              ign: data.ign,
              uuid: data.uuid,
              verified: true,
              authError: undefined,
            };
          }
          return acc;
        });
      } else {
        const newAcc: MinecraftAccount = {
          id: data.botId && data.botId !== 'new_account' ? data.botId : `acc_${Math.random().toString(36).substring(2, 9)}`,
          username: data.ign,
          ign: data.ign,
          uuid: data.uuid,
          auth_type: 'microsoft',
          verified: true,
          addedAt: Date.now(),
        };
        nextAccounts = [...cleanAccounts, newAcc];
      }

      showToast(`Successfully linked official Java account @${data.ign}!`, 'success');

      const userKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
      if (typeof window !== 'undefined') {
        localStorage.setItem(userKey, JSON.stringify(nextAccounts));
      }

      if (currentUser) {
        syncAllToSupabase(currentUser, nextAccounts, servers);
        deleteAccountFromSupabase(currentUser, 'new_account').catch(() => {});
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
    telemetries,
    messages,
    allMessages,
    allActivityLogs,
    daemonRuntimeInfo,
    activityLogs,
    currentActivityLogs,
    containerWindow,
    botStates,
    botStateReasons,
    botVersions,
    daemonUrl,
    daemonConnections,
    authToken,
    saveSettings,
    reconnect: reconnectDaemon,
    startBot,
    stopBot,
    restartBot,
    restartDaemon,
    shutdownDaemon,
    revokeDaemonConnection,
    sendChat,
    clickSlot,
    closeWindow,
    updateSettings,
    verifyAccount,
    importAccountTokens,
    updateWebhookConfig,
    msAuthData,
    clearMsAuth,
  } = useDaemonSocket(activeServerId, handleAccountVerified, Boolean(currentUser), currentUser, () => sessionRevokedHandlerRef.current());

  // Device-code prompts from a running bot can occur when its saved Microsoft
  // session expires. Keep those in the background; only show the blocking auth
  // dialog when the user explicitly started an account link/verification flow.
  useEffect(() => {
    if (!msAuthData || isPollingMs) return;
    showToast(`Microsoft sign-in is needed for ${msAuthData.botId}. Open Accounts and relink it when you’re ready.`, 'info');
    clearMsAuth();
  }, [msAuthData, isPollingMs, showToast, clearMsAuth]);

  // Auto-sync Discord webhook preferences to daemon bridge on connection
  useEffect(() => {
    if (socketStatus === 'AUTHENTICATED' && webhookConfig) {
      updateWebhookConfig(webhookConfig);
    }
  }, [socketStatus, webhookConfig, updateWebhookConfig]);


  const handleLogout = useCallback(() => {
    if (currentUser) {
      purgeLocalUserData(currentUser);
    }
    setCurrentUser(null);
    setSecretCode('');
    setAccountNotes({});
    localStorage.removeItem('pocketafk_user');
    saveSettings('', '');
    setToast(null);
  }, [currentUser, saveSettings]);
  sessionRevokedHandlerRef.current = handleLogout;

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
      if (Array.isArray(srv.assignedAccountIds) && srv.assignedAccountIds.length > 0) {
        const byAssigned = accounts.find((a) => srv.assignedAccountIds?.includes(a.id));
        if (byAssigned) return byAssigned;
      }
      return null;
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

  // Format seconds into clean human-readable uptime (e.g. "4m 12s", "1h 05m 20s", "15s")
  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    if (m > 0) {
      return `${m}m ${String(s).padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  // Uptime state & live 1-second ticker with persistent localStorage storage
  const [sessionStartTimes, setSessionStartTimes] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('pocketafk_user') || 'guest';
        const saved = localStorage.getItem(`pocketafk_sessions_${u}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reload session start times when user switches or logs in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const u = currentUser || 'guest';
      const saved = localStorage.getItem(`pocketafk_sessions_${u}`);
      if (saved) setSessionStartTimes(JSON.parse(saved));
    } catch (e) {}

    if (currentUser) {
      loadAccountSessionsFromSupabase(currentUser).then((remote) => {
        if (remote && Object.keys(remote).length > 0) {
          setSessionStartTimes((prev) => {
            const merged = { ...remote };
            for (const [k, v] of Object.entries(prev)) {
              if (!merged[k] || v < merged[k]) {
                merged[k] = v;
              }
            }
            const u = currentUser || 'guest';
            try {
              localStorage.setItem(`pocketafk_sessions_${u}`, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      }).catch(() => {});
    }
  }, [currentUser]);

  // Update session start times when bot states change
  useEffect(() => {
    // CRITICAL: Do NOT wipe or modify sessions if socket is still connecting or not authenticated yet!
    // On page load/refresh, socketStatus starts as DISCONNECTED/CONNECTING, and botState is DISCONNECTED.
    // If we acted on DISCONNECTED during initial mount, it would erase valid saved sessions!
    if (socketStatus !== 'AUTHENTICATED') return;

    setSessionStartTimes((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.entries(botStates).forEach(([bId, st]) => {
        if (st === 'SPAWNED' || st === 'LOGGED_IN') {
          // If we already have a recorded start time for this bot/server, KEEP IT!
          if (!next[bId]) {
            next[bId] = Date.now();
            changed = true;
          }
        } else if (st === 'DISCONNECTED' || st === 'ERROR' || st === 'KICKED') {
          const reason = botStateReasons?.[bId];
          if (reason === 'Stopped by user') {
            if (next[bId]) {
              delete next[bId];
              changed = true;
            }
          }
        }
      });

      if (activeServerId) {
        if (botState === 'SPAWNED' || botState === 'LOGGED_IN') {
          if (!next[activeServerId]) {
            next[activeServerId] = Date.now();
            changed = true;
          }
        } else if (botState === 'DISCONNECTED' || botState === 'ERROR' || botState === 'KICKED') {
          if (botStateReason === 'Stopped by user') {
            if (next[activeServerId]) {
              delete next[activeServerId];
              changed = true;
            }
          }
        }
      }

      if (changed && typeof window !== 'undefined') {
        const u = currentUser || 'guest';
        localStorage.setItem(`pocketafk_sessions_${u}`, JSON.stringify(next));
      }

      return changed ? next : prev;
    });
  }, [botStates, botState, botStateReason, botStateReasons, activeServerId, currentUser, socketStatus]);

  // Calibrate local session start times using authoritative daemon telemetry uptime or connectedAt
  useEffect(() => {
    const teleList = telemetries ? Object.values(telemetries) : [];
    if (telemetry && !teleList.some((t) => t?.botId === telemetry.botId)) {
      teleList.push(telemetry);
    }
    if (teleList.length === 0) return;

    setSessionStartTimes((prev) => {
      const next = { ...prev };
      let changed = false;
      const now = Date.now();

      teleList.forEach((t) => {
        if (t && t.botId) {
          let daemonStart: number | null = null;
          if (typeof t.connectedAt === 'number' && t.connectedAt > 0) {
            daemonStart = t.connectedAt;
          } else if (typeof t.uptime === 'number' && t.uptime > 0) {
            daemonStart = now - t.uptime * 1000;
          }

          if (daemonStart) {
            const currentStart = next[t.botId];
            // If no recorded start, or daemon started earlier than recorded, or more than 3 seconds off
            if (!currentStart || daemonStart < currentStart || Math.abs(currentStart - daemonStart) > 3000) {
              next[t.botId] = daemonStart;
              changed = true;
            }
          }
        }
      });

      // Clean up any legacy non-server keys (e.g. username/account IDs from earlier versions)
      const validServerIds = new Set(servers.map((s) => s.id));
      for (const k of Object.keys(next)) {
        if (!validServerIds.has(k)) {
          delete next[k];
          changed = true;
        }
      }

      if (changed && typeof window !== 'undefined') {
        const u = currentUser || 'guest';
        localStorage.setItem(`pocketafk_sessions_${u}`, JSON.stringify(next));
      }

      return changed ? next : prev;
    });
  }, [telemetry, telemetries, currentUser]);

  // Real-time automatic audit logging on bot state transitions
  const prevBotStateRef = useRef<Record<string, string>>({});
  useEffect(() => {
    Object.entries(botStates).forEach(([bId, st]) => {
      const prevSt = prevBotStateRef.current[bId];
      if (prevSt === st) return;
      prevBotStateRef.current[bId] = st;

      const [serverId, accountId] = bId.includes('__') ? bId.split('__') : [bId, undefined];
      const srv = servers.find((s) => s.id === serverId) || (activeServer?.id === serverId ? activeServer : null);
      if (!srv) return;
      const acc = (accountId ? accounts.find((a) => a.id === accountId || a.ign === accountId) : null) || resolveServerAccount(srv);
      const cleanName = acc?.ign || acc?.username || srv.name;
      if (!cleanName) return;

      const reason = botStateReasons?.[bId] || (bId === activeServerId ? botStateReason : '') || '';

      if (st === 'CONNECTING') {
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'connecting',
          `Initiating TCP connection to ${srv.serverHost}:${srv.serverPort}...`,
          `Join delay: ${srv.settings?.joinDelay || 0}s`,
          'info'
        );
      } else if (st === 'LOGGED_IN') {
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'handshake',
          `Server accepted connection. Session authenticated with Mojang.`,
          undefined,
          'success'
        );
      } else if (st === 'SPAWNED') {
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'spawned',
          `Spawned into world successfully on ${srv.serverHost}. AFK engine active.`,
          undefined,
          'success'
        );
      } else if (st === 'KICKED') {
        const kickMsg = reason || 'Kicked by remote host';
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'kicked',
          `Kicked from server: ${kickMsg}`,
          undefined,
          'error'
        );
      } else if (st === 'ERROR') {
        const errorMsg = reason || 'Socket connection error';
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'error',
          `Connection error: ${errorMsg}`,
          undefined,
          'error'
        );
      } else if (st === 'DISCONNECTED') {
        const discMsg = reason || 'Connection closed by remote server';
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'disconnected',
          `Disconnected from server: ${discMsg}`,
          undefined,
          'warning'
        );
      } else if (st === 'RECONNECTING') {
        addPlayerLog(
          cleanName,
          srv.serverHost,
          'reconnecting',
          `Attempting automatic reconnection${reason ? ` (${reason})` : ''}...`,
          undefined,
          'warning'
        );
      }
    });
  }, [botStates, botStateReasons, botStateReason, servers, activeServer, resolveServerAccount, activeAccount, addPlayerLog, accounts]);

  // Real-time automatic audit logging on incoming messages / server disconnects / kicks
  const lastLoggedMsgIdRef = useRef<string>('');
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === lastLoggedMsgIdRef.current) return;
    lastLoggedMsgIdRef.current = latest.id;

    const rawBotId = latest.botId || '';
    const [serverId, accountId] = rawBotId.includes('__') ? rawBotId.split('__') : [rawBotId, undefined];
    const srv = (serverId ? servers.find((s) => s.id === serverId) : null) || activeServer;
    const acc = (accountId ? accounts.find((a) => a.id === accountId || a.ign === accountId) : null) || (srv ? resolveServerAccount(srv) : activeAccount);
    const cleanName = latest.accountUsername || acc?.ign || acc?.username;
    if (!cleanName || !srv) return;

    if (latest.type === 'session_divider') {
      addPlayerLog(cleanName, srv.serverHost, 'connecting', latest.raw, undefined, 'info');
    } else if (latest.raw.includes('multiplayer.disconnect.duplicate_login')) {
      addPlayerLog(
        cleanName,
        srv.serverHost,
        'kicked',
        'Kicked from server: duplicate_login (Another instance or session logged in)',
        latest.raw,
        'error'
      );
    } else if (latest.raw.toLowerCase().includes('kicked from server') || latest.raw.toLowerCase().includes('kicked:')) {
      addPlayerLog(cleanName, srv.serverHost, 'kicked', latest.raw, undefined, 'error');
    } else if (latest.type === 'error' || latest.raw.toLowerCase().includes('connection closed') || latest.raw.toLowerCase().includes('error]')) {
      addPlayerLog(cleanName, srv.serverHost, 'error', latest.raw, undefined, 'error');
    } else if (latest.raw.toLowerCase().includes('verified java account')) {
      addPlayerLog(cleanName, srv.serverHost, 'handshake', latest.raw, undefined, 'success');
    }
  }, [messages, servers, activeServer, activeAccount, accounts, resolveServerAccount, addPlayerLog]);

  // Dismiss Connecting toast once active bot or any bot connects
  useEffect(() => {
    const isAnyConnected =
      botState === 'SPAWNED' ||
      botState === 'LOGGED_IN' ||
      Object.values(botStates).some((st) => st === 'SPAWNED' || st === 'LOGGED_IN');

    if (isAnyConnected) {
      setToast((prev) => {
        if (prev && prev.message.includes('Connecting to')) {
          return null;
        }
        return prev;
      });
    }
  }, [botState, botStates]);

  const effectiveUser = currentUser || 'default';
  const termuxCommand = secretCode
    ? `curl -sL https://pocketafk.vercel.app/install | bash -s -- ${effectiveUser} ${secretCode}`
    : `curl -sL https://pocketafk.vercel.app/install | bash -s -- ${effectiveUser}`;

  // Auto-sync tunnel from API or URL
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    async function syncTunnel() {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const queryTunnel = urlParams.get('tunnel');
      const queryUser = urlParams.get('user');

      if (queryTunnel && queryTunnel.startsWith('wss://')) {
        // Prevent cross-user linking if the instant link is tagged for a different user
        if (queryUser && currentUser && queryUser.trim().toLowerCase() !== currentUser.trim().toLowerCase()) {
          console.warn(`[PocketAFK] Ignoring tunnel param for @${queryUser} because logged in as @${currentUser}`);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        const effectiveToken = (secretCode || authToken || '').trim();
        saveSettings(queryTunnel, effectiveToken);
        setAutoSynced(true);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (!currentUser) return;

      try {
        const res = await fetch(`/api/tunnel?username=${encodeURIComponent(currentUser)}`, { cache: 'no-store' });
        if (res.status === 404 && isMounted) {
          const errData = await res.json().catch(() => ({}));
          if (errData?.userNotFound) {
            console.warn(`[PocketAFK] User @${currentUser} no longer exists in Supabase (deleted). Purging and signing out.`);
            handleLogout();
            return;
          }
        }
        if (res.ok && isMounted) {
          const data = await res.json();
          const asTimestamp = (value: unknown): number | null => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
              const parsed = Date.parse(value);
              return Number.isFinite(parsed) ? parsed : null;
            }
            return null;
          };
          setDaemonStatusHistory({
            daemonStartedAt: asTimestamp(data?.daemonStartedAt),
            lastDisconnectedAt: asTimestamp(data?.lastDisconnectedAt),
            statusStorageAvailable: Boolean(data?.statusStorageAvailable),
          });
          const targetUrl = (data?.url || data?.tunnel_url || '').trim();
          const targetToken = (data?.token || secretCode || authToken || '').trim();
          if (targetUrl && targetUrl.startsWith('wss://')) {
            if (targetUrl !== daemonUrl || (targetToken && targetToken !== authToken)) {
              console.log(`[PocketAFK] Auto-syncing discovered daemon tunnel for @${currentUser}:`, targetUrl);
              saveSettings(targetUrl, targetToken);
              setAutoSynced(true);
            } else if (socketStatus === 'DISCONNECTED') {
              reconnectDaemon();
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }

    syncTunnel();

    // Fast dynamic polling: poll every 2s when connecting/disconnected so 1-click Termux links immediately, and every 6s when authenticated so phone restarts are picked up smoothly
    if (currentUser) {
      const pollMs = socketStatus === 'AUTHENTICATED' ? 6000 : 2000;
      pollInterval = setInterval(syncTunnel, pollMs);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentUser, authToken, secretCode, daemonUrl, socketStatus, saveSettings, reconnectDaemon]);

  // Whenever user opens the Termux Daemon Bridge modal, fetch fresh tunnel from API immediately
  useEffect(() => {
    if (isSettingsOpen && currentUser) {
      fetch(`/api/tunnel?username=${encodeURIComponent(currentUser)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          const targetUrl = (data?.url || data?.tunnel_url || '').trim();
          const targetToken = (data?.token || secretCode || authToken || '').trim();
          if (targetUrl && targetUrl.startsWith('wss://') && targetUrl !== daemonUrl) {
            saveSettings(targetUrl, targetToken);
          }
        })
        .catch(() => {});
    }
  }, [isSettingsOpen, currentUser, secretCode, authToken, daemonUrl, saveSettings]);

  // Sync any pending cached Microsoft account tokens to Termux daemon as soon as daemon connects
  useEffect(() => {
    if (socketStatus === 'AUTHENTICATED' && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('pocketafk_token_cache_')) {
            const ign = key.replace('pocketafk_token_cache_', '');
            const raw = localStorage.getItem(key);
            if (raw) {
              const tokenCache = JSON.parse(raw);
              importAccountTokens(ign, tokenCache);
            }
          }
        }
      } catch (e) {}
    }
  }, [socketStatus, importAccountTokens]);

  // Load Notes & Pinned state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedNotes = localStorage.getItem(`pocketafk_notes_${currentUser || 'guest'}`);
      if (storedNotes) setAccountNotes(JSON.parse(storedNotes));
      const storedPinned = localStorage.getItem(`pocketafk_pinned_${currentUser || 'guest'}`);
      if (storedPinned) setPinnedAccountIds(JSON.parse(storedPinned));
      const storedServerPinned = localStorage.getItem(`pocketafk_pinned_servers_${currentUser || 'guest'}`);
      if (storedServerPinned) setPinnedServerIds(JSON.parse(storedServerPinned));
      const storedServerConnections = localStorage.getItem(`pocketafk_server_connections_${currentUser || 'guest'}`);
      if (storedServerConnections) setServerConnections(JSON.parse(storedServerConnections));
    } catch (e) {
      // ignore
    }
  }, [currentUser]);

  const notesDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync notes across devices when user focuses window
  useEffect(() => {
    if (!currentUser) return;
    const handleFocus = () => {
      loadNotesFromSupabase(currentUser)
        .then((remoteNotes) => {
          if (remoteNotes && typeof remoteNotes === 'object') {
            setAccountNotes((prev) => ({ ...prev, ...remoteNotes }));
            localStorage.setItem(`pocketafk_notes_${currentUser}`, JSON.stringify(remoteNotes));
          }
        })
        .catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser]);

  // Save notes universally to Supabase and cache locally
  const handleUpdateNote = (accId: string, noteText: string, ign?: string) => {
    const updated: Record<string, string> = { ...accountNotes, [accId]: noteText };
    if (ign) {
      updated[ign.toLowerCase()] = noteText;
    }
    setAccountNotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketafk_notes_${currentUser || 'guest'}`, JSON.stringify(updated));
    }

    if (currentUser) {
      if (notesDebounceRef.current) {
        clearTimeout(notesDebounceRef.current);
      }
      notesDebounceRef.current = setTimeout(() => {
        saveNotesToSupabase(currentUser, updated);
      }, 400);
    }
  };

  // Toggle account pin
  const handleTogglePin = (accId: string) => {
    const isPinned = pinnedAccountIds.includes(accId);
    const updated = isPinned ? pinnedAccountIds.filter((id) => id !== accId) : [...pinnedAccountIds, accId];
    setPinnedAccountIds(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketafk_pinned_${currentUser || 'guest'}`, JSON.stringify(updated));
    }
  };

  // Toggle server pin
  const handleToggleServerPin = (srvId: string) => {
    const isPinned = pinnedServerIds.includes(srvId);
    const updated = isPinned ? pinnedServerIds.filter((id) => id !== srvId) : [...pinnedServerIds, srvId];
    setPinnedServerIds(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketafk_pinned_servers_${currentUser || 'guest'}`, JSON.stringify(updated));
    }
  };

  // Format server date
  const formatServerDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    try {
      const d = new Date(timestamp);
      return (
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    } catch {
      return 'Recent';
    }
  };

  // Sync and fetch authoritative user rank from server / Supabase
  useEffect(() => {
    if (!currentUser) return;
    const cachedRank = localStorage.getItem(`pocketafk_rank_${currentUser}`);
    if (currentUser.toLowerCase() === 'chief' && (!cachedRank || cachedRank === 'iron')) {
      setUserRank('diamond');
      localStorage.setItem(`pocketafk_rank_${currentUser}`, 'diamond');
    } else if (cachedRank && RANKS[cachedRank as UserRank]) {
      setUserRank(cachedRank as UserRank);
    }
    fetch(`/api/rank?username=${encodeURIComponent(currentUser)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rank && RANKS[data.rank as UserRank]) {
          setUserRank(data.rank as UserRank);
          localStorage.setItem(`pocketafk_rank_${currentUser}`, data.rank);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  const handleSelectRank = async (newRank: UserRank) => {
    setUserRank(newRank);
    if (currentUser) {
      localStorage.setItem(`pocketafk_rank_${currentUser}`, newRank);
      try {
        await fetch('/api/rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, rank: newRank }),
        });
        showToast(`Upgraded to ${RANKS[newRank].name} Rank!`, 'success');
      } catch (e) {
        showToast('Rank saved locally.', 'info');
      }
    }
    setIsRankModalOpen(false);
  };

  // Load Accounts & Servers with Universal Supabase Sync
  useEffect(() => {
    if (!currentUser) {
      setAccounts([]);
      setServers([]);
      return;
    }

    async function loadData() {
      const accKey = `pocketafk_accounts_${currentUser}`;
      const srvKey = `pocketafk_servers_${currentUser}`;

      // 1. Instant local render from device cache
      let localAccs: MinecraftAccount[] = [];
      let localSrvs: ServerProfile[] = [];

      try {
        const storedAcc = localStorage.getItem(accKey);
        if (storedAcc) localAccs = sanitizeAccounts(JSON.parse(storedAcc));
        const storedSrv = localStorage.getItem(srvKey);
        if (storedSrv) localSrvs = JSON.parse(storedSrv);
      } catch (e) {}

      if (localAccs.length > 0) setAccounts(localAccs);
      if (localSrvs.length > 0) {
        setServers(localSrvs);
        setActiveServerId(localSrvs[0].id);
      }

      // 2. Fetch authoritative universal state from Supabase
      if (supabase && currentUser) {
        try {
          // Check if the user still exists in Supabase users table!
          // If the account was deleted in the admin page, userRow will be null.
          const { data: userRow } = await supabase
            .from('users')
            .select('id, username')
            .ilike('username', currentUser)
            .maybeSingle();

          if (!userRow) {
            console.warn(`[PocketAFK] User @${currentUser} does not exist in Supabase (deleted). Purging and signing out.`);
            handleLogout();
            return;
          }

          const [remoteServers, remoteAccounts, remoteNotes, remoteWebhooks] = await Promise.all([
            loadServersFromSupabase(currentUser),
            loadAccountsFromSupabase(currentUser, localAccs),
            loadNotesFromSupabase(currentUser),
            loadWebhookConfigFromSupabase(currentUser),
          ]);

          // Handle Universal Servers:
          let finalServers: ServerProfile[] = [];
          if (remoteServers !== null && Array.isArray(remoteServers)) {
            // Supabase is the central universal source of truth!
            finalServers = remoteServers;
          } else {
            // New accounts start with clean slate (0 server profiles)
            finalServers = [];
          }

          // Ensure each server profile loads its server-specific quick commands
          for (let i = 0; i < finalServers.length; i++) {
            const s = finalServers[i];
            if (!s.quickCommands || s.quickCommands.length === 0) {
              const savedCmds = await loadQuickCommandsFromSupabase(currentUser, s.id);
              if (savedCmds && savedCmds.length > 0) {
                finalServers[i] = { ...s, quickCommands: savedCmds };
              } else {
                finalServers[i] = { ...s, quickCommands: DEFAULT_QUICK_COMMANDS };
              }
            }
          }

          setServers(finalServers);
          localStorage.setItem(srvKey, JSON.stringify(finalServers));
          if (finalServers.length > 0) {
            setActiveServerId((prev) => (finalServers.some((s) => s.id === prev) ? prev : finalServers[0].id));
          } else {
            setActiveServerId('');
          }

          // Handle Universal Accounts:
          if (remoteAccounts !== null && Array.isArray(remoteAccounts)) {
            // Authoritative accounts from Supabase!
            const sanitized = sanitizeAccounts(remoteAccounts);
            if (remoteAccounts.some((a) => a.id === 'new_account' || (a.ign || a.username || '').toLowerCase() === 'new_account')) {
              deleteAccountFromSupabase(currentUser, 'new_account').catch(() => {});
            }
            setAccounts(sanitized);
            localStorage.setItem(accKey, JSON.stringify(sanitized));
            // Persist stable client account IDs so profiles stay assigned across devices.
            syncAllToSupabase(currentUser, sanitized, finalServers).catch(() => {});
          } else {
            setAccounts([]);
            localStorage.setItem(accKey, JSON.stringify([]));
          }

          // Handle Universal Notes:
          const notesKey = `pocketafk_notes_${currentUser}`;
          let localNotes: Record<string, string> = {};
          try {
            const rawStored = localStorage.getItem(notesKey);
            if (rawStored) localNotes = JSON.parse(rawStored);
          } catch {}

          if (remoteNotes && typeof remoteNotes === 'object') {
            setAccountNotes(remoteNotes);
            localStorage.setItem(notesKey, JSON.stringify(remoteNotes));
          } else if (Object.keys(localNotes).length > 0) {
            // Migrate existing local notes to Supabase for this user
            await saveNotesToSupabase(currentUser, localNotes);
            setAccountNotes(localNotes);
          }

          // Handle Universal Discord Webhooks:
          if (remoteWebhooks) {
            setWebhookConfig(remoteWebhooks);
            localStorage.setItem(`pocketafk_webhooks_${currentUser}`, JSON.stringify(remoteWebhooks));
          }
        } catch (err) {
          console.warn('Failed to load universal data from Supabase:', err);
        }
      }
    }

    loadData();
  }, [currentUser, handleLogout]);

  // A daemon connection already broadcasts bot, chat, inventory, and telemetry events
  // to every authenticated browser socket. Refresh shared profile/account configuration
  // from Supabase too, because server assignments and settings are not daemon state.
  useEffect(() => {
    if (!currentUser || !supabase) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshSharedConfiguration = async () => {
      if (cancelled) return;
      try {
        let preferredAccounts: MinecraftAccount[] = [];
        try {
          const saved = localStorage.getItem(`pocketafk_accounts_${currentUser}`);
          if (saved) preferredAccounts = sanitizeAccounts(JSON.parse(saved));
        } catch {}

        const [remoteServers, remoteAccounts] = await Promise.all([
          loadServersFromSupabase(currentUser),
          loadAccountsFromSupabase(currentUser, preferredAccounts),
        ]);
        if (cancelled) return;

        if (remoteServers) {
          const key = `pocketafk_servers_${currentUser}`;
          const serialized = JSON.stringify(remoteServers);
          if (localStorage.getItem(key) !== serialized) {
            localStorage.setItem(key, serialized);
            setServers(remoteServers);
            if (remoteServers.length) {
              setActiveServerId((previous) => remoteServers.some((server) => server.id === previous) ? previous : remoteServers[0].id);
            } else {
              setActiveServerId('');
            }
          }
        }

        if (remoteAccounts) {
          const synchronized = sanitizeAccounts(remoteAccounts);
          const key = `pocketafk_accounts_${currentUser}`;
          const serialized = JSON.stringify(synchronized);
          if (localStorage.getItem(key) !== serialized) {
            localStorage.setItem(key, serialized);
            setAccounts(synchronized);
          }
        }
      } catch (error) {
        console.warn('Could not refresh shared PocketAFK configuration:', error);
      } finally {
        if (!cancelled) refreshTimer = setTimeout(refreshSharedConfiguration, 2500);
      }
    };

    refreshTimer = setTimeout(refreshSharedConfiguration, 2500);
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [currentUser]);

  // Microsoft OAuth Device Code Sign-In with Target Identity Verification Guard
  const handleStartMicrosoftLogin = async (target?: MinecraftAccount | string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    if (accounts.filter((a) => a.verified).length >= currentRankConfig.maxAccounts && !target) {
      showToast(
        `Your ${currentRankConfig.name} rank limit of ${currentRankConfig.maxAccounts} ${
          currentRankConfig.maxAccounts === 1 ? 'account' : 'accounts'
        } has been reached. Upgrade your rank to add more!`,
        'error'
      );
      setIsRankModalOpen(true);
      return;
    }

    setIsAccountsOpen(false);
    setMsAuthError(null);

    // If Termux daemon is online and authenticated, use daemon-native verification!
    // This stores tokens directly on the phone so the user NEVER has to log in twice!
    if (socketStatus === 'AUTHENTICATED') {
      const targetId = typeof target === 'object' && target ? target.id : `acc_${Math.random().toString(36).substring(2, 9)}`;
      const rawTargetEmail =
        typeof target === 'string'
          ? target
          : (target?.expectedIgn || target?.ign || (!target?.username?.includes('@') ? target?.username : null) || '');
      const targetEmail = rawTargetEmail.toLowerCase() === 'new_account' ? '' : rawTargetEmail;

      showToast('Requesting Microsoft sign-in via Termux daemon...', 'info');
      setIsPollingMs(true);
      verifyAccount(targetId, targetEmail);
      return;
    }

    setIsPollingMs(true);

    try {
      showToast('Requesting Microsoft sign-in code...', 'info');
      const res = await fetch('/api/minecraft-auth');
      const data = await res.json();

      if (!res.ok || !data.success || !data.deviceCode) {
        throw new Error(data.error || 'Failed to initiate Microsoft login');
      }

      const fallbackTargetId = typeof target === 'object' && target ? target.id : `acc_${Math.random().toString(36).substring(2, 9)}`;
      setApiMsAuthData({
        botId: fallbackTargetId,
        userCode: data.userCode,
        url: data.verificationUri,
        deviceCode: data.deviceCode,
      });

      setToast((prev) => (prev && prev.message.includes('Requesting Microsoft sign-in code') ? null : prev));

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

            if (pollData.tokenCache) {
              try {
                localStorage.setItem(`pocketafk_token_cache_${finalIgn.toLowerCase()}`, JSON.stringify(pollData.tokenCache));
                importAccountTokens(finalIgn, pollData.tokenCache);
              } catch (e) {}
            }

            // Check if user targeted a specific account or expected IGN
            const rawExpectedName =
              typeof target === 'string'
                ? target
                : (target?.expectedIgn || target?.ign || (!target?.username?.includes('@') ? target?.username : null));
            const expectedName = rawExpectedName && rawExpectedName.toLowerCase() !== 'new_account' ? rawExpectedName : undefined;

            // ACCOUNT MISMATCH GUARD: Check if authenticated user matches expected target
            if (expectedName && expectedName.toLowerCase() !== finalIgn.toLowerCase()) {
              const mismatchMsg = `Verification failed: Logged into Microsoft account '${finalIgn}', but expected '${expectedName}'. The account name didn't match.`;
              setMsAuthError(mismatchMsg);
              showToast(mismatchMsg, 'error');

              // If updating an existing account, record the error on it instead of overwriting
              setAccounts((prev) => {
                const updated = prev.map((a) => {
                  if (typeof target === 'object' && target && a.id === target.id) {
                    return {
                      ...a,
                      verified: false,
                      authError: `Verification failed: Authenticated as '${finalIgn}', expected '${expectedName}'. Please log into the correct Microsoft account.`,
                    };
                  }
                  return a;
                });
                const accKey = `pocketafk_accounts_${currentUser}`;
                localStorage.setItem(accKey, JSON.stringify(updated));
                return updated;
              });
              return;
            }

            // DUPLICATE GUARD: Prevent linking an already-linked account
            const isDuplicate = accounts.some(
              (a) =>
                (typeof target === 'object' && target ? a.id !== target.id : true) &&
                ((a.ign && a.ign.toLowerCase() === finalIgn.toLowerCase()) ||
                 (a.uuid && finalUuid && a.uuid === finalUuid))
            );

            if (isDuplicate) {
              const dupMsg = `Account '@${finalIgn}' is already linked to PocketAFK! Your browser is still logged into this account. Click 'Sign Out of Microsoft' in the sign-in modal or use an Incognito tab to link a different account.`;
              setMsAuthError(dupMsg);
              showToast(dupMsg, 'error');
              return;
            }

            // Successfully verified!
            setAccounts((prev) => {
              let updated: MinecraftAccount[];
              if (typeof target === 'object' && target) {
                // Update target account
                updated = prev.map((a) => {
                  if (a.id === target.id) {
                    return {
                      ...a,
                      username: finalIgn,
                      ign: finalIgn,
                      uuid: finalUuid,
                      verified: true,
                      authError: undefined,
                    };
                  }
                  return a;
                });
              } else {
                // Add new account
                const filtered = prev.filter((a) => (a.ign || a.username).toLowerCase() !== finalIgn.toLowerCase());
                const newAccount: MinecraftAccount = {
                  id: `acc_${Math.random().toString(36).substring(2, 9)}`,
                  username: finalIgn,
                  ign: finalIgn,
                  uuid: finalUuid,
                  auth_type: 'microsoft',
                  verified: true,
                  addedAt: Date.now(),
                  expectedIgn: expectedName || undefined,
                };
                updated = [...filtered, newAccount];
              }

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
    const srvKey = `pocketafk_servers_${currentUser}`;

    // 1. Terminate and disconnect any running bot in-game for this account
    if (target) {
      stopBot(target.id);
      if (target.ign) stopBot(target.ign);
      if (target.username) stopBot(target.username);
    }
    // Also stop all servers where this account was assigned
    servers.forEach((srv) => {
      const isAssigned =
        srv.accountId === id ||
        srv.accountId === target?.ign ||
        srv.accountId === target?.username ||
        (Array.isArray(srv.assignedAccountIds) &&
          srv.assignedAccountIds.some(
            (accId) => accId === id || accId === target?.ign || accId === target?.username
          ));
      if (isAssigned) {
        stopBot(`${srv.id}__${id}`);
        stopBot(srv.id);
      }
    });

    const updatedAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(updatedAccounts);
    localStorage.setItem(accKey, JSON.stringify(updatedAccounts));

    // Remove from selectedAccountIds
    setSelectedAccountIds((prev) => prev.filter((accId) => accId !== id));

    // Remove deleted account from all server profiles immediately
    const targetNames = [id, target?.ign, target?.username, target?.expectedIgn].filter(Boolean);
    const updatedServers = servers.map((srv) => {
      const cleanAssigned = (srv.assignedAccountIds || []).filter(
        (accId) => !targetNames.some((n) => n?.toLowerCase() === accId?.toLowerCase())
      );
      const isAccountMatch = targetNames.some((n) => n?.toLowerCase() === srv.accountId?.toLowerCase());
      const newAccountId = isAccountMatch ? cleanAssigned[0] || '' : srv.accountId;
      return {
        ...srv,
        assignedAccountIds: cleanAssigned,
        accountId: newAccountId,
      };
    });
    setServers(updatedServers);
    localStorage.setItem(srvKey, JSON.stringify(updatedServers));

    // Delete from Supabase and sync cleanly so it never resurrects
    if (target) {
      if (target.ign) await deleteAccountFromSupabase(currentUser, target.ign);
      if (target.username && target.username !== target.ign) {
        await deleteAccountFromSupabase(currentUser, target.username);
      }
    }
    await syncAllToSupabase(currentUser, updatedAccounts, updatedServers);

    showToast('Minecraft account unlinked and removed from server profiles.', 'info');
  };

  // Server Profile Management
  const handleSaveServer = async (profile: ServerProfile) => {
    if (!currentUser) return;
    const srvKey = `pocketafk_servers_${currentUser}`;
    profile.pocketUser = currentUser;

    if (!profile.createdAt) {
      profile.createdAt = Date.now();
    }

    const matched = resolveServerAccount(profile);
    if (matched) {
      profile.accountId = matched.id;
    }

    const existingIndex = servers.findIndex((s) => s.id === profile.id);

    if (existingIndex < 0 && servers.length >= currentRankConfig.maxServers) {
      showToast(
        `Your ${currentRankConfig.name} rank allows up to ${currentRankConfig.maxServers} ${
          currentRankConfig.maxServers === 1 ? 'server profile' : 'server profiles'
        }. Upgrade your rank to add more servers!`,
        'error'
      );
      setIsRankModalOpen(true);
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

    saveServersToSupabase(currentUser, updated).catch(() => {});
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
    saveServersToSupabase(currentUser, updated).catch(() => {});
    showToast('Server profile removed.', 'info');
  };

  const handleUpdateServerSetting = (key: keyof BotSettings, value: any, silent = false) => {
    if (!activeServer || !currentUser) return;
    const currentSettings = activeServer.settings || DEFAULT_BOT_SETTINGS;
    const updatedSettings = { ...currentSettings, [key]: value };
    const updatedServer: ServerProfile = {
      ...activeServer,
      settings: updatedSettings,
      ...(key === 'autoReconnect' ? { autoReconnect: value } : {}),
    };
    const srvKey = `pocketafk_servers_${currentUser}`;
    const existingIndex = servers.findIndex((s) => s.id === updatedServer.id);
    let updated: ServerProfile[];
    if (existingIndex >= 0) {
      updated = [...servers];
      updated[existingIndex] = updatedServer;
    } else {
      updated = [...servers, updatedServer];
    }
    setServers(updated);
    localStorage.setItem(srvKey, JSON.stringify(updated));
    saveServersToSupabase(currentUser, updated).catch(() => {});
    syncAllToSupabase(currentUser, accounts, updated).catch(() => {});
    updateSettings(activeServer.id, { [key]: value } as any);
    if (!silent) {
      showToast(`Saved settings for "${activeServer.name}"`, 'success');
    }
  };

  const handleToggleServerSetting = (key: keyof BotSettings, value: boolean) => {
    handleUpdateServerSetting(key, value, true);
  };

  const handleSaveQuickCommands = (newCommands: QuickCommandItem[]) => {
    if (!activeServer || !currentUser) return;
    const updatedServer: ServerProfile = {
      ...activeServer,
      quickCommands: newCommands,
    };
    handleSaveServer(updatedServer);
    saveQuickCommandsToSupabase(currentUser, activeServer.id, newCommands).catch(() => {});
    showToast(`Quick commands updated for "${activeServer.name}"!`, 'success');
  };

  // Bot Lifecycle Controls
  const handleStartServer = (profile: ServerProfile, targetAcc?: MinecraftAccount | null) => {
    if (!currentUser) return;
    if (socketStatus !== 'AUTHENTICATED') {
      showToast('Cannot connect: Termux daemon is offline or not authenticated. Start Termux daemon first.', 'error');
      return;
    }
    const assignedAcc = targetAcc || resolveServerAccount(profile);
    const cleanPlayerName = (assignedAcc?.ign || assignedAcc?.username || profile.name).replace(/^@/, '').trim();
    const now = Date.now();

    const botKey = assignedAcc ? `${profile.id}__${assignedAcc.id}` : profile.id;

    // Optimistically record start time locally for this bot and profile
    setSessionStartTimes((prev) => {
      const updated = {
        ...prev,
        [botKey]: now,
        [profile.id]: now,
      };
      if (typeof window !== 'undefined') {
        const u = currentUser || 'guest';
        localStorage.setItem(`pocketafk_sessions_${u}`, JSON.stringify(updated));
      }
      return updated;
    });

    // Record in Supabase for persistence across devices/refreshes
    if (currentUser && cleanPlayerName) {
      recordAccountConnectionStart(currentUser, cleanPlayerName, profile.serverHost, now, botKey, daemonUrl).catch(() => {});
    }

    // Track connections count
    setServerConnections((prev) => {
      const cur = prev[profile.id] || profile.connectionsCount || 0;
      const updated = { ...prev, [profile.id]: cur + 1 };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`pocketafk_server_connections_${currentUser || 'guest'}`, JSON.stringify(updated));
      }
      return updated;
    });

    startBot({
      id: botKey,
      serverId: profile.id,
      username: cleanPlayerName,
      accountId: assignedAcc?.id,
      authType: 'microsoft',
      host: profile.serverHost,
      port: profile.serverPort,
      version: profile.serverVersion === 'auto' ? false : profile.serverVersion,
      settings: profile.settings || DEFAULT_BOT_SETTINGS,
    });
    addPlayerLog(
      cleanPlayerName,
      profile.serverHost,
      'connecting',
      `Manual connection initiated: @${cleanPlayerName} -> ${profile.serverHost}:${profile.serverPort}`,
      `Protocol: ${profile.serverVersion || 'auto'}`,
      'info'
    );
    showToast(`Connecting to ${profile.serverHost} as @${cleanPlayerName}...`, 'info');
  };

  const handleStopServer = (profileId: string, targetAcc?: MinecraftAccount | null) => {
    const srv = servers.find((s) => s.id === profileId) || activeServer;
    const acc = targetAcc || (srv ? resolveServerAccount(srv) : activeAccount);
    const cleanPlayerName = (acc?.ign || acc?.username || '').replace(/^@/, '').trim();
    const botKey = acc ? `${profileId}__${acc.id}` : profileId;

    if (cleanPlayerName && srv) {
      addPlayerLog(
        cleanPlayerName,
        srv.serverHost,
        'disconnected',
        `Bot session terminated by user.`,
        undefined,
        'warning'
      );
    }

    // Remove from local sessionStartTimes for this bot and profile
    setSessionStartTimes((prev) => {
      const next = { ...prev };
      delete next[botKey];
      // Only delete base profileId start time if no other sub-bots are running under this profile
      const otherSubBotsRunning = Object.keys(next).some((k) => k !== botKey && k.startsWith(`${profileId}__`));
      if (!otherSubBotsRunning) {
        delete next[profileId];
      }
      if (typeof window !== 'undefined') {
        const u = currentUser || 'guest';
        localStorage.setItem(`pocketafk_sessions_${u}`, JSON.stringify(next));
      }
      return next;
    });

    const isRunningElsewhere = servers.some(
      (s) =>
        s.id !== profileId &&
        (botStates[`${s.id}__${acc?.id}`] === 'SPAWNED' || botStates[s.id] === 'SPAWNED')
    );
    if (currentUser && cleanPlayerName && !isRunningElsewhere) {
      recordAccountConnectionStop(currentUser, cleanPlayerName).catch(() => {});
    }

    stopBot(botKey);
    showToast(`Bot connection stopped${cleanPlayerName ? ` (@${cleanPlayerName})` : ''}.`, 'info');
  };

  // Connect Selected / Disconnect Selected
  const handleConnectSelected = () => {
    if (!activeServer) return;
    const targets = accounts.filter((a) => selectedAccountIds.includes(a.id));
    const toConnect = targets.length > 0 ? targets : (activeAccount ? [activeAccount] : []);
    if (toConnect.length === 0) {
      showToast('Please select at least one account to connect.', 'error');
      return;
    }
    const currentAssigned = Array.isArray(activeServer.assignedAccountIds) ? activeServer.assignedAccountIds : [];
    const updatedAssigned = Array.from(new Set([...currentAssigned, ...toConnect.map((t) => t.id)]));
    const updatedProfile: ServerProfile = {
      ...activeServer,
      accountId: toConnect[0].id,
      assignedAccountIds: updatedAssigned,
    };
    handleSaveServer(updatedProfile);
    toConnect.forEach((target, index) => {
      setTimeout(() => {
        handleStartServer(updatedProfile, target);
      }, index * 400);
    });
    showToast(`Connecting ${toConnect.length} account${toConnect.length > 1 ? 's' : ''}...`, 'info');
  };

  const handleDisconnectSelected = () => {
    if (!activeServer) return;
    const targets = accounts.filter((a) => selectedAccountIds.includes(a.id));
    const toDisconnect = targets.length > 0 ? targets : (activeAccount ? [activeAccount] : []);
    toDisconnect.forEach((target) => {
      handleStopServer(activeServer.id, target);
    });
  };

  // Accounts assigned to current Server Profile (strictly filtered to existing accounts)
  const profileAccountIds = useMemo(() => {
    if (!activeServer) return [];
    const validAccountIds = new Set(accounts.map((a) => a.id));
    if (Array.isArray(activeServer.assignedAccountIds)) {
      return activeServer.assignedAccountIds.filter((id) => validAccountIds.has(id));
    }
    return activeServer.accountId && validAccountIds.has(activeServer.accountId)
      ? [activeServer.accountId]
      : [];
  }, [activeServer, accounts]);

  const assignedAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (!profileAccountIds.includes(a.id)) return false;
      const q = accountFilter.toLowerCase().trim();
      if (!q) return true;
      const ign = (a.ign || a.username).toLowerCase();
      const note = (accountNotes[a.id] || (a.ign ? accountNotes[a.ign.toLowerCase()] : '') || '').toLowerCase();
      return ign.includes(q) || note.includes(q);
    });
  }, [accounts, profileAccountIds, accountFilter, accountNotes]);

  const availableAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (profileAccountIds.includes(a.id)) return false;
      const q = accountFilter.toLowerCase().trim();
      if (!q) return true;
      const ign = (a.ign || a.username).toLowerCase();
      const note = (accountNotes[a.id] || (a.ign ? accountNotes[a.ign.toLowerCase()] : '') || '').toLowerCase();
      return ign.includes(q) || note.includes(q);
    });
  }, [accounts, profileAccountIds, accountFilter, accountNotes]);

  const handleRemoveAccountFromProfile = (accId: string) => {
    if (!activeServer) return;
    const targetAcc = accounts.find((a) => a.id === accId);
    stopBot(`${activeServer.id}__${accId}`);
    const updatedIds = profileAccountIds.filter((id) => id !== accId);
    const updatedServer: ServerProfile = {
      ...activeServer,
      assignedAccountIds: updatedIds,
      accountId: activeServer.accountId === accId ? (updatedIds[0] || '') : activeServer.accountId,
    };
    handleSaveServer(updatedServer);
    showToast(`Removed ${targetAcc?.ign || targetAcc?.username || 'account'} from ${activeServer.name}`, 'info');
  };

  const handleAddAccountToProfile = (accId: string) => {
    if (!activeServer) return;
    const targetAcc = accounts.find((a) => a.id === accId);
    const updatedIds = Array.from(new Set([...profileAccountIds, accId]));
    const updatedServer: ServerProfile = {
      ...activeServer,
      assignedAccountIds: updatedIds,
      accountId: activeServer.accountId || accId,
    };
    handleSaveServer(updatedServer);
    showToast(`Added ${targetAcc?.ign || targetAcc?.username || 'account'} to ${activeServer.name}`, 'success');
  };

  // Accounts for the active server profile (unfiltered by search term)
  const serverProfileAccounts = useMemo(() => {
    if (!activeServer) return [];
    return accounts.filter((a) => profileAccountIds.includes(a.id));
  }, [activeServer, accounts, profileAccountIds]);

  const availableChatSenders = useMemo(() => {
    return serverProfileAccounts.map((acc) => {
      const botKey = `${activeServer?.id}__${acc.id}`;
      const state = botStates[botKey] ?? (
        serverProfileAccounts.length === 1 && activeServer ? botStates[activeServer.id] : undefined
      );
      return {
        id: acc.id,
        name: acc.username,
        ign: acc.ign,
        isOnline: state === 'SPAWNED' || state === 'LOGGED_IN',
      };
    });
  }, [serverProfileAccounts, botStates, activeServer]);

  useEffect(() => {
    if (chatSenderAccountId !== 'all' && !serverProfileAccounts.some((account) => account.id === chatSenderAccountId)) {
      setChatSenderAccountId('all');
    }
  }, [chatSenderAccountId, serverProfileAccounts]);

  const filteredChatMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    if (!chatSenderAccountId || chatSenderAccountId === 'all') return messages;

    const selectedAccount = serverProfileAccounts.find(
      (account) => account.id === chatSenderAccountId || account.ign === chatSenderAccountId
    );
    if (!selectedAccount) return messages;

    const selectedNames = new Set(
      [selectedAccount.ign, selectedAccount.username]
        .filter((name): name is string => Boolean(name))
        .map((name) => name.toLowerCase())
    );
    const selectedId = selectedAccount.id.toLowerCase();

    return messages.filter((msg) => {
      const accountName = (msg.accountUsername || '').toLowerCase();
      if (accountName && selectedNames.has(accountName)) return true;

      const botId = (msg.botId || '').toLowerCase();
      return botId === selectedId || botId.endsWith(`__${selectedId}`);
    });
  }, [messages, chatSenderAccountId, serverProfileAccounts]);

  const selectedAccountActivityLogs = useMemo(() => {
    if (!selectedLogsAccount) return [];
    const accIgn = (selectedLogsAccount.ign || selectedLogsAccount.username || '').toLowerCase();
    const accId = selectedLogsAccount.id.toLowerCase();
    const matching = Object.entries(activityLogs || {})
      .filter(([bId]) => {
        const lower = bId.toLowerCase();
        if (selectedLogsServerContext) {
          const prefix = `${selectedLogsServerContext.id.toLowerCase()}__`;
          return lower.startsWith(prefix) && (lower.endsWith(`__${accId}`) || lower.includes(accIgn));
        }
        return (
          lower === accId ||
          lower === accIgn ||
          lower.endsWith(`__${accId}`) ||
          (activeServer && lower.startsWith(`${activeServer.id.toLowerCase()}__`) && lower.includes(accId))
        );
      })
      .flatMap(([, l]) => l);

    const includeCurrentLogs = !selectedLogsServerContext || activeServer?.id === selectedLogsServerContext.id;
    const combined = [...matching, ...(includeCurrentLogs ? currentActivityLogs || [] : [])];
    const unique = new Map<string, ActivityLog>();
    combined
      .filter((log) => !selectedLogsServerContext || log.botId.toLowerCase().startsWith(`${selectedLogsServerContext.id.toLowerCase()}__`))
      .forEach((l) => unique.set(l.id, l));
    return Array.from(unique.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedLogsAccount, selectedLogsServerContext, activityLogs, currentActivityLogs, activeServer]);

  const handleSendChatMessage = (msg: string, senderId?: string) => {
    if (!activeServer) return;
    if (!senderId || senderId === 'all') {
      sendChat(activeServer.id, msg, 'all');
    } else {
      const senderAcc = serverProfileAccounts.find((a) => a.id === senderId || a.ign === senderId);
      const targetName = senderAcc?.ign || senderAcc?.username || senderId;
      sendChat(activeServer.id, msg, targetName);
    }
  };

  const handleSelectAllToggle = () => {
    if (selectedAccountIds.length === assignedAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(assignedAccounts.map((a) => a.id));
    }
  };

  const handleAccountCheckbox = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleLoginSuccess = (user: string, secret?: string, isNewUser?: boolean) => {
    if (isNewUser) {
      purgeLocalUserData(user);
      setAccounts([]);
      setServers([]);
      setAccountNotes({});
      setActiveServerId('');
    }
    setCurrentUser(user);
    localStorage.setItem('pocketafk_user', user);
    if (secret) {
      setSecretCode(secret);
      localStorage.setItem(`pocketafk_secret_${user}`, secret);
    }
  };

  // Bot Status Badge (Clean Online / Offline toggle badge)
  const getStatusBadge = (state: BotLifecycleState) => {
    switch (state) {
      case 'SPAWNED':
      case 'LOGGED_IN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs group-hover:bg-emerald-200 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#3a3326] text-[#e7c985] border border-[#76633f] shadow-[inset_0_1px_0_#ffffff10] group-hover:bg-[#443b2b] transition">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-[#d5ad5e] opacity-40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#e5c16f]" /></span>
            {state === 'RECONNECTING' ? 'Retrying' : 'Connecting'}
          </span>
        );
      case 'KICKED':
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs group-hover:bg-rose-200 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {state === 'KICKED' ? 'Kicked' : 'Error'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300/80 shadow-2xs group-hover:bg-slate-200 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Offline
          </span>
        );
    }
  };

  const isActiveServerRunning =
    botState === 'SPAWNED' || botState === 'LOGGED_IN' || botState === 'CONNECTING';

  return (
    <div className={`${currentUser ? 'pa-dashboard-shell' : ''} min-h-screen bg-[#f1f5f9] bg-grid-slate text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20`}>
      {/* Toast Notification Container */}
      <ModernToast toast={toast} onDismiss={handleDismissToast} />

      {/* Microsoft In-App Device Auth Modal */}
      {((isPollingMs && msAuthData) || apiMsAuthData) && (
        <MicrosoftAuthModal
          authData={(isPollingMs && msAuthData) || apiMsAuthData}
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
        onOpenAddAccount={() => handleStartMicrosoftLogin()}
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
        termuxCommand={termuxCommand}
        onRestartDaemon={async () => {
          restartDaemon('Dashboard reset requested by user');
          setSessionStartTimes({});
          if (currentUser) {
            localStorage.removeItem(`pocketafk_sessions_${currentUser}`);
          }
          showToast('Restarting daemon: all Minecraft sessions & sockets reset.', 'info');
        }}
        isDaemonOnline={socketStatus === 'AUTHENTICATED'}
      />

      {/* Dangerous Settings Modal */}
      <DangerousSettingsModal
        isOpen={isDangerousSettingsOpen}
        onClose={() => setIsDangerousSettingsOpen(false)}
        server={activeServer}
        onToggleSetting={handleToggleServerSetting}
        onDeleteServer={handleDeleteServer}
      />

      {/* Auth / Login Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Rank Tiers & Capacity Modal */}
      <RankModal
        isOpen={isRankModalOpen}
        onClose={() => setIsRankModalOpen(false)}
        currentRank={userRank}
        onSelectRank={handleSelectRank}
        currentAccountCount={accounts.length}
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

      {/* Quick Commands Modal */}
      {activeServer && (
        <QuickCommandsModal
          isOpen={isQuickCommandsModalOpen}
          onClose={() => setIsQuickCommandsModalOpen(false)}
          serverName={activeServer.name}
          initialCommands={activeServer.quickCommands || DEFAULT_QUICK_COMMANDS}
          onSave={handleSaveQuickCommands}
        />
      )}

      {/* Player Connection & Audit Logs Modal */}
      <AccountLogsModal
        isOpen={isAccountLogsOpen}
        onClose={() => {
          setIsAccountLogsOpen(false);
          setSelectedLogsAccount(null);
          setSelectedLogsServerContext(null);
        }}
        account={selectedLogsAccount}
        serverHost={selectedLogsServerContext?.host || activeServer?.serverHost}
        logs={
          selectedLogsAccount
            ? (accountLogsMap[(selectedLogsAccount.ign || selectedLogsAccount.expectedIgn || selectedLogsAccount.username || '').replace(/^@/, '').trim()] || [])
                .filter((entry) => !selectedLogsServerContext || entry.serverHost.trim().toLowerCase() === selectedLogsServerContext.host.trim().toLowerCase())
            : []
        }
        activityLogs={selectedAccountActivityLogs}
        isLiveConnected={
          Boolean(
            selectedLogsAccount &&
            (activeAccount?.id === selectedLogsAccount.id ||
             (activeServer && (botStates[`${activeServer.id}__${selectedLogsAccount.id}`] === 'SPAWNED' || botStates[`${activeServer.id}__${selectedLogsAccount.id}`] === 'LOGGED_IN')) ||
             botStates[selectedLogsAccount.id] === 'SPAWNED' ||
             botStates[selectedLogsAccount.id] === 'LOGGED_IN' ||
             (isActiveServerRunning && assignedAccounts[0]?.id === selectedLogsAccount.id))
          )
        }
      />

      {/* LOGGED OUT GATEWAY */}
      {!currentUser ? (
        <AuthLanding onSignIn={() => setIsAuthOpen(true)} />
      ) : (
        /* MINECRAFTAFK MAIN DASHBOARD LAYOUT */
        <div className="flex-1 flex flex-col md:flex-row md:min-h-screen">
          {/* Mobile Top Header Bar */}
          <div className="md:hidden flex items-center justify-between p-3.5 bg-white border-b border-slate-200/90 shrink-0 sticky top-0 z-30 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Open navigation menu"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="pa-mobile-breadcrumb flex items-center gap-2 min-w-0 text-xs font-bold">
                {activeMainView === 'profile' && activeServer ? (
                  <>
                    <ServerLogo host={activeServer.serverHost} name={activeServer.name} size="w-5 h-5" />
                    <span className="truncate max-w-[36vw] text-slate-800">{activeServer.name}</span>
                    <span className="text-slate-400">/</span>
                    <span className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 uppercase text-[10px] font-black shrink-0">{activeSubTab}</span>
                  </>
                ) : (
                  <span className="truncate text-slate-800 uppercase tracking-wide">{activeMainView === 'webhook' ? 'Discord Webhooks' : activeMainView === 'account' ? 'Your Account' : activeMainView === 'termux' ? 'Termux Stream' : activeMainView}</span>
                )}
              </div>
            </div>

            {/* Daemon Connection Status on Mobile Top-Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                title={
                  socketStatus === 'AUTHENTICATED'
                    ? 'Daemon Active & Online (Click to configure bridge)'
                    : 'Daemon Standby / Not Connected (Click to configure bridge)'
                }
                aria-label="Open daemon connection settings"
                className={`pa-daemon-button ${socketStatus === 'AUTHENTICATED' ? 'pa-daemon-online' : socketStatus === 'CONNECTING' || socketStatus === 'CONNECTED' ? 'pa-daemon-connecting' : 'pa-daemon-offline'}`}
              >
                <span className="pa-item-icon pa-icon-connect pa-daemon-torch" aria-hidden="true" />
                <span className="pa-daemon-light" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mobile Backdrop Overlay */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
            />
          )}

          {/* LEFT SIDEBAR (Slide-out drawer on mobile, permanent sidebar on desktop) */}
          <aside
            className={`fixed md:static inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-2xl md:shadow-2xs transition-transform duration-200 ease-in-out ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            {/* Logo Bar */}
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setActiveMainView('dashboard');
                  setIsMobileSidebarOpen(false);
                }}
                className="flex items-center gap-2.5 text-left group hover:opacity-90 transition cursor-pointer"
                title="Go to PocketAFK Dashboard"
              >
                <div className="pa-dashboard-logo group-hover:scale-105 transition-transform">
                  <img src="/pocketafk-emblem.png" alt="" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">PocketAFK</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-mono font-medium">v2.4 Java Core</span>
                  </div>
                </div>
              </button>

              {/* Close Button on Mobile Drawer */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                title="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Navigation Items */}
            <div className="p-3 space-y-1.5">
              <button
                onClick={() => {
                  setActiveMainView('dashboard');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'dashboard'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <span className="pa-item-icon pa-icon-dashboard" aria-hidden="true" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => {
                  setActiveMainView('termux');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'termux'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <span className="pa-item-icon pa-icon-daemon-lamp" aria-hidden="true" />
                <span>Termux Stream</span>
                <span className={`ml-auto h-2 w-2 rounded-full ${socketStatus === 'AUTHENTICATED' ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label={socketStatus === 'AUTHENTICATED' ? 'Daemon online' : 'Daemon offline'} />
              </button>

              <button
                onClick={() => {
                  setActiveMainView('webhook');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'webhook'
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/90 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="pa-item-icon pa-icon-webhook" aria-hidden="true" />
                  <span>Webhook</span>
                </div>
                {(Boolean(webhookConfig.daemonWebhookUrl) || Boolean(webhookConfig.botWebhookUrl)) && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-indigo-200 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => {
                  setActiveMainView('servers');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'servers'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <span className="pa-item-icon pa-icon-servers" aria-hidden="true" />
                <span>Servers</span>
              </button>

              <button
                onClick={() => {
                  setActiveMainView('accounts');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'accounts'
                    ? 'bg-sky-50 text-sky-900 border border-sky-200/90 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="pa-item-icon pa-icon-accounts" aria-hidden="true" />
                  <span>Accounts</span>
                </div>
                <span className="text-[10px] bg-white text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-mono font-bold shadow-2xs">
                  {accounts.length}/{currentRankConfig.maxAccounts}
                </span>
              </button>
            </div>

            <div className="border-t border-slate-200 my-1" />

            {/* Server Profiles Section */}
            <div className="p-3 flex-1 overflow-y-auto space-y-1">
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Server profiles</span>
                <button
                  disabled={servers.length >= currentRankConfig.maxServers}
                  onClick={() => {
                    if (servers.length >= currentRankConfig.maxServers) {
                      showToast(
                        `Your ${currentRankConfig.name} rank allows up to ${currentRankConfig.maxServers} ${
                          currentRankConfig.maxServers === 1 ? 'server profile' : 'server profiles'
                        }. Upgrade your rank to add more!`,
                        'error'
                      );
                      setIsRankModalOpen(true);
                      return;
                    }
                    setEditingServer(null);
                    setIsServerModalOpen(true);
                  }}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                  title="Add Server Profile (Max 3)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Profiles List */}
              {[...servers]
                .sort((a, b) => {
                  const aPinned = pinnedServerIds.includes(a.id);
                  const bPinned = pinnedServerIds.includes(b.id);
                  if (aPinned && !bPinned) return -1;
                  if (!aPinned && bPinned) return 1;
                  return 0;
                })
                .map((srv) => {
                  const isSelected = srv.id === activeServerId;
                  const assignedIds = (
                    Array.isArray(srv.assignedAccountIds)
                      ? srv.assignedAccountIds
                      : srv.accountId ? [srv.accountId] : []
                  ).filter((id) => accounts.some((a) => a.id === id || a.ign === id));
                  const srvAssignedCount = assignedIds.length;

                  const isDaemonConnected = socketStatus === 'AUTHENTICATED';

                  // Detect any running or connecting bot under this server (srv.id or srv.id__accId)
                  const activePrefixBots = isDaemonConnected ? Object.entries(botStates).filter(
                    ([k, st]) => (k === srv.id || k.startsWith(`${srv.id}__`)) && (st === 'SPAWNED' || st === 'LOGGED_IN')
                  ).length : 0;

                  const assignedOnlineCount = isDaemonConnected ? assignedIds.filter((accId) => {
                    const acc = accounts.find((a) => a.id === accId || a.ign === accId);
                    const st =
                      botStates[`${srv.id}__${accId}`] ||
                      (acc ? botStates[`${srv.id}__${acc.id}`] : undefined) ||
                      (acc ? botStates[`${srv.id}__${acc.ign}`] : undefined) ||
                      botStates[srv.id];
                    return st === 'SPAWNED' || st === 'LOGGED_IN';
                  }).length : 0;

                  const onlineCount = isDaemonConnected ? Math.max(
                    activePrefixBots,
                    assignedOnlineCount,
                    (srv.id === activeServerId && (botState === 'SPAWNED' || botState === 'LOGGED_IN')) ? 1 : 0
                  ) : 0;

                  const isConnecting = isDaemonConnected && (
                    Object.entries(botStates).some(
                      ([k, st]) => (k === srv.id || k.startsWith(`${srv.id}__`)) && st === 'CONNECTING'
                    ) || (srv.id === activeServerId && botState === 'CONNECTING')
                  );

                  const isRunning = onlineCount > 0 || isConnecting;
                  const totalSlots = Math.max(srvAssignedCount, onlineCount);

                  return (
                    <div key={srv.id} className="space-y-1 pt-1">
                      {/* Server Profile Row */}
                      <button
                        onClick={() => {
                          setActiveServerId(srv.id);
                          setActiveMainView('profile');
                          setIsMobileSidebarOpen(false);
                        }}
                        title={srv.name}
                        className={`pa-server-profile-link w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected && activeMainView === 'profile'
                            ? 'bg-[#294331] text-[#f2f6e8] border border-emerald-300/80 shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <ServerLogo host={srv.serverHost} name={srv.name} size="w-5 h-5" />
                          <span className="pa-server-profile-name truncate">{srv.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                          <Radio className={`w-3 h-3 ${isRunning ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                          <span className={`px-1.5 py-0.2 rounded-md ${isRunning ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-500'}`}>
                            {onlineCount}/{totalSlots}
                          </span>
                        </div>
                      </button>

                    {/* Sub-Feature Tabs */}
                    {isSelected && activeMainView === 'profile' && (
                      <div className="ml-3 pl-3 border-l-2 border-slate-200 space-y-1 pt-1">
                        <button
                          onClick={() => {
                            setActiveSubTab('connect');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'connect'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-connect pa-item-icon-small" aria-hidden="true" />
                          Connect
                          <ServerPlayerCount host={`${srv.serverHost}${srv.serverPort && Number(srv.serverPort) !== 25565 ? `:${srv.serverPort}` : ''}`} />
                        </button>

                        <button
                          onClick={() => {
                            setActiveSubTab('chat');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'chat'
                              ? 'bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-chat pa-item-icon-small" aria-hidden="true" />
                          Chat
                        </button>

                        <button
                          onClick={() => {
                            setActiveSubTab('movement');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'movement'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-movement pa-item-icon-small" aria-hidden="true" />
                          Movement
                        </button>

                        <button
                          onClick={() => {
                            setActiveSubTab('inventory');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'inventory'
                              ? 'bg-purple-50 text-purple-800 border border-purple-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-inventory pa-item-icon-small" aria-hidden="true" />
                          Inventory
                        </button>

                        <button
                          onClick={() => {
                            setActiveSubTab('pov');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'pov'
                              ? 'bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-pov pa-item-icon-small" aria-hidden="true" />
                          POV
                        </button>

                        <button
                          onClick={() => {
                            setActiveSubTab('settings');
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            activeSubTab === 'settings'
                              ? 'bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="pa-item-icon pa-icon-settings pa-item-icon-small" aria-hidden="true" />
                          Settings
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom User Pill */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-1 mt-auto shrink-0">
              <div className="flex items-center gap-2 truncate min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainView('account');
                    setIsMobileSidebarOpen(false);
                  }}
                  className="pa-account-link text-xs font-bold text-slate-800 font-mono truncate"
                  title="Open your account settings"
                  aria-label={`Open account settings for ${effectiveUser}`}
                >
                  <span>@{effectiveUser}</span><ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsRankModalOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition cursor-pointer flex items-center gap-1 shrink-0 ${currentRankConfig.badgeBg} ${currentRankConfig.badgeText} ${currentRankConfig.badgeBorder} hover:brightness-95 active:scale-95 shadow-2xs`}
                  title="Click to view or upgrade Rank"
                >
                  <span className="pa-item-icon pa-icon-rank pa-rank-gem" aria-hidden="true" />
                  <span>{currentRankConfig.name}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto">
            {/* Top Navigation & Status Bar */}
            <header className="hidden md:flex h-14 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-6 items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs font-bold min-w-0">
                {activeMainView === 'profile' && activeServer ? (
                  <>
                    <div className="flex items-center gap-2">
                      <ServerLogo host={activeServer.serverHost} name={activeServer.name} size="w-5 h-5" />
                      <span className="text-slate-800 font-extrabold truncate max-w-[42vw] md:max-w-none">{activeServer.name}</span>
                    </div>
                    <span className="text-slate-300 font-normal">/</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border shadow-2xs whitespace-nowrap ${
                      activeSubTab === 'connect' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                      activeSubTab === 'chat' ? 'bg-sky-50 text-sky-800 border-sky-300' :
                      activeSubTab === 'movement' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                      activeSubTab === 'inventory' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                      activeSubTab === 'pov' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                      'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      {activeSubTab}
                    </span>
                  </>
                ) : (
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border ${
                    activeMainView === 'webhook'
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {activeMainView === 'webhook' ? 'Discord Webhooks' : activeMainView === 'account' ? 'Your Account' : activeMainView === 'termux' ? 'Termux Stream' : activeMainView}
                  </span>
                )}
              </div>

              <div className="hidden md:flex items-center gap-3">
                {/* Termux Daemon Status - Animated Icon (Green: Active, Blue: Standby) */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  title={
                    socketStatus === 'AUTHENTICATED'
                      ? 'Daemon Active & Online (Click to configure bridge)'
                      : 'Daemon Standby / Not Connected (Click to configure bridge)'
                  }
                  aria-label="Open daemon connection settings"
                  className={`pa-daemon-button ${socketStatus === 'AUTHENTICATED' ? 'pa-daemon-online' : socketStatus === 'CONNECTING' || socketStatus === 'CONNECTED' ? 'pa-daemon-connecting' : 'pa-daemon-offline'}`}
                >
                  <span className="pa-item-icon pa-icon-connect pa-daemon-torch" aria-hidden="true" />
                  <span className="pa-daemon-light" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* TAB CONTENT PANELS */}
            <div className="p-4 sm:p-6 flex-1 max-w-7xl w-full mx-auto pb-8 md:pb-6">
              {activeMainView === 'account' && currentUser && (
                <AccountSettingsView
                  username={currentUser}
                  socketStatus={socketStatus}
                  daemonUrl={daemonUrl}
                  daemonConnections={daemonConnections}
                  onDisconnectConnection={(connectionId) => {
                    const sent = revokeDaemonConnection(connectionId);
                    if (!sent) showToast('Could not disconnect this browser session. Reconnect to the daemon and try again.', 'error');
                    else showToast('Browser session disconnect requested. It will need the PocketAFK password to sign in again.', 'info');
                    return sent;
                  }}
                  onPasswordChanged={(newSecret) => {
                    const userKey = currentUser.trim().toLowerCase();
                    localStorage.setItem(`pocketafk_secret_${currentUser}`, newSecret);
                    localStorage.setItem(`pocketafk_secret_${userKey}`, newSecret);
                    setSecretCode(newSecret);
                    const nextDaemonToken = !authToken || authToken === secretCode ? newSecret : authToken;
                    saveSettings(daemonUrl, nextDaemonToken);
                    showToast('Password updated. Run the refreshed Termux command once to update its tunnel key.', 'success');
                  }}
                />
              )}

              {/* VIEW: DASHBOARD OVERVIEW */}
              {activeMainView === 'dashboard' && (
                <DashboardOverview
                  accounts={accounts}
                  servers={servers}
                  socketStatus={socketStatus}
                  currentUser={currentUser}
                  userRank={userRank}
                  onNavigate={(view, srvId) => {
                    setActiveMainView(view);
                    if (srvId) setActiveServerId(srvId);
                  }}
                  onOpenAddAccount={() => handleStartMicrosoftLogin()}
                  onOpenAddServer={() => {
                    setEditingServer(null);
                    setIsServerModalOpen(true);
                  }}
                />
              )}

              {activeMainView === 'termux' && (
                <TermuxStreamView
                  socketStatus={socketStatus}
                  daemonStartedAt={daemonRuntimeInfo?.startedAt ?? daemonStatusHistory.daemonStartedAt}
                  lastDisconnectedAt={daemonStatusHistory.lastDisconnectedAt}
                  statusStorageAvailable={daemonStatusHistory.statusStorageAvailable}
                  messages={allMessages}
                  activityLogs={allActivityLogs}
                  servers={servers}
                  onShutdown={() => {
                    const sent = shutdownDaemon();
                    showToast(sent ? 'Shutdown requested. Termux is stopping the daemon and bots.' : 'Connect to the Termux daemon before shutting it down.', sent ? 'info' : 'error');
                    return sent;
                  }}
                  onShutdownTimeout={() => showToast('No shutdown response. Restart the Termux launcher once so it can receive the shutdown update.', 'error')}
                />
              )}

              {/* VIEW: DISCORD WEBHOOKS */}
              {activeMainView === 'webhook' && (
                <WebhookView
                  currentUser={currentUser || 'Opera'}
                  config={webhookConfig}
                  onUpdateConfig={(next) => {
                    setWebhookConfig(next);
                    if (currentUser) {
                      localStorage.setItem(`pocketafk_webhooks_${currentUser}`, JSON.stringify(next));
                    }
                    if (socketStatus === 'AUTHENTICATED') {
                      updateWebhookConfig(next);
                    }
                  }}
                  onSaveConfig={async () => {
                    if (currentUser) {
                      localStorage.setItem(`pocketafk_webhooks_${currentUser}`, JSON.stringify(webhookConfig));
                      await saveWebhookConfigToSupabase(currentUser, webhookConfig);
                    }
                    if (socketStatus === 'AUTHENTICATED') {
                      updateWebhookConfig(webhookConfig);
                    }
                  }}
                  isDaemonConnected={socketStatus === 'AUTHENTICATED'}
                  showToast={showToast}
                />
              )}

              {/* VIEW: SERVERS OVERVIEW */}
              {activeMainView === 'servers' && (
                <div className="space-y-4">
                  {/* Top Bar: Title, Action Buttons, and Filter */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Servers</h2>
                      <p className="text-xs text-slate-500">Configure and manage your Minecraft AFK servers.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (servers.length >= 3) {
                            showToast('Maximum of 3 servers reached.', 'error');
                            return;
                          }
                          setEditingServer(null);
                          setIsServerModalOpen(true);
                        }}
                        disabled={servers.length >= 3}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Server</span>
                      </button>

                      <button
                        onClick={() => {
                          showToast('Server profile import coming soon.', 'info');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-2xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Import</span>
                      </button>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={serverFilter}
                          onChange={(e) => setServerFilter(e.target.value)}
                          className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-2xs w-44 sm:w-56"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Servers Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto touch-pan-x">
                      <table className="w-full text-left text-xs min-w-[660px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="p-3.5">
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              <span>Name</span>
                            </div>
                          </th>
                          <th className="p-3.5">
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              <span>Online</span>
                            </div>
                          </th>
                          <th className="p-3.5">
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              <span>Connections</span>
                            </div>
                          </th>
                          <th className="p-3.5">
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              <span>Server IP</span>
                            </div>
                          </th>
                          <th className="p-3.5">
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              <span>Date Added</span>
                            </div>
                          </th>
                          <th className="p-3.5 text-right w-24">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {servers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-500">
                              <div className="space-y-3 max-w-sm mx-auto">
                                <Server className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-semibold text-slate-700">No server profiles added yet.</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  Create a server profile to configure your Minecraft target address and port.
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingServer(null);
                                    setIsServerModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add Server
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          servers
                            .filter((s) => {
                              const q = serverFilter.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                s.name.toLowerCase().includes(q) ||
                                s.serverHost.toLowerCase().includes(q)
                              );
                            })
                            .sort((a, b) => {
                              const aPinned = pinnedServerIds.includes(a.id);
                              const bPinned = pinnedServerIds.includes(b.id);
                              if (aPinned && !bPinned) return -1;
                              if (!aPinned && bPinned) return 1;
                              return 0;
                            })
                            .map((srv) => {
                              const isPinned = pinnedServerIds.includes(srv.id);
                              const assignedIds = (
                                Array.isArray(srv.assignedAccountIds)
                                  ? srv.assignedAccountIds
                                  : srv.accountId ? [srv.accountId] : []
                              ).filter((id) => accounts.some((a) => a.id === id || a.ign === id));
                              const totalAssigned = assignedIds.length;

                              const isDaemonConnected = socketStatus === 'AUTHENTICATED';

                              const activePrefixBots = isDaemonConnected ? Object.entries(botStates).filter(
                                ([k, st]) => (k === srv.id || k.startsWith(`${srv.id}__`)) && (st === 'SPAWNED' || st === 'LOGGED_IN')
                              ).length : 0;

                              const assignedOnlineCount = isDaemonConnected ? assignedIds.filter((accId) => {
                                const acc = accounts.find((a) => a.id === accId || a.ign === accId);
                                const st =
                                  botStates[`${srv.id}__${accId}`] ||
                                  (acc ? botStates[`${srv.id}__${acc.id}`] : undefined) ||
                                  (acc ? botStates[`${srv.id}__${acc.ign}`] : undefined) ||
                                  botStates[srv.id];
                                return st === 'SPAWNED' || st === 'LOGGED_IN';
                              }).length : 0;

                              const onlineCount = isDaemonConnected ? Math.max(activePrefixBots, assignedOnlineCount) : 0;

                              const hasConnecting = isDaemonConnected && (
                                Object.entries(botStates).some(
                                  ([k, st]) => (k === srv.id || k.startsWith(`${srv.id}__`)) && st === 'CONNECTING'
                                ) ||
                                assignedIds.some((accId) => {
                                  const acc = accounts.find((a) => a.id === accId || a.ign === accId);
                                  const st =
                                    botStates[`${srv.id}__${accId}`] ||
                                    (acc ? botStates[`${srv.id}__${acc.id}`] : undefined) ||
                                    (acc ? botStates[`${srv.id}__${acc.ign}`] : undefined) ||
                                    botStates[srv.id];
                                  return st === 'CONNECTING';
                                })
                              );

                              const isRunning = onlineCount > 0 || hasConnecting;
                              const connections = serverConnections[srv.id] || srv.connectionsCount || 0;
                              const dateAddedStr = formatServerDate(srv.createdAt);

                              return (
                                <tr
                                  key={srv.id}
                                  onClick={() => {
                                    setActiveServerId(srv.id);
                                    setActiveMainView('profile');
                                    setActiveSubTab('connect');
                                  }}
                                  className="hover:bg-slate-50/80 transition cursor-pointer group"
                                >
                                  {/* Name + Logo */}
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-3">
                                      <ServerLogo host={srv.serverHost} name={srv.name} size="w-7 h-7" />
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition">
                                          {srv.name}
                                        </span>
                                        {isPinned && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                                            <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Online */}
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                      <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                      <span className={isRunning ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                                        {onlineCount}/{totalAssigned}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Connections */}
                                  <td className="p-3.5">
                                    <span className="font-mono text-xs text-slate-700 font-semibold">
                                      {connections.toLocaleString()}
                                    </span>
                                  </td>

                                  {/* Server IP */}
                                  <td className="p-3.5">
                                    <span className="font-mono text-xs text-slate-600 select-all font-medium">
                                      {srv.serverHost}
                                    </span>
                                  </td>

                                  {/* Date Added */}
                                  <td className="p-3.5">
                                    <span className="text-xs text-slate-500 font-medium">
                                      {dateAddedStr}
                                    </span>
                                  </td>

                                  {/* Actions */}
                                  <td className="p-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleServerPin(srv.id);
                                        }}
                                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                          isPinned
                                            ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                            : 'text-slate-400 hover:text-slate-700 border-transparent hover:border-slate-200 hover:bg-slate-100'
                                        }`}
                                        title={isPinned ? 'Unpin server profile' : 'Pin to top'}
                                      >
                                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteServer(srv.id);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                                        title="Delete server profile"
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

              {/* VIEW: DEDICATED ACCOUNTS PAGE */}
              {activeMainView === 'accounts' && (
                <div className="space-y-4">
                  {/* Top Bar: Title, Add Account Button, and Filter */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                        <span>Accounts</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold border border-slate-200">
                          {accounts.length}/{currentRankConfig.maxAccounts}
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">Manage all your verified Microsoft Java Minecraft accounts.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (accounts.length >= currentRankConfig.maxAccounts) {
                            showToast(
                              `Your ${currentRankConfig.name} rank limit of ${currentRankConfig.maxAccounts} ${
                                currentRankConfig.maxAccounts === 1 ? 'account' : 'accounts'
                              } has been reached. Upgrade your rank to add more!`,
                              'info'
                            );
                            setIsRankModalOpen(true);
                            return;
                          }
                          handleStartMicrosoftLogin();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Account</span>
                      </button>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={accountFilter}
                          onChange={(e) => setAccountFilter(e.target.value)}
                          className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-2xs w-48 sm:w-60"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Accounts Container */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    {/* Mobile Wrapped Cards View (< md) - All info visible in one go */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {accounts.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 space-y-3">
                          <Users className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700">No Minecraft accounts linked yet.</p>
                          <p className="text-[11px] text-slate-400">
                            Click &ldquo;Add Account&rdquo; above to link your official Java Microsoft account.
                          </p>
                          <button
                            onClick={() => handleStartMicrosoftLogin()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" /> Link Microsoft Account
                          </button>
                        </div>
                      ) : (
                        accounts
                          .filter((a) => {
                            const q = accountFilter.toLowerCase().trim();
                            if (!q) return true;
                            return (a.ign || a.username).toLowerCase().includes(q);
                          })
                          .map((acc) => {
                            const isPinned = pinnedAccountIds.includes(acc.id);
                            const connectionsCount = accountConnections[acc.id] || 1;
                            const dateAddedStr = acc.addedAt
                              ? new Date(acc.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'Recent';

                            return (
                              <div key={acc.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/70 transition">
                                {/* Top Line: Avatar + IGN + Shield + Status Badge */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shrink-0 shadow-2xs">
                                      <img
                                        src={`https://crafthead.net/helm/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/36`}
                                        alt={acc.ign || acc.username}
                                        className="w-full h-full object-cover [image-rendering:pixelated]"
                                        onError={(e) => {
                                          const img = e.target as HTMLImageElement;
                                          if (!img.src.includes('mc-heads')) {
                                            img.src = `https://mc-heads.net/avatar/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/36`;
                                          } else {
                                            img.src = 'https://minotar.net/helm/MHF_Steve/32.png';
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-black text-slate-900 text-xs flex items-center gap-1.5 truncate">
                                        <span className="truncate">{acc.ign || acc.expectedIgn || acc.username}</span>
                                        {acc.authError ? (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                                            Mismatch
                                          </span>
                                        ) : (
                                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {acc.uuid ? 'Java Edition' : 'Bedrock / Java'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status Badge */}
                                  <div className="shrink-0">
                                    {acc.authError ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        Failed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Working
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Auth error display if any */}
                                {acc.authError && (
                                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-700">
                                    {acc.authError}
                                  </div>
                                )}

                                {/* Bottom Info & Action Bar: Wrapped and cleanly accessible */}
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                                  <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                                    <span className="bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded">
                                      ⚡ {connectionsCount} {connectionsCount === 1 ? 'server' : 'servers'}
                                    </span>
                                    <span className="text-slate-400">{dateAddedStr}</span>
                                  </div>

                                  {/* Quick Actions */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAccountLogs(acc)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition cursor-pointer"
                                      title="View logs"
                                    >
                                      <span className="pa-item-icon pa-icon-chat pa-logbook-icon" aria-hidden="true" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(acc.ign || acc.username);
                                        showToast(`Copied ${acc.ign || acc.username} to clipboard!`, 'success');
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                                      title="Copy name"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleTogglePin(acc.id)}
                                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                        isPinned
                                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                                      }`}
                                      title={isPinned ? 'Unpin' : 'Pin'}
                                    >
                                      <Pin className="w-3.5 h-3.5" />
                                    </button>

                                    {acc.authError && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartMicrosoftLogin(acc)}
                                        className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                        title="Re-authenticate"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAccount(acc.id)}
                                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>

                    {/* Desktop Accounts Table View (>= md) */}
                    <div className="hidden md:block overflow-x-auto touch-pan-x">
                      <table className="w-full text-left text-xs min-w-[720px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="p-3.5">Account Name</th>
                          <th className="p-3.5">Account Access</th>
                          <th className="p-3.5">Connections</th>
                          <th className="p-3.5">Date Added</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accounts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-slate-500">
                              <div className="space-y-3 max-w-sm mx-auto">
                                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-semibold text-slate-700">No Minecraft accounts linked yet.</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                   Click &ldquo;Add Account&rdquo; above to authenticate and link your official Java Microsoft account.
                                </p>
                                <button
                                  onClick={() => handleStartMicrosoftLogin()}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Link Microsoft Account
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          accounts
                            .filter((a) => {
                              const q = accountFilter.toLowerCase().trim();
                              if (!q) return true;
                              return (a.ign || a.username).toLowerCase().includes(q);
                            })
                            .map((acc) => {
                              const isPinned = pinnedAccountIds.includes(acc.id);
                              const connectionsCount = accountConnections[acc.id] || 1;
                              const dateAddedStr = acc.addedAt
                                ? new Date(acc.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                                  ', ' +
                                  new Date(acc.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                                : 'Recent';

                              return (
                                <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                                  {/* Account Name + Skin */}
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0 shadow-2xs">
                                        <img
                                          src={`https://crafthead.net/helm/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/32`}
                                          alt={acc.ign || acc.username}
                                          className="w-full h-full object-cover [image-rendering:pixelated]"
                                          onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            if (!img.src.includes('mc-heads')) {
                                              img.src = `https://mc-heads.net/avatar/${encodeURIComponent((acc.uuid || acc.ign || acc.username).split('@')[0])}/32`;
                                            } else {
                                              img.src = 'https://minotar.net/helm/MHF_Steve/32.png';
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                                          <span>{acc.ign || acc.expectedIgn || acc.username}</span>
                                          {acc.authError ? (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                              Mismatch
                                            </span>
                                          ) : (
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenAccountLogs(acc);
                                            }}
                                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition cursor-pointer shadow-2xs ml-0.5 group"
                                            title="View connection & audit logs for this account"
                                          >
                                            <span className="pa-item-icon pa-icon-chat pa-logbook-icon" aria-hidden="true" />
                                          </button>
                                        </div>
                                        {acc.authError ? (
                                          <p className="text-[10px] text-rose-600 font-medium leading-tight max-w-[220px] mt-0.5">
                                            {acc.authError}
                                          </p>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            {acc.uuid ? acc.uuid.substring(0, 16) + '...' : 'Java Edition'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Account Access */}
                                  <td className="p-3.5">
                                    {acc.authError ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                                          Verification Failed
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Working
                                      </span>
                                    )}
                                  </td>

                                  {/* Connections */}
                                  <td className="p-3.5">
                                    <span className="font-mono text-xs font-semibold text-slate-700">
                                      {connectionsCount}
                                    </span>
                                  </td>

                                  {/* Date Added */}
                                  <td className="p-3.5">
                                    <span className="text-xs text-slate-500 font-medium">
                                      {dateAddedStr}
                                    </span>
                                  </td>

                                  {/* Actions */}
                                  <td className="p-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Re-link button for failed / mismatched accounts */}
                                      {acc.authError && (
                                        <button
                                          onClick={() => handleStartMicrosoftLogin(acc)}
                                          className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                          title="Re-authenticate with Microsoft"
                                        >
                                          <RefreshCw className="w-4 h-4" />
                                        </button>
                                      )}

                                      {/* Pin/Unpin */}
                                      <button
                                        onClick={() => handleTogglePin(acc.id)}
                                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                                          isPinned ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                        title={isPinned ? 'Unpin from top' : 'Pin to top'}
                                      >
                                        <Pin className="w-4 h-4" />
                                      </button>

                                      {/* Copy Name */}
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(acc.ign || acc.username);
                                          showToast(`Copied ${acc.ign || acc.username} to clipboard!`, 'success');
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                        title="Copy account name"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>

                                      {/* Delete */}
                                      <button
                                        onClick={() => handleDeleteAccount(acc.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        title="Delete account"
                                      >
                                        <Trash2 className="w-4 h-4" />
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

              {/* VIEW: PROFILE SUB-TABS */}
              {activeMainView === 'profile' && activeServer && (
                <>
                  {/* SUB-TAB 1: CONNECT */}
                  {activeSubTab === 'connect' && (
                    <div className="space-y-4">
                      {/* Top Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="pa-connect-actions flex flex-wrap items-center gap-2.5">
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
                        <div className="pa-connect-search relative w-full sm:w-auto">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter accounts..."
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="pa-connect-filter w-full sm:w-auto pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Accounts Table for this Server Profile */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto touch-pan-x">
                          <table className="pa-profile-accounts-table w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                            <tr>
                              <th className="p-3 w-8">
                                <input
                                  type="checkbox"
                                  checked={selectedAccountIds.length > 0 && selectedAccountIds.length === assignedAccounts.length}
                                  onChange={handleSelectAllToggle}
                                  className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                                />
                              </th>
                              <th className="p-3">Account Name</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Uptime</th>
                              <th className="p-3">Note</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {assignedAccounts.length === 0 ? (
                              <tr className="pa-profile-accounts-empty-row">
                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                  <div className="space-y-2">
                                    <p className="text-xs">No accounts assigned to this server profile yet.</p>
                                    {availableAccounts.length > 0 && (
                                      <p className="text-[11px] text-slate-400">Click &ldquo;+&rdquo; below on any available account to assign it.</p>
                                    )}
                                    {accounts.length === 0 && (
                                      <button
                                        onClick={() => handleStartMicrosoftLogin()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                                      >
                                        <Plus className="w-3.5 h-3.5" /> Link Microsoft Java Account
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              assignedAccounts.map((acc) => {
                                const isChecked = selectedAccountIds.includes(acc.id);
                                const botKey = `${activeServer.id}__${acc.id}`;
                                const isAssignedActive =
                                  activeAccount?.id === acc.id ||
                                  activeServer.accountId === acc.id ||
                                  activeServer.accountId === acc.ign ||
                                  activeServer.accountId === acc.username;

                                const isDaemonConnected = socketStatus === 'AUTHENTICATED';

                                const rawBotState: BotLifecycleState =
                                  botStates[botKey] ||
                                  (isAssignedActive ? ((activeServer.id === activeServerId ? botState : botStates[activeServer.id]) || botStates[activeServer.id]) : undefined) ||
                                  'DISCONNECTED';

                                const currentBotState: BotLifecycleState = isDaemonConnected ? rawBotState : 'DISCONNECTED';

                                const currentBotReason: string = isDaemonConnected
                                  ? (botStateReasons[botKey] ||
                                     (isAssignedActive ? ((activeServer.id === activeServerId ? botStateReason : botStateReasons[activeServer.id]) || botStateReasons[activeServer.id]) : undefined) ||
                                     '')
                                  : (socketStatus === 'CONNECTING' ? 'Connecting to Termux daemon...' : 'Termux daemon is offline');

                                const isPinned = pinnedAccountIds.includes(acc.id);
                                const isBotOnline = isDaemonConnected && (currentBotState === 'SPAWNED' || currentBotState === 'LOGGED_IN');
                                const isBotConnecting = isDaemonConnected && currentBotState === 'CONNECTING';
                                const isBotActive = isBotOnline || isBotConnecting;

                                const srvStart = sessionStartTimes[botKey] || (isAssignedActive ? sessionStartTimes[activeServer.id] : undefined);
                                const localSec = srvStart ? Math.max(0, Math.floor((nowTick - srvStart) / 1000)) : 0;
                                const srvTel =
                                  telemetries?.[botKey] ||
                                  (telemetry?.botId === botKey ? telemetry : null) ||
                                  (isAssignedActive ? (telemetries?.[activeServer.id] || (telemetry?.botId === activeServer.id ? telemetry : null)) : null);
                                const daemonUptime =
                                  srvTel && typeof srvTel.uptime === 'number' && srvTel.uptime > 0
                                    ? srvTel.uptime
                                    : srvTel && typeof srvTel.connectedAt === 'number' && srvTel.connectedAt > 0
                                    ? Math.max(0, Math.floor((nowTick - srvTel.connectedAt) / 1000))
                                    : 0;
                                const accountUptime = (isDaemonConnected && isBotOnline) ? Math.max(daemonUptime, localSec) : 0;

                                return (
                                  <tr
                                    key={acc.id}
                                    className={`hover:bg-slate-50/80 transition ${
                                      isChecked ? 'bg-emerald-50/30' : ''
                                    }`}
                                  >
                                    <td className="p-3">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleAccountCheckbox(acc.id)}
                                        className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-md overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
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
                                        <div>
                                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>{acc.ign || acc.expectedIgn || acc.username}</span>
                                            {acc.authError ? (
                                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                                Mismatch
                                              </span>
                                            ) : (
                                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                            )}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenAccountLogs(acc);
                                              }}
                                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition cursor-pointer shadow-2xs ml-0.5 group"
                                              title="View connection & audit logs for this account"
                                            >
                                              <span className="pa-item-icon pa-icon-chat pa-logbook-icon" aria-hidden="true" />
                                            </button>
                                          </div>
                                          {acc.authError && (
                                            <p className="text-[10px] text-rose-600 font-medium leading-tight max-w-[220px] mt-0.5">
                                              {acc.authError}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {acc.authError ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartMicrosoftLogin(acc);
                                          }}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                                          title="Verification failed - Click to re-authenticate with Microsoft"
                                        >
                                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                                          Failed (Retry)
                                        </button>
                                      ) : (
                                        <div className="flex flex-col gap-1 items-start">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!activeServer) return;
                                              if (socketStatus !== 'AUTHENTICATED') {
                                                showToast('Cannot toggle: Termux daemon is offline. Start daemon first.', 'error');
                                                return;
                                              }
                                              if (isBotActive) {
                                                handleStopServer(activeServer.id, acc);
                                              } else {
                                                const currentAssigned = Array.isArray(activeServer.assignedAccountIds) ? activeServer.assignedAccountIds : [];
                                                const updatedAssigned = Array.from(new Set([...currentAssigned, acc.id]));
                                                const updated = { ...activeServer, accountId: acc.id, assignedAccountIds: updatedAssigned };
                                                handleSaveServer(updated);
                                                handleStartServer(updated, acc);
                                              }
                                            }}
                                            className="group inline-flex items-center transition-all duration-150 transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none"
                                            title={
                                              isBotActive
                                                ? `Online • Click to disconnect @${acc.ign || acc.username}`
                                                : currentBotReason
                                                ? `${currentBotState}: ${currentBotReason} • Click to connect`
                                                : `Offline • Click to connect @${acc.ign || acc.username}`
                                            }
                                          >
                                            {getStatusBadge(currentBotState)}
                                          </button>
                                          {currentBotReason && (currentBotState === 'KICKED' || currentBotState === 'ERROR' || currentBotState === 'RECONNECTING') && (
                                            <span
                                              className={`mt-1 inline-flex max-w-[220px] items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${currentBotState === 'RECONNECTING' ? 'border-[#65563b] bg-[#332e24] text-[#cfb978]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                                              title={currentBotReason}
                                            >
                                              {currentBotReason}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      {isBotOnline ? (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono text-xs font-bold shadow-2xs">
                                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>{formatUptime(accountUptime)}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs font-mono text-slate-400 font-medium px-2">—</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        placeholder="Add Note"
                                        value={accountNotes[acc.id] || (acc.ign ? accountNotes[acc.ign.toLowerCase()] : '') || ''}
                                        onChange={(e) => handleUpdateNote(acc.id, e.target.value, acc.ign)}
                                        className="w-full max-w-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {/* Re-link if verification failed */}
                                        {acc.authError && (
                                          <button
                                            onClick={() => handleStartMicrosoftLogin(acc)}
                                            className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                            title="Re-authenticate with Microsoft"
                                          >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                          </button>
                                        )}

                                        <button
                                          onClick={() => handleTogglePin(acc.id)}
                                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            isPinned ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-700'
                                          }`}
                                          title={isPinned ? 'Unpin' : 'Pin'}
                                        >
                                          <Pin className="w-3.5 h-3.5" />
                                        </button>

                                         {/* Remove from server profile (-) */}
                                        <button
                                          onClick={() => handleRemoveAccountFromProfile(acc.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                          title="Remove from this server profile"
                                        >
                                          <Minus className="w-3.5 h-3.5" />
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

                      {/* Available Accounts to Add (+) to this Server Profile */}
                      {availableAccounts.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-slate-700">Available Accounts (Not in this profile)</span>
                            <span className="text-[11px] text-slate-400 font-medium">Click &ldquo;+ Add to Profile&rdquo; to assign</span>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                            <div className="overflow-x-auto touch-pan-x">
                              <table className="w-full text-left text-xs min-w-[480px]">
                              <tbody className="divide-y divide-slate-100">
                                {availableAccounts.map((acc) => (
                                  <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-md overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
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
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span>{acc.ign || acc.username}</span>
                                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        placeholder="Add Note"
                                        value={accountNotes[acc.id] || (acc.ign ? accountNotes[acc.ign.toLowerCase()] : '') || ''}
                                        onChange={(e) => handleUpdateNote(acc.id, e.target.value, acc.ign)}
                                        className="w-full max-w-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={() => handleAddAccountToProfile(acc.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer shadow-2xs"
                                        title="Add to this server profile"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add to Profile</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        </div>
                      )}

                      {/* Add Account Button at Bottom of Table */}
                      <div className="flex justify-start">
                        <button
                          disabled={accounts.length >= 5}
                          onClick={() => handleStartMicrosoftLogin()}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-emerald-700 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4" /> Link Another Microsoft Account ({accounts.length}/5)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: CHAT */}
                  {activeSubTab === 'chat' && (
                    <div className="pa-chat-workspace flex flex-col h-[calc(100vh-140px)] min-h-[580px] space-y-3">


                      {/* In-Game Minecraft Styled Console */}
                      <div className="flex-1 min-h-0">
                        <Terminal
                          messages={filteredChatMessages}
                          onSendMessage={(msg, senderId) => handleSendChatMessage(msg, senderId)}
                          disabled={!isActiveServerRunning}
                          availableSenders={availableChatSenders}
                          selectedSenderId={chatSenderAccountId}
                          onSelectSender={(senderId) => setChatSenderAccountId(senderId)}
                          serverName={activeServer.name}
                          serverHost={activeServer.serverHost}
                          autoScrollEnabled={chatAutoScrollEnabled}
                          quickCommands={activeServer.quickCommands}
                          onEditQuickCommands={() => setIsQuickCommandsModalOpen(true)}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: MOVEMENT */}
                  {activeSubTab === 'movement' && (
                    <div className="max-w-2xl space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">Movement & Controls</h2>
                        <p className="text-xs text-slate-500">Control your bot movements and trigger in-game macros.</p>
                      </div>

                      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-6 shadow-xs">
                        {/* Directional Pad */}
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => sendChat(activeServer.id, '/jump')}
                            className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-2xs"
                          >
                            ▲ W
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => sendChat(activeServer.id, '/left')}
                              className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-2xs"
                            >
                              ◀ A
                            </button>
                            <button
                              onClick={() => sendChat(activeServer.id, '/jump')}
                              className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-2xs"
                            >
                              JUMP
                            </button>
                            <button
                              onClick={() => sendChat(activeServer.id, '/right')}
                              className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-2xs"
                            >
                              ▶ D
                            </button>
                          </div>
                          <button
                            onClick={() => sendChat(activeServer.id, '/back')}
                            className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-2xs"
                          >
                            ▼ S
                          </button>
                        </div>

                        {/* Quick Command Macros */}
                        <div className="pt-4 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-600 block mb-2">In-Game Command Macros</span>
                          <div className="flex flex-wrap gap-2">
                            {['/afk', '/lifesteal', '/afkrewards', '/home', '/spawn'].map((cmd) => (
                              <button
                                key={cmd}
                                onClick={() => sendChat(activeServer.id, cmd)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold transition cursor-pointer shadow-2xs"
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
                        <h2 className="text-lg font-black text-slate-900">Inventory & Container Menus</h2>
                        <p className="text-xs text-slate-500">View opened server chest menus and player inventory slots.</p>
                      </div>

                      {containerWindow ? (
                        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900">{safeMinecraftText(containerWindow.title) || 'Chest / Menu'}</h3>
                            <span className="text-xs font-mono text-emerald-700 font-bold">Window #{containerWindow.windowId}</span>
                          </div>

                          <div className="overflow-x-auto touch-pan-x">
                            <div className="grid grid-cols-9 gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl min-w-[340px]">
                              {Array.isArray(containerWindow.slots) && containerWindow.slots.map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => clickSlot(activeServerId || activeServer?.id || '', containerWindow.windowId, idx, 0)}
                                  className="aspect-square rounded-lg border border-slate-200 bg-white hover:border-emerald-500 flex items-center justify-center relative cursor-pointer shadow-2xs"
                                >
                                  {item && (
                                    <span className="text-[10px] font-mono text-slate-800 truncate px-1">
                                      {safeMinecraftText(item.customName) || safeMinecraftText(item.displayName) || item.name || 'Item'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 space-y-2 shadow-xs">
                          <Box className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="text-xs font-bold text-slate-700">No active chest or container menu open on this server.</p>
                          <p className="text-[11px] text-slate-500">When the bot opens a chest or server GUI, slots appear here automatically.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 5: POV / TELEMETRY */}
                  {activeSubTab === 'pov' && (() => {
                    const isDaemonConnected = socketStatus === 'AUTHENTICATED';
                    const activeSubBot = isDaemonConnected ? Object.entries(botStates).find(
                      ([k, st]) => (k === activeServer.id || k.startsWith(`${activeServer.id}__`)) && (st === 'SPAWNED' || st === 'LOGGED_IN')
                    ) : null;
                    const isSrvOnline =
                      isDaemonConnected && (
                        Boolean(activeSubBot) ||
                        botStates[activeServer.id] === 'SPAWNED' ||
                        botStates[activeServer.id] === 'LOGGED_IN' ||
                        (activeServer.id === activeServerId && (botState === 'SPAWNED' || botState === 'LOGGED_IN'))
                      );

                    const subBotTel = Object.entries(telemetries || {}).find(
                      ([k, t]) => (k === activeServer.id || k.startsWith(`${activeServer.id}__`)) && t !== null
                    )?.[1];
                    const currentServerTel =
                      telemetries?.[activeServer.id] ||
                      subBotTel ||
                      (telemetry && (telemetry.botId === activeServer.id || telemetry.botId?.startsWith(`${activeServer.id}__`)) ? telemetry : null);

                    const botAccountUsername = assignedAccounts[0]?.ign || assignedAccounts[0]?.username || currentUser || 'Bot';

                    return (
                      <div className="w-full max-w-4xl mx-auto py-2">
                        <XaerosMinimap
                          telemetry={currentServerTel}
                          botName={botAccountUsername}
                          large={true}
                        />
                      </div>
                    );
                  })()}

                  {/* SUB-TAB 6: SETTINGS */}
                  {activeSubTab === 'settings' && (
                    <div className="max-w-2xl space-y-6">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">Settings</h2>
                        <p className="text-xs text-slate-500">Configure connection details, anti-AFK intervals, and survival automations.</p>
                      </div>

                      {/* Server Information */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                        <h3 className="font-bold text-sm text-slate-900">Server information</h3>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">Profile name</label>
                          <input
                            type="text"
                            value={activeServer.name}
                            onChange={(e) => handleSaveServer({ ...activeServer, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">Server IP</label>
                          <input
                            type="text"
                            value={activeServer.serverHost}
                            onChange={(e) => handleSaveServer({ ...activeServer, serverHost: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            {(() => {
                              const hasActiveSubBot = Object.entries(botStates).some(
                                ([k, st]) => (k === activeServer.id || k.startsWith(`${activeServer.id}__`)) && (st === 'SPAWNED' || st === 'LOGGED_IN')
                              );
                              const isThisServerActive =
                                hasActiveSubBot ||
                                botStates[activeServer.id] === 'SPAWNED' ||
                                botStates[activeServer.id] === 'LOGGED_IN' ||
                                (activeServer.id === activeServerId && (botState === 'SPAWNED' || botState === 'LOGGED_IN'));

                              const subBotVersion = Object.entries(botVersions || {}).find(
                                ([k, v]) => (k === activeServer.id || k.startsWith(`${activeServer.id}__`)) && Boolean(v)
                              )?.[1];
                              const subBotTelVersion = Object.entries(telemetries || {}).find(
                                ([k, t]) => (k === activeServer.id || k.startsWith(`${activeServer.id}__`)) && Boolean(t?.version)
                              )?.[1]?.version;

                              const detectedVersion = isThisServerActive
                                ? (botVersions[activeServer.id] ||
                                   subBotVersion ||
                                   telemetries[activeServer.id]?.version ||
                                   subBotTelVersion ||
                                   (activeServer.id === activeServerId ? telemetry?.version : undefined))
                                : undefined;

                              return (
                                <>
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-600">Java version</label>
                                    {activeServer.serverVersion === 'auto' && detectedVersion && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 animate-in fade-in duration-200">
                                        Connected: {detectedVersion}
                                      </span>
                                    )}
                                  </div>
                                  <select
                                    value={activeServer.serverVersion}
                                    onChange={(e) => handleSaveServer({ ...activeServer, serverVersion: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                                  >
                                    <option value="auto">
                                      Auto Detect {detectedVersion ? `(${detectedVersion})` : ''}
                                    </option>
                                    <option value="1.21.4">1.21.4 (Latest)</option>
                                    <option value="1.21.3">1.21.3</option>
                                    <option value="1.21.2">1.21.2</option>
                                    <option value="1.21.1">1.21.1</option>
                                    <option value="1.21">1.21</option>
                                    <option value="1.20.6">1.20.6</option>
                                    <option value="1.20.4">1.20.4</option>
                                    <option value="1.20.2">1.20.2</option>
                                    <option value="1.20.1">1.20.1</option>
                                    <option value="1.19.4">1.19.4</option>
                                    <option value="1.18.2">1.18.2</option>
                                    <option value="1.16.5">1.16.5</option>
                                    <option value="1.12.2">1.12.2</option>
                                    <option value="1.8.9">1.8.9</option>
                                  </select>
                                </>
                              );
                            })()}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Server Port</label>
                            <input
                              type="number"
                              value={activeServer.serverPort}
                              onChange={(e) => handleSaveServer({ ...activeServer, serverPort: parseInt(e.target.value, 10) || 25565 })}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Chat settings (shared across all server profiles) */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">Chat settings</h3>
                          <p className="text-[11px] text-slate-500 mt-1">These preferences apply to chat on every server profile.</p>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <label className="text-xs font-bold text-slate-800">Auto-scroll chat</label>
                            <span className="text-[11px] text-slate-400 block mt-0.5">Keep the newest messages in view as they arrive.</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={chatAutoScrollEnabled}
                            aria-label="Auto-scroll chat across all servers"
                            onClick={() => {
                              const nextValue = !chatAutoScrollEnabled;
                              setChatAutoScrollEnabled(nextValue);
                              const userKey = (currentUser || 'guest').trim().toLowerCase();
                              localStorage.setItem(`pocketafk_chat_auto_scroll_${userKey}`, String(nextValue));
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${chatAutoScrollEnabled ? 'bg-emerald-600' : 'bg-slate-400'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${chatAutoScrollEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Extra Settings */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                        <h3 className="font-bold text-sm text-slate-900">Extra settings</h3>

                        <div className="space-y-4 divide-y divide-slate-100">
                          {/* Join delay */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex-1 pr-4">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>Join delay</span>
                              </label>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                Delay before the bot connects to the server after launching.
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={300}
                                  value={activeServer.settings?.joinDelay ?? 0}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    handleUpdateServerSetting('joinDelay', val, true);
                                  }}
                                  className="w-12 bg-transparent text-xs font-mono font-bold text-slate-900 text-center focus:outline-none"
                                />
                                <span className="text-[11px] font-bold text-slate-400 select-none ml-1">sec</span>
                              </div>

                              {/* Toggle Switch */}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentVal = (activeServer.settings?.joinDelay ?? 0) > 0;
                                  const newVal = currentVal ? 0 : 5;
                                  handleUpdateServerSetting('joinDelay', newVal, true);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  (activeServer.settings?.joinDelay ?? 0) > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    (activeServer.settings?.joinDelay ?? 0) > 0 ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Auto reconnect delay */}
                          <div className="flex items-center justify-between pt-3">
                            <div className="flex-1 pr-4">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>Auto reconnect delay</span>
                              </label>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                Wait duration before attempting to reconnect after being disconnected or kicked.
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={300}
                                  value={Math.round((activeServer.settings?.autoReconnectDelay || 5000) / 1000)}
                                  onChange={(e) => {
                                    const sec = Math.max(1, parseInt(e.target.value, 10) || 5);
                                    const ms = sec * 1000;
                                    handleUpdateServerSetting('autoReconnectDelay', ms, true);
                                  }}
                                  className="w-12 bg-transparent text-xs font-mono font-bold text-slate-900 text-center focus:outline-none"
                                />
                                <span className="text-[11px] font-bold text-slate-400 select-none ml-1">sec</span>
                              </div>

                              {/* Toggle Switch */}
                              <button
                                type="button"
                                onClick={() => {
                                  const isEnabled = activeServer.autoReconnect ?? activeServer.settings?.autoReconnect ?? true;
                                  handleToggleServerSetting('autoReconnect', !isEnabled);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  (activeServer.autoReconnect ?? activeServer.settings?.autoReconnect ?? true)
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    (activeServer.autoReconnect ?? activeServer.settings?.autoReconnect ?? true)
                                      ? 'translate-x-5'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dangerous settings Card */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">Dangerous settings</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Settings for this server profile that are easy to get wrong and hard to undo.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDangerousSettingsOpen(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer shadow-2xs shrink-0"
                        >
                          Manage dangerous settings
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
