'use client';

import React, { useState, useEffect } from 'react';
import { useDaemonSocket } from '../lib/useDaemonSocket';
import { Account, BotSettings } from '../types';
import { Header } from '../components/Header';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { QuickCommands } from '../components/QuickCommands';
import { Terminal } from '../components/Terminal';
import { ContainerModal } from '../components/ContainerModal';
import { SettingsModal } from '../components/SettingsModal';
import { AccountModal } from '../components/AccountModal';
import { supabase } from '../lib/supabaseClient';
import { Swords, Shield, Zap, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

const DEFAULT_BOT_SETTINGS: BotSettings = {
  physics: true,               // Default: ON
  acceptResourcePacks: true,   // Default: ON
  autoEat: false,              // Default: OFF (as requested)
  autoTotem: false,            // Default: OFF (as requested)
  antiAfk: true,               // Default: ON
  antiAfkInterval: 10,
  mobFarm: false,              // Default: OFF
  mobFarmRange: 3.5,
  mobFarmIntervalMs: 650,
  autoReconnect: true,
  autoReconnectDelay: 5000,
};

export default function Dashboard() {
  const {
    status: socketStatus,
    botState,
    botStateReason,
    messages,
    telemetry,
    containerWindow,
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
  } = useDaemonSocket();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [botSettings, setBotSettings] = useState<BotSettings>(DEFAULT_BOT_SETTINGS);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [autoSynced, setAutoSynced] = useState(false);

  // Auto-sync tunnel URL from Termux API or URL search params
  useEffect(() => {
    async function syncTunnel() {
      if (typeof window === 'undefined') return;

      // 1. Check if opened with ?tunnel=wss://...
      const urlParams = new URLSearchParams(window.location.search);
      const queryTunnel = urlParams.get('tunnel');
      if (queryTunnel && queryTunnel.startsWith('wss://')) {
        saveSettings(queryTunnel, authToken);
        setAutoSynced(true);
        // Clean query param from URL bar
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // 2. Automatically poll /api/tunnel for active Termux session
      try {
        const res = await fetch('/api/tunnel', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.url && data.url.startsWith('wss://') && data.url !== daemonUrl) {
            saveSettings(data.url, data.token || authToken);
            setAutoSynced(true);
          }
        }
      } catch (e) {
        // ignore network error
      }
    }

    syncTunnel();
  }, [daemonUrl, authToken, saveSettings]);

  // Load accounts from Supabase or localStorage fallback
  useEffect(() => {
    async function loadAccounts() {
      if (supabase) {
        try {
          const { data, error } = await supabase.from('accounts').select('*');
          if (data && data.length > 0 && !error) {
            setAccounts(data);
            setActiveAccount(data[0]);
            return;
          }
        } catch (e) {
          console.warn('Failed to load accounts from Supabase, checking local storage');
        }
      }

      // Local storage fallback
      const stored = localStorage.getItem('pocketafk_local_accounts');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setAccounts(parsed);
          if (parsed.length > 0) setActiveAccount(parsed[0]);
          return;
        } catch (e) {
          // ignore
        }
      }

      // Default initial starter account if completely empty
      const defaultAcc: Account = {
        id: 'starter-1',
        username: 'MyPlayer',
        auth_type: 'microsoft',
        server_host: 'play.example.com',
        server_port: 25565,
        server_version: 'auto',
        auto_reconnect: true,
        anti_afk: { enabled: true, interval: 10 },
        survival: { autoEat: false, autoTotem: false },
        mob_farm: { enabled: false, targetRange: 3.5, attackCooldownMs: 650 },
        settings: {
          physics: true,
          acceptResourcePacks: true,
          muteErrors: false,
          autoDisconnectOnBan: false
        }
      };
      setAccounts([defaultAcc]);
      setActiveAccount(defaultAcc);
    }

    loadAccounts();
  }, []);

  const handleAddAccount = async (newAccData: Omit<Account, 'id'>) => {
    const newAccount: Account = {
      ...newAccData,
      id: Math.random().toString(36).substring(2, 10),
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('accounts').insert([newAccount]).select().single();
        if (data && !error) {
          setAccounts((prev) => [...prev, data]);
          setActiveAccount(data);
          return;
        }
      } catch (e) {
        console.warn('Supabase insert failed, storing locally');
      }
    }

    const updated = [...accounts, newAccount];
    setAccounts(updated);
    setActiveAccount(newAccount);
    localStorage.setItem('pocketafk_local_accounts', JSON.stringify(updated));
  };

  const handleDeleteAccount = async (id: string) => {
    if (supabase) {
      try {
        await supabase.from('accounts').delete().eq('id', id);
      } catch (e) {
        // ignore
      }
    }

    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    localStorage.setItem('pocketafk_local_accounts', JSON.stringify(updated));
    if (activeAccount?.id === id) {
      setActiveAccount(updated[0] || null);
    }
  };

  const handleUpdateBotSettings = (updated: Partial<BotSettings>) => {
    const next = { ...botSettings, ...updated };
    setBotSettings(next);
    if (activeAccount) {
      updateSettings(activeAccount.id, next);
    }
  };

  const handleStartBot = () => {
    if (!activeAccount) return;
    startBot({
      id: activeAccount.id,
      username: activeAccount.username,
      authType: activeAccount.auth_type,
      host: activeAccount.server_host,
      port: activeAccount.server_port,
      version: activeAccount.server_version,
      settings: botSettings,
    });
  };

  const handleStopBot = () => {
    if (!activeAccount) return;
    stopBot(activeAccount.id);
  };

  const handleRestartBot = () => {
    if (!activeAccount) return;
    restartBot(activeAccount.id);
  };

  const handleSendMessage = (msg: string) => {
    if (!activeAccount) return;
    sendChat(activeAccount.id, msg);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navigation Header */}
      <Header
        socketStatus={socketStatus}
        botState={botState}
        activeAccount={activeAccount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAccounts={() => setIsAccountsOpen(true)}
        onStartBot={handleStartBot}
        onStopBot={handleStopBot}
        onRestartBot={handleRestartBot}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* Auto-Sync Confirmation Banner */}
        {autoSynced && socketStatus === 'AUTHENTICATED' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
            <span className="flex items-center gap-2 font-bold">
              ✨ Auto-Synced with Termux! Tunnel paired automatically.
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
                <b>Termux Bridge Not Connected:</b> Run the 1-click command in Termux to connect automatically.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText("pkg update -y && pkg install git nodejs-lts cloudflared -y && rm -rf PocketAFK && git clone https://github.com/codexvista-debug/PocketAFK.git && cd PocketAFK/daemon && npm install && bash start.sh");
                  alert("Copied Termux 1-click command to clipboard!");
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

        {/* Top HUD: Health, Food, Coordinates, Dimension */}
        <TelemetryHUD telemetry={telemetry} />

        {/* Feature Quick Toggles Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Physics Badge/Toggle */}
            <button
              onClick={() => handleUpdateBotSettings({ physics: !botSettings.physics })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                botSettings.physics
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Physics: {botSettings.physics ? 'ON' : 'OFF'}
            </button>

            {/* Resource Packs */}
            <button
              onClick={() => handleUpdateBotSettings({ acceptResourcePacks: !botSettings.acceptResourcePacks })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                botSettings.acceptResourcePacks
                  ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Resource Packs: {botSettings.acceptResourcePacks ? 'Auto' : 'Off'}
            </button>

            {/* Mob Farm / Auto Attack */}
            <button
              onClick={() => handleUpdateBotSettings({ mobFarm: !botSettings.mobFarm })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                botSettings.mobFarm
                  ? 'bg-red-50 border-red-300 text-red-700 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Mob Farm: {botSettings.mobFarm ? 'ACTIVE' : 'OFF'}
            </button>

            {/* Auto Eat */}
            <button
              onClick={() => handleUpdateBotSettings({ autoEat: !botSettings.autoEat })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                botSettings.autoEat
                  ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              Auto-Eat: {botSettings.autoEat ? 'ON' : 'OFF'}
            </button>

            {/* Auto Totem */}
            <button
              onClick={() => handleUpdateBotSettings({ autoTotem: !botSettings.autoTotem })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                botSettings.autoTotem
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Auto-Totem: {botSettings.autoTotem ? 'ON' : 'OFF'}
            </button>
          </div>

          <span className="text-slate-500 text-[11px] font-mono">
            {botStateReason || (botState === 'SPAWNED' ? 'Bot operational' : 'Standby')}
          </span>
        </div>

        {/* 1-Click Quick Commands Bar */}
        <QuickCommands
          onSendCommand={handleSendMessage}
          disabled={botState !== 'SPAWNED' && botState !== 'LOGGED_IN'}
        />

        {/* Live Terminal Console */}
        <Terminal
          messages={messages}
          onSendMessage={handleSendMessage}
          onClear={clearMessages}
          disabled={botState !== 'SPAWNED' && botState !== 'LOGGED_IN'}
        />
      </main>

      {/* Interactive Chest / Menu Modal (triggers when server opens GUI) */}
      <ContainerModal
        window={containerWindow}
        onClose={() => {
          if (activeAccount && containerWindow) {
            closeWindow(activeAccount.id, containerWindow.windowId);
          }
        }}
        onClickSlot={(slot, mouseButton) => {
          if (activeAccount && containerWindow) {
            clickSlot(activeAccount.id, containerWindow.windowId, slot, mouseButton || 0);
          }
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        daemonUrl={daemonUrl}
        authToken={authToken}
        onSaveDaemonSettings={saveSettings}
        botSettings={botSettings}
        onUpdateBotSettings={handleUpdateBotSettings}
      />

      {/* Accounts & Server Profiles Modal */}
      <AccountModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccount?.id || null}
        onSelectAccount={(acc) => setActiveAccount(acc)}
        onAddAccount={handleAddAccount}
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}
