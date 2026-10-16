'use client';

import React, { useState } from 'react';
import { Account } from '../types';
import { X, UserPlus, Trash2, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

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
  const [minecraftEmail, setMinecraftEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minecraftEmail.trim()) return;

    setLoading(true);
    try {
      await onAddAccount({
        username: minecraftEmail.trim(), // Minecraft Microsoft Email
        auth_type: 'microsoft',          // 100% Official Java locked
        server_host: 'play.example.com', // Placeholder for now
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
      });
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
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Minecraft Accounts</h2>
              <span className="text-[11px] text-emerald-700 font-medium">Official Java Edition (Microsoft Auth)</span>
            </div>
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
                <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">No Minecraft accounts added yet</div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Click "Add Account" to connect your official Java Minecraft email.
                  </p>
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
                            ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-400/20'
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                              Java Official
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Microsoft Auth Protected
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
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
                            >
                              Select
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
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
                <div className="text-xs font-bold text-slate-900">Add Minecraft Account</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Enter the email associated with your official Minecraft Java account.
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
                    placeholder="e.g. player@outlook.com or gmail.com"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Locked to Official Java Badge */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Account Type: <b>Official Java (Microsoft Login)</b></span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !minecraftEmail.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {loading ? 'Adding...' : 'Save Account'}
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
