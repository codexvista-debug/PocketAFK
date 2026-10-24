'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ServerProfile, MinecraftAccount, BotSettings } from '../types';
import { X, Info, ChevronDown, Check } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ServerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: MinecraftAccount[];
  initialProfile?: ServerProfile | null;
  currentUser?: string | null;
  onSaveProfile: (profile: ServerProfile) => Promise<void>;
  onDeleteProfile?: (profileId: string) => Promise<void>;
  onOpenAddAccount?: () => void;
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
  { label: 'Auto Detect (Recommended)', value: 'auto' },
  { label: '1.21.4 (Latest)', value: '1.21.4' },
  { label: '1.21.3', value: '1.21.3' },
  { label: '1.21.2', value: '1.21.2' },
  { label: '1.21.1', value: '1.21.1' },
  { label: '1.21', value: '1.21' },
  { label: '1.20.6', value: '1.20.6' },
  { label: '1.20.4', value: '1.20.4' },
  { label: '1.20.2', value: '1.20.2' },
  { label: '1.20.1', value: '1.20.1' },
  { label: '1.19.4', value: '1.19.4' },
  { label: '1.18.2', value: '1.18.2' },
  { label: '1.16.5', value: '1.16.5' },
  { label: '1.12.2', value: '1.12.2' },
  { label: '1.8.9', value: '1.8.9' },
];

const POPULAR_SETUPS = [
  { name: 'FreshSMP', host: 'play.freshsmp.fun', port: 25565, version: '1.20.4' },
  { name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '1.20.4' },
  { name: 'Hypixel', host: 'mc.hypixel.net', port: 25565, version: 'auto' },
  { name: 'CubeCraft', host: 'play.cubecraft.net', port: 25565, version: 'auto' },
  { name: 'Lifesteal Network', host: 'play.lifesteal.net', port: 25565, version: '1.20.4' },
  { name: 'MineSeed', host: 'play.mineseed.org', port: 25565, version: 'auto' },
  { name: 'EarthMC', host: 'play.earthmc.net', port: 25565, version: 'auto' },
];

export const ServerProfileModal: React.FC<ServerProfileModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialProfile,
  currentUser,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const [name, setName] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState<string | number>(25565);
  const [serverVersion, setServerVersion] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [showBrowseSetups, setShowBrowseSetups] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const wasOpenRef = useRef(false);
  const activeProfileIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const profileChanged = initialProfile?.id !== activeProfileIdRef.current;

    if (isOpen && (justOpened || profileChanged)) {
      setShowBrowseSetups(false);
      if (initialProfile) {
        setName(initialProfile.name || '');
        setServerHost(initialProfile.serverHost || '');
        setServerPort(initialProfile.serverPort || 25565);
        setServerVersion(initialProfile.serverVersion || 'auto');
      } else {
        setName('');
        setServerHost('');
        setServerPort(25565);
        setServerVersion('auto');
      }
    }

    wasOpenRef.current = isOpen;
    activeProfileIdRef.current = initialProfile?.id;
  }, [isOpen, initialProfile?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverHost.trim()) return;

    const effectiveName = name.trim() || serverHost.trim();
    // For new profiles, do NOT auto-assign any account so all accounts remain available
    const effectiveAccountId = initialProfile ? (initialProfile.accountId || '') : '';
    const effectiveAssignedAccountIds = initialProfile
      ? (initialProfile.assignedAccountIds || (initialProfile.accountId ? [initialProfile.accountId] : []))
      : [];

    setLoading(true);
    try {
      const profile: ServerProfile = {
        id: initialProfile?.id || `srv_${Math.random().toString(36).substring(2, 9)}`,
        name: effectiveName,
        pocketUser: currentUser || initialProfile?.pocketUser,
        accountId: effectiveAccountId,
        assignedAccountIds: effectiveAssignedAccountIds,
        serverHost: serverHost.trim(),
        serverPort: Number(serverPort) || 25565,
        serverVersion: serverVersion || 'auto',
        authType: 'microsoft',
        autoReconnect: initialProfile?.autoReconnect ?? true,
        settings: initialProfile?.settings || DEFAULT_SETTINGS,
      };

      await onSaveProfile(profile);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSetup = (setup: typeof POPULAR_SETUPS[0]) => {
    setServerHost(setup.host);
    setServerPort(setup.port);
    if (!name.trim() || name === 'My Server Profile') {
      setName(setup.name);
    }
    setServerVersion(setup.version);
    setShowBrowseSetups(false);
  };

  const isEditing = !!initialProfile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-base text-slate-900">
              {isEditing ? 'Edit Server Profile' : 'Add a server'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create a profile for the Minecraft server you want to keep accounts online on.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Server IP + Browse setups */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Server IP
            </label>
            <div className="flex gap-2 relative">
              <input
                type="text"
                required
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="Enter a server IP"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowBrowseSetups(!showBrowseSetups)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1"
              >
                <span>Browse setups</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Browse Setups Dropdown Popover */}
              {showBrowseSetups && (
                <div className="absolute right-0 top-12 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Popular Server Setups
                  </div>
                  {POPULAR_SETUPS.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => handleSelectSetup(s)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{s.host}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Profile name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server Profile"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* 2-Column: Java Version & Bedrock Port */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Java version */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <span>Java version</span>
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <select
                value={serverVersion}
                onChange={(e) => setServerVersion(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:bg-white transition cursor-pointer"
              >
                {COMMON_VERSIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Java / Server Port */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <span>Java port</span>
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="25565"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !serverHost.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 ml-auto"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Creating...' : isEditing ? 'Save Changes' : 'Create server'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation if Editing */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Server Profile"
        message={`Are you sure you want to delete server profile "${name}"? This action cannot be undone.`}
        confirmText="Delete Profile"
        cancelText="Cancel"
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
