'use client';

import React, { useState, useMemo } from 'react';
import { MinecraftAccount } from '../types';
import { X, UserPlus, Trash2, CheckCircle2, ShieldCheck, Sparkles, ExternalLink, KeyRound } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: MinecraftAccount[];
  onStartMicrosoftLogin: () => void;
  onDeleteAccount: (id: string) => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onStartMicrosoftLogin,
  onDeleteAccount,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<MinecraftAccount | null>(null);

  // STRICT DEDUPLICATION: Ensure no duplicate IGN accounts are displayed
  const uniqueVerifiedAccounts = useMemo(() => {
    const seen = new Set<string>();
    const result: MinecraftAccount[] = [];
    for (const acc of accounts) {
      if (!acc.verified) continue;
      const key = (acc.ign || acc.username || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(acc);
    }
    return result;
  }, [accounts]);

  if (!isOpen) return null;

  const MAX_ACCOUNTS = 5;
  const isLimitReached = uniqueVerifiedAccounts.length >= MAX_ACCOUNTS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Minecraft Accounts</h2>
              <span className="text-[11px] text-emerald-700 font-semibold">Official Java Edition (Microsoft Linked)</span>
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
                  {uniqueVerifiedAccounts.length}/5 accounts {isLimitReached ? '(Limit Reached)' : 'linked'}
                </span>
                <button
                  disabled={isLimitReached}
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  title={isLimitReached ? 'Maximum of 5 accounts reached' : 'Add Account'}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {isLimitReached ? '5/5 Limit' : '+ Add Account'}
                </button>
              </div>

              {uniqueVerifiedAccounts.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">No linked Minecraft accounts yet</div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Link your official Minecraft Java account with one-click Microsoft sign-in.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    + Add Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {uniqueVerifiedAccounts.map((acc) => {
                    const avatarName = acc.ign || acc.username || 'MHF_Steve';
                    const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(avatarName)}/36`;

                    return (
                      <div
                        key={acc.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between gap-3 transition shadow-2xs"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Player Head Skin Avatar */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0 bg-slate-100 shadow-2xs">
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs text-slate-900 truncate">
                                {acc.ign || acc.username}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Verified Java
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                              Java Edition &bull; Synced with Supabase & Termux
                            </div>
                          </div>
                        </div>

                        {/* Actions: ONLY Delete Icon */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setDeletingAccount(acc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Unlink Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* VistaAFK-Style One-Click Microsoft Sign-In (NO username/email inputs!) */
            <div className="space-y-4 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <KeyRound className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Official Microsoft Authentication
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Sign in with your Microsoft account (normal or incognito/private tab). We automatically retrieve your official Minecraft Java username, skin head, and UUID.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-left text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  No Username or Password Required
                </div>
                <p className="text-emerald-700 leading-normal">
                  You never enter your credentials on PocketAFK. Microsoft handles authentication safely on their official servers.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    onStartMicrosoftLogin();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Login with Microsoft</span>
                </button>
              </div>
            </div>
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

      {/* Modern In-App Confirm Unlink Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingAccount)}
        title="Unlink Minecraft Account"
        message={`Are you sure you want to unlink @${deletingAccount?.ign || deletingAccount?.username}? This will remove it from PocketAFK and Termux.`}
        confirmText="Unlink Account"
        cancelText="Cancel"
        isDestructive
        onConfirm={async () => {
          if (deletingAccount) {
            await onDeleteAccount(deletingAccount.id);
          }
          setDeletingAccount(null);
        }}
        onCancel={() => setDeletingAccount(null)}
      />
    </div>
  );
};
