'use client';

import React, { useState } from 'react';
import { X, Check, Shield, Sparkles, Layers, Users, Lock, Info } from 'lucide-react';
import { RANKS, RANK_ORDER, UserRank, RankConfig } from '../lib/ranks';

interface RankModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRank: UserRank;
  onSelectRank?: (rank: UserRank) => Promise<void>;
  currentAccountCount: number;
}

export const RankModal: React.FC<RankModalProps> = ({
  isOpen,
  onClose,
  currentRank,
  currentAccountCount,
}) => {
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestUpgrade = (rank: UserRank) => {
    const cfg = RANKS[rank];
    setAdminNotice(
      `Rank upgrades must be assigned by an administrator. Please reach out to @Chief or an admin to request the ${cfg?.name || rank} tier.`
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Account Ranks</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Active: {RANKS[currentRank]?.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                AFK bot capacity tiers. Rank upgrades and assignments are managed by administrators.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setAdminNotice(null);
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Notice Banner if user tries to self-upgrade */}
        {adminNotice && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in slide-in-from-top-1">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{adminNotice}</div>
            <button
              onClick={() => setAdminNotice(null)}
              className="text-amber-500 hover:text-amber-700 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content: 4 Rank Cards */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {RANK_ORDER.map((rId) => {
              const cfg = RANKS[rId];
              const isCurrent = currentRank === rId;

              return (
                <div
                  key={rId}
                  className={`relative rounded-2xl p-5 border flex flex-col justify-between transition duration-200 shadow-2xs ${
                    isCurrent
                      ? `${cfg.cardBorder} bg-gradient-to-b from-white to-slate-50/80 ring-2 ring-emerald-500 shadow-md`
                      : `bg-white ${cfg.cardBorder} hover:shadow-md`
                  }`}
                >
                  {/* Top Mineral Header */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cfg.gemIcon}</span>
                        <span className="font-black text-sm text-slate-900 uppercase tracking-wide">
                          {cfg.name}
                        </span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Admin
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <div className="text-2xl font-black text-slate-900">
                        {cfg.maxAccounts}
                        <span className="text-xs font-semibold text-slate-500 ml-1">
                          {cfg.maxAccounts === 1 ? 'Account' : 'Accounts'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {cfg.summary}
                      </p>
                    </div>

                    {/* Features list */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      {cfg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-3 border-t border-slate-100">
                    {isCurrent ? (
                      <div className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1.5 shadow-2xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Current Rank</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRequestUpgrade(rId)}
                        className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer hover:border-slate-300"
                      >
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Admin Upgrade</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom info banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-emerald-950 block">
                  Your Account Allocation: {currentAccountCount} / {RANKS[currentRank]?.maxAccounts}
                </span>
                <span className="text-emerald-800 text-[11px]">
                  Ranks determine your max concurrent Minecraft bot capacity. Upgrades are configured by your administrator.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
