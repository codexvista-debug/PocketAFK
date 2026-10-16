'use client';

import React, { useState } from 'react';
import { Account } from '../types';
import { X, UserPlus, Server, Trash2, CheckCircle2 } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  activeAccountId: string | null;
  onSelectAccount: (account: Account) => void;
  onAddAccount: (acc: Omit<Account, 'id'>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accounts,
  activeAccountId,
  onSelectAccount,
  onAddAccount,
  onDeleteAccount
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'microsoft' | 'offline'>('microsoft');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('25565');
  const [serverVersion, setServerVersion] = useState('auto');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !serverHost.trim()) return;

    setLoading(true);
    try {
      await onAddAccount({
        username: username.trim(),
        auth_type: authType,
        server_host: serverHost.trim(),
        server_port: parseInt(serverPort, 10) || 25565,
        server_version: serverVersion.trim() || 'auto',
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
      });
      setShowAddForm(false);
      setUsername('');
      setServerHost('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">Bot Accounts & Servers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!showAddForm ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-semibold">
                  {accounts.length} configured account{accounts.length === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Account
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                  No bot profiles configured yet. Click "Add Account" to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acc) => {
                    const isSelected = acc.id === activeAccountId;
                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          onClick={() => onSelectAccount(acc)}
                          className="cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">
                              {acc.username}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                              {acc.auth_type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {acc.server_host}:{acc.server_port}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mr-2">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => onSelectAccount(acc)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
                            >
                              Select
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteAccount(acc.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Add Form */
            <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-900 pb-1 border-b border-slate-200">
                New Bot Configuration
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Minecraft Username / Email</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. MyAfkBot"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={authType}
                    onChange={(e: any) => setAuthType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  >
                    <option value="microsoft">Microsoft (Official)</option>
                    <option value="offline">Offline / Cracked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Minecraft Version</label>
                  <input
                    type="text"
                    value={serverVersion}
                    onChange={(e) => setServerVersion(e.target.value)}
                    placeholder="auto or 1.20.4"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Server Host / IP</label>
                  <input
                    type="text"
                    required
                    value={serverHost}
                    onChange={(e) => setServerHost(e.target.value)}
                    placeholder="play.example.com"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={serverPort}
                    onChange={(e) => setServerPort(e.target.value)}
                    placeholder="25565"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
