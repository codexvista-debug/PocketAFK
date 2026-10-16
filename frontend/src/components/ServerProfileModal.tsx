'use client';

import React, { useState, useEffect } from 'react';
import { ServerProfile, MinecraftAccount, BotSettings } from '../types';
import { X, Server, Globe, Cpu, Shield, Sparkles, Swords, Trash2, UserPlus, Check } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ServerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: MinecraftAccount[];
  initialProfile?: ServerProfile | null;
  currentUser?: string | null;
  onSaveProfile: (profile: ServerProfile) => Promise<void>;
  onDeleteProfile?: (profileId: string) => Promise<void>;
  onOpenAddAccount: () => void;
}

const DEFAULT_SETTINGS: BotSettings = {
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

const COMMON_VERSIONS = [
  { label: 'Auto-detect (Recommended)', value: 'auto' },
  { label: '1.21.1 / 1.21', value: '1.21.1' },
  { label: '1.20.4', value: '1.20.4' },
  { label: '1.20.2', value: '1.20.2' },
  { label: '1.20.1', value: '1.20.1' },
  { label: '1.19.4', value: '1.19.4' },
  { label: '1.19.2', value: '1.19.2' },
  { label: '1.18.2', value: '1.18.2' },
  { label: '1.16.5', value: '1.16.5' },
  { label: '1.12.2', value: '1.12.2' },
  { label: '1.8.9', value: '1.8.9' },
];

export const ServerProfileModal: React.FC<ServerProfileModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialProfile,
  currentUser,
  onSaveProfile,
  onDeleteProfile,
  onOpenAddAccount,
}) => {
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState(25565);
  const [serverVersion, setServerVersion] = useState('auto');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name);
      // Robust matching: by id, or by ign/username, or fallback to first account if available
      const matchingAcc = accounts.find((a) => a.id === initialProfile.accountId)
        || accounts.find((a) => (a.ign || a.username).toLowerCase() === (initialProfile.accountId || '').toLowerCase())
        || accounts.find((a) => initialProfile.name.toLowerCase().startsWith((a.ign || a.username).toLowerCase()))
        || accounts[0];
      setAccountId(matchingAcc ? matchingAcc.id : (accounts[0]?.id || ''));
      setServerHost(initialProfile.serverHost);
      setServerPort(initialProfile.serverPort || 25565);
      setServerVersion(initialProfile.serverVersion || 'auto');
      setAutoReconnect(initialProfile.autoReconnect ?? true);
      setSettings(initialProfile.settings || DEFAULT_SETTINGS);
    } else {
      setName('');
      setAccountId(accounts[0]?.id || '');
      setServerHost('');
      setServerPort(25565);
      setServerVersion('auto');
      setAutoReconnect(true);
      setSettings(DEFAULT_SETTINGS);
    }
  }, [initialProfile, accounts, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAccountId = accountId
      || accounts.find((a) => a.id === initialProfile?.accountId)?.id
      || accounts[0]?.id
      || '';

    if (!name.trim() || !serverHost.trim() || !effectiveAccountId) return;

    setLoading(true);
    try {
      const profile: ServerProfile = {
        id: initialProfile?.id || `srv_${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim(),
        pocketUser: currentUser || initialProfile?.pocketUser,
        accountId: effectiveAccountId,
        serverHost: serverHost.trim(),
        serverPort: Number(serverPort) || 25565,
        serverVersion: serverVersion.trim() || 'auto',
        authType: 'microsoft',
        autoReconnect,
        settings,
      };

      await onSaveProfile(profile);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!initialProfile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                {isEditing ? 'Edit Server Instance' : 'Add Server Instance'}
              </h2>
              <span className="text-[11px] text-emerald-700 font-medium">
                Connect your Java account to a Minecraft server
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Server Profile Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Instance / Profile Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DonutSMP Base, Hypixel Lobby, Survival SMP"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs"
            />
          </div>

          {/* Minecraft Account Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">
                Assigned Java Account
              </label>
              <button
                type="button"
                onClick={onOpenAddAccount}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3 h-3" /> Add Account
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center justify-between">
                <span>No Minecraft accounts added yet!</span>
                <button
                  type="button"
                  onClick={onOpenAddAccount}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] cursor-pointer"
                >
                  + Add Account First
                </button>
              </div>
            ) : (
              <select
                value={accountId || accounts[0]?.id || ''}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs cursor-pointer"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.ign || acc.username} {acc.verified ? '✓ Verified' : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              You can connect the <b>same Java account</b> to multiple servers simultaneously.
            </p>
          </div>

          {/* Server Connection: IP & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                Server IP / Host
              </label>
              <input
                type="text"
                required
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="e.g. donutsmp.net or mc.hypixel.net"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Port
              </label>
              <input
                type="number"
                required
                value={serverPort}
                onChange={(e) => setServerPort(Number(e.target.value))}
                placeholder="25565"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs"
              />
            </div>
          </div>

          {/* Minecraft Version */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              Minecraft Version
            </label>
            <select
              value={serverVersion}
              onChange={(e) => setServerVersion(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs cursor-pointer"
            >
              {COMMON_VERSIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              PocketAFK automatically negotiates server version handshake by default.
            </p>
          </div>

          {/* Toggles & Behavior */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <span className="font-bold text-slate-700 block">Server Instance Settings:</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Physics */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.physics}
                  onChange={(e) => setSettings({ ...settings, physics: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Physics (Gravity & Water)</span>
              </label>

              {/* Resource Packs */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.acceptResourcePacks}
                  onChange={(e) => setSettings({ ...settings, acceptResourcePacks: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Auto-Accept Resource Packs</span>
              </label>

              {/* Anti-AFK */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.antiAfk}
                  onChange={(e) => setSettings({ ...settings, antiAfk: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Anti-AFK Movements</span>
              </label>

              {/* Auto Reconnect */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={(e) => setAutoReconnect(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Auto-Reconnect on Kick</span>
              </label>

              {/* Mob Farm */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.mobFarm}
                  onChange={(e) => setSettings({ ...settings, mobFarm: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Mob Farm (Auto-Attack)</span>
              </label>

              {/* Auto Eat */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoEat}
                  onChange={(e) => setSettings({ ...settings, autoEat: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-800 font-medium">Auto-Eat Food</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            {isEditing && onDeleteProfile ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Instance
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !serverHost.trim() || !accountId}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Server'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modern In-App Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Server Instance"
        message={`Are you sure you want to delete server instance "${name}"? This action cannot be undone.`}
        confirmText="Delete Instance"
        cancelText="Keep Server"
        isDestructive
        onConfirm={async () => {
          if (onDeleteProfile && initialProfile) {
            await onDeleteProfile(initialProfile.id);
          }
          setShowDeleteConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
