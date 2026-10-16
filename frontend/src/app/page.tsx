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
  Minus,
  Server, 
  Globe, 
  ShieldCheck, 
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
  Heart,
  Utensils,
  Terminal as TerminalIcon,
  Check,
  Copy,
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

type MainView = 'profile' | 'servers' | 'accounts';
type SubTab = 'connect' | 'chat' | 'movement' | 'inventory' | 'pov' | 'settings';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_user') || null;
    }
    return null;
  });
  const [secretCode, setSecretCode] = useState<string>('');
  const [accountConnections, setAccountConnections] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('pocketafk_connections');
      if (stored) setAccountConnections(JSON.parse(stored));
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
      // Find the account targeted by botId or username/email
      const targetAcc = prevAccounts.find(
        (acc) =>
          acc.id === data.botId ||
          acc.username.toLowerCase() === data.email.toLowerCase() ||
          (acc.expectedIgn && acc.expectedIgn.toLowerCase() === data.email.toLowerCase())
      );

      // Expected Minecraft IGN
      const expectedName =
        targetAcc?.expectedIgn ||
        (targetAcc && !targetAcc.username.includes('@') ? targetAcc.username : null);

      // ACCOUNT MISMATCH GUARD: Check if targeted account was expecting a different name
      if (expectedName && expectedName.toLowerCase() !== data.ign.toLowerCase()) {
        const errorText = `Account mismatch: Authenticated as '${data.ign}', but expected '${expectedName}'. Verification aborted.`;
        showToast(errorText, 'error');

        const updatedWithMismatch = prevAccounts.map((acc) => {
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
      const alreadyLinked = prevAccounts.find(
        (acc) =>
          acc.id !== targetAcc?.id &&
          ((acc.ign && acc.ign.toLowerCase() === data.ign.toLowerCase()) ||
           (acc.uuid && data.uuid && acc.uuid === data.uuid))
      );

      if (alreadyLinked) {
        showToast(`Account '@${data.ign}' is already linked to your profile!`, 'error');
        if (targetAcc) {
          const updatedWithDup = prevAccounts.map((acc) => {
            if (acc.id === targetAcc.id) {
              return {
                ...acc,
                verified: false,
                authError: `Verification failed: Microsoft account '@${data.ign}' is already linked.`,
              };
            }
            return acc;
          });
          const userKey = currentUser ? `pocketafk_accounts_${currentUser}` : 'pocketafk_accounts_guest';
          if (typeof window !== 'undefined') {
            localStorage.setItem(userKey, JSON.stringify(updatedWithDup));
          }
          return updatedWithDup;
        }
        return prevAccounts;
      }

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
            authError: undefined,
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
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

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
        if (res.ok && isMounted) {
          const data = await res.json();
          const targetUrl = (data?.url || data?.tunnel_url || '').trim();
          if (targetUrl && targetUrl.startsWith('wss://')) {
            if (targetUrl !== daemonUrl) {
              console.log('[PocketAFK] Auto-syncing discovered daemon tunnel:', targetUrl);
              saveSettings(targetUrl, authToken);
              setAutoSynced(true);
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }

    syncTunnel();

    // If socket is not authenticated, poll /api/tunnel every 3 seconds so the phone's 1-click startup automatically links!
    if (socketStatus !== 'AUTHENTICATED') {
      pollInterval = setInterval(syncTunnel, 3000);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentUser, effectiveUser, authToken, daemonUrl, socketStatus, saveSettings]);

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
            .filter((a: any) => !a.id.startsWith('starter-') && (a.verified === true || Boolean(a.authError)))
            .map((a: any) => {
              const cleanIgn = (a.ign && !a.ign.includes('@'))
                ? a.ign
                : (!a.username.includes('@') ? a.username : 'Player');
              const key = cleanIgn.trim().toLowerCase();
              if (key && seenIgns.has(key)) {
                return {
                  ...a,
                  username: cleanIgn,
                  ign: cleanIgn,
                  verified: false,
                  authError: `Duplicate of @${cleanIgn}. Click Re-link to authenticate with your intended Microsoft account (e.g. V3locitz).`,
                };
              }
              if (key) seenIgns.add(key);
              return {
                ...a,
                username: cleanIgn,
                ign: cleanIgn,
              };
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

  // Microsoft OAuth Device Code Sign-In with Target Identity Verification Guard
  const handleStartMicrosoftLogin = async (target?: MinecraftAccount | string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    if (accounts.filter((a) => a.verified).length >= 5 && !target) {
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
        botId: typeof target === 'object' && target ? target.id : 'new_account',
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

            // Check if user targeted a specific account or expected IGN
            const expectedName =
              typeof target === 'string'
                ? target
                : (target?.expectedIgn || target?.ign || (!target?.username?.includes('@') ? target?.username : null));

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
              const dupMsg = `Account '@${finalIgn}' is already linked to PocketAFK.`;
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

  // Accounts assigned to current Server Profile
  const profileAccountIds = useMemo(() => {
    if (!activeServer) return [];
    if (Array.isArray(activeServer.assignedAccountIds)) {
      return activeServer.assignedAccountIds;
    }
    // Default fallback: if accountId is set, assign it, otherwise all linked accounts
    return activeServer.accountId ? [activeServer.accountId] : accounts.map((a) => a.id);
  }, [activeServer, accounts]);

  const assignedAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (!profileAccountIds.includes(a.id)) return false;
      const q = accountFilter.toLowerCase().trim();
      if (!q) return true;
      const ign = (a.ign || a.username).toLowerCase();
      const note = (accountNotes[a.id] || '').toLowerCase();
      return ign.includes(q) || note.includes(q);
    });
  }, [accounts, profileAccountIds, accountFilter, accountNotes]);

  const availableAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (profileAccountIds.includes(a.id)) return false;
      const q = accountFilter.toLowerCase().trim();
      if (!q) return true;
      const ign = (a.ign || a.username).toLowerCase();
      const note = (accountNotes[a.id] || '').toLowerCase();
      return ign.includes(q) || note.includes(q);
    });
  }, [accounts, profileAccountIds, accountFilter, accountNotes]);

  const handleRemoveAccountFromProfile = (accId: string) => {
    if (!activeServer) return;
    const targetAcc = accounts.find((a) => a.id === accId);
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/50 via-slate-50 to-sky-100/40 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20">
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
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-white text-3xl shadow-lg shadow-emerald-500/20 mx-auto">
              P
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">PocketAFK</h1>
              <p className="text-xs text-slate-600 leading-relaxed">
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
          {/* LEFT SIDEBAR */}
          <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-2xs">
            {/* Logo Bar */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center font-black text-sm shadow-2xs">
                  P
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 tracking-tight">PocketAFK</span>
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
                    ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Server className="w-4 h-4 text-emerald-600" />
                Servers
              </button>

              <button
                onClick={() => setActiveMainView('accounts')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeMainView === 'accounts'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Accounts
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
                  {accounts.length}/5
                </span>
              </button>
            </div>

            <div className="border-t border-slate-200 my-1" />

            {/* Server Profiles Section */}
            <div className="p-3 flex-1 overflow-y-auto space-y-1">
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                  className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
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
                          ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0">
                          {srv.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{srv.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 shrink-0">
                        <Radio className={`w-3 h-3 ${isRunning ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{isRunning ? '1' : '0'}/1</span>
                      </div>
                    </button>

                    {/* Sub-Feature Tabs */}
                    {isSelected && activeMainView === 'profile' && (
                      <div className="ml-3 pl-3 border-l border-slate-200 space-y-0.5 pt-0.5">
                        <button
                          onClick={() => setActiveSubTab('connect')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'connect'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Home className="w-3.5 h-3.5" />
                          Connect
                        </button>

                        <button
                          onClick={() => setActiveSubTab('chat')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'chat'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat
                        </button>

                        <button
                          onClick={() => setActiveSubTab('movement')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'movement'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5" />
                          Movement
                        </button>

                        <button
                          onClick={() => setActiveSubTab('inventory')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'inventory'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Box className="w-3.5 h-3.5" />
                          Inventory
                        </button>

                        <button
                          onClick={() => setActiveSubTab('pov')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'pov'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          POV
                        </button>

                        <button
                          onClick={() => setActiveSubTab('settings')}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            activeSubTab === 'settings'
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
            <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-800 font-mono truncate">
                  @{effectiveUser}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto">
            {/* Top Navigation & Status Bar */}
            <header className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold">
                {activeMainView === 'profile' ? (
                  <>
                    <span className="text-slate-500">{activeServer?.name || 'Server'}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-emerald-700 uppercase tracking-wider">{activeSubTab}</span>
                  </>
                ) : (
                  <span className="text-emerald-700 uppercase tracking-wider">{activeMainView}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Termux Tunnel Status */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      socketStatus === 'AUTHENTICATED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-slate-700">
                    {socketStatus === 'AUTHENTICATED' ? 'Daemon Online' : 'Daemon Offline'}
                  </span>
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
                          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500/50 transition cursor-pointer space-y-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm text-slate-900">{srv.name}</span>
                            {getStatusBadge(srvState)}
                          </div>
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>{srv.serverHost}:{srv.serverPort}</span>
                          </div>
                          {assigned && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <div className="w-5 h-5 rounded-xs overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                <img
                                  src={`https://crafthead.net/helm/${encodeURIComponent((assigned.uuid || assigned.ign || assigned.username).split('@')[0])}/32`}
                                  alt={assigned.ign || assigned.username}
                                  className="w-full h-full object-cover [image-rendering:pixelated]"
                                />
                              </div>
                              <span className="text-xs text-slate-800 font-bold">{assigned.ign || assigned.username}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW: DEDICATED ACCOUNTS PAGE */}
              {activeMainView === 'accounts' && (
                <div className="space-y-4">
                  {/* Top Bar: Title, Add Account Button, and Filter */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Accounts</h2>
                      <p className="text-xs text-slate-500">Manage all your verified Microsoft Java Minecraft accounts.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleStartMicrosoftLogin()}
                        disabled={accounts.length >= 5}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition shadow-xs cursor-pointer"
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

                  {/* Accounts Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="p-3.5 w-12 text-center">
                            <span className="font-mono text-slate-700 font-bold">{accounts.length}</span>
                          </th>
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
                            <td colSpan={6} className="p-12 text-center text-slate-500">
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
                                  {/* Checkbox */}
                                  <td className="p-3.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedAccountIds.includes(acc.id)}
                                      onChange={() => handleAccountCheckbox(acc.id)}
                                      className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                                    />
                                  </td>

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
              )}

              {/* VIEW: PROFILE SUB-TABS */}
              {activeMainView === 'profile' && activeServer && (
                <>
                  {/* SUB-TAB 1: CONNECT */}
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
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter accounts..."
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Accounts Table for this Server Profile */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <table className="w-full text-left text-xs">
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
                              <th className="p-3">Note</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {assignedAccounts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
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
                                const isAssignedActive = activeAccount?.id === acc.id;
                                const currentBotState = isAssignedActive ? botState : 'DISCONNECTED';
                                const isPinned = pinnedAccountIds.includes(acc.id);

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
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                                          Failed
                                        </span>
                                      ) : (
                                        getStatusBadge(currentBotState)
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        placeholder="Add Note"
                                        value={accountNotes[acc.id] || ''}
                                        onChange={(e) => handleUpdateNote(acc.id, e.target.value)}
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

                                        {isAssignedActive && isActiveServerRunning ? (
                                          <button
                                            onClick={() => handleStopServer(activeServer.id)}
                                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
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
                                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition cursor-pointer"
                                            title="Connect this account"
                                          >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                          </button>
                                        )}

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

                      {/* Available Accounts to Add (+) to this Server Profile */}
                      {availableAccounts.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-slate-700">Available Accounts (Not in this profile)</span>
                            <span className="text-[11px] text-slate-400 font-medium">Click &ldquo;+ Add to Profile&rdquo; to assign</span>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                            <table className="w-full text-left text-xs">
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
                                        value={accountNotes[acc.id] || ''}
                                        onChange={(e) => handleUpdateNote(acc.id, e.target.value)}
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Chat receivers:</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-emerald-700 shadow-2xs">
                            {activeAccount?.ign || activeAccount?.username || 'All accounts'}
                          </span>
                        </div>
                      </div>

                      {/* In-Game Minecraft Styled Console */}
                      <div className="h-[540px]">
                        <Terminal
                          messages={messages}
                          onSendMessage={(msg) => sendChat(activeServer.id, msg)}
                          onClear={() => clearMessages(activeServer.id)}
                          disabled={!isActiveServerRunning}
                          serverName={activeServer.name}
                          serverHost={activeServer.serverHost}
                          serverPort={activeServer.serverPort}
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
                            <h3 className="font-bold text-sm text-slate-900">{containerWindow.title || 'Chest / Menu'}</h3>
                            <span className="text-xs font-mono text-emerald-700 font-bold">Window #{containerWindow.windowId}</span>
                          </div>

                          <div className="grid grid-cols-9 gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            {containerWindow.slots.map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() => clickSlot(activeServer.id, containerWindow.windowId, idx, 0)}
                                className="aspect-square rounded-lg border border-slate-200 bg-white hover:border-emerald-500 flex items-center justify-center relative cursor-pointer shadow-2xs"
                              >
                                {item && (
                                  <span className="text-[10px] font-mono text-slate-800 truncate px-1">
                                    {item.displayName || item.name}
                                  </span>
                                )}
                              </div>
                            ))}
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
                  {activeSubTab === 'pov' && (
                    <div className="max-w-2xl space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">POV & World Telemetry</h2>
                        <p className="text-xs text-slate-500">Live coordinates, health, hunger, and world dimension data.</p>
                      </div>

                      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5 shadow-xs">
                        {/* Health & Hunger */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-rose-600">
                              <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 fill-current" /> Health</span>
                              <span>{telemetry?.health ?? 20} / 20</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-rose-500 rounded-full"
                                style={{ width: `${Math.min(100, ((telemetry?.health ?? 20) / 20) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-600">
                              <span className="flex items-center gap-1.5"><Utensils className="w-4 h-4" /> Hunger</span>
                              <span>{telemetry?.food ?? 20} / 20</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, ((telemetry?.food ?? 20) / 20) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Coordinates & Dimension */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">X</span>
                            <span className="text-sm font-mono font-bold text-slate-900">{telemetry?.position?.x ?? 0}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Y</span>
                            <span className="text-sm font-mono font-bold text-slate-900">{telemetry?.position?.y ?? 0}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Z</span>
                            <span className="text-sm font-mono font-bold text-slate-900">{telemetry?.position?.z ?? 0}</span>
                          </div>
                        </div>

                        {/* Dimension & Ping */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono">
                          <span className="text-slate-600">Dimension: <b className="text-emerald-700">{telemetry?.dimension || 'Overworld'}</b></span>
                          <span className="text-slate-600">Ping: <b className="text-emerald-700">{telemetry?.ping ?? 0}ms</b></span>
                        </div>
                      </div>
                    </div>
                  )}

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
                            <label className="text-[11px] font-bold text-slate-600">Java version</label>
                            <select
                              value={activeServer.serverVersion}
                              onChange={(e) => handleSaveServer({ ...activeServer, serverVersion: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="auto">Auto Detect</option>
                              <option value="1.20.4">1.20.4</option>
                              <option value="1.20.2">1.20.2</option>
                              <option value="1.20.1">1.20.1</option>
                              <option value="1.19.4">1.19.4</option>
                            </select>
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

                      {/* Extra Settings */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                        <h3 className="font-bold text-sm text-slate-900">Extra settings</h3>

                        {/* Auto Reconnect */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Auto reconnect</span>
                            <span className="text-[11px] text-slate-500">Reconnect bot if kicked or server restarts</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={activeServer.autoReconnect}
                            onChange={(e) => handleSaveServer({ ...activeServer, autoReconnect: e.target.checked })}
                            className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Anti-AFK */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Anti-AFK Actions</span>
                            <span className="text-[11px] text-slate-500">Random pitch, yaw shifts, arm swings and sneaks</span>
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
                            className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Physics */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Physics Engine</span>
                            <span className="text-[11px] text-slate-500">Keep enabled for servers that require gravity & velocity sync</span>
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
                            className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {/* Mob Farm Combat */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Mob Farm Attack</span>
                            <span className="text-[11px] text-slate-500">Auto attack hostile mobs within 3.5 blocks</span>
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
                            className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Dangerous Settings */}
                      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-xs font-bold text-rose-800 block">Delete Server Profile</span>
                          <span className="text-[11px] text-rose-600">Permanently remove this server configuration</span>
                        </div>
                        <button
                          onClick={() => handleDeleteServer(activeServer.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
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
