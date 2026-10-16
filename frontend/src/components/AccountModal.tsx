'use client';

import React, { useState } from 'react';
import { MinecraftAccount } from '../types';
import { X, UserPlus, Trash2, CheckCircle2, ShieldCheck, Mail, AlertTriangle, KeyRound } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: MinecraftAccount[];
  activeAccountId: string | null;
  onSelectAccount: (account: MinecraftAccount) => void;
  onAddAccount: (email: string) => Promise<void>;
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
  const [minecraftEmail, setMinecraftEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minecraftEmail.trim()) return;

    setLoading(true);
    try {
      await onAddAccount(minecraftEmail.trim());
      setShowAddForm(false);
      setMinecraftEmail('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50/90 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Minecraft Accounts</h2>
              <span className="text-[11px] text-emerald-700 font-semibold">Official Java Edition (Microsoft Auth)</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
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
                  {accounts.length} linked account{accounts.length === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Add Account
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">No Minecraft accounts added</div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Add your official Minecraft Microsoft email to begin connecting to servers.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Add Your First Account
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {accounts.map((acc) => {
                    const isSelected = acc.id === activeAccountId;
                    const avatarName = acc.ign || 'MHF_Steve';
                    const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(avatarName)}/36`;

                    return (
                      <div
                        key={acc.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs ring-1 ring-emerald-400/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          onClick={() => onSelectAccount(acc)}
                          className="cursor-pointer flex items-center gap-3 flex-1 min-w-0"
                        >
                          {/* Player Head Skin Avatar */}
                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-300 shrink-0 bg-slate-100 shadow-2xs">
                            <img
                              src={avatarUrl}
                              alt={avatarName}
                              className="w-full h-full object-cover rendering-pixelated"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/36';
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900 truncate">
                                {acc.ign || acc.username}
                              </span>
                              {acc.verified ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  Verified Java
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                  <KeyRound className="w-2.5 h-2.5 text-amber-600" />
                                  Needs Verification
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                              {acc.username}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pl-2 shrink-0">
                          {isSelected ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => onSelectAccount(acc)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              Select
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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
            /* Clean Simplified Add Form (Email Only) */
            <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <div className="text-xs font-bold text-slate-900">Link Minecraft Java Account</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Enter your Microsoft account email. You will receive a 1-time device code to link securely when connecting to a server.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Minecraft Microsoft Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={minecraftEmail}
                    onChange={(e) => setMinecraftEmail(e.target.value)}
                    placeholder="e.g. notch@outlook.com or player@gmail.com"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Official Java Edition Only
                </div>
                <p className="text-emerald-700 leading-normal">
                  Offline/cracked accounts are disabled for anti-ban security. Your verified in-game username and player skin head will appear once linked.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !minecraftEmail.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {loading ? 'Adding...' : 'Add Account'}
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
