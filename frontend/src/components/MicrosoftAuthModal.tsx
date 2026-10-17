'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Copy, CheckCircle2, KeyRound, AlertTriangle, Loader2, LogOut } from 'lucide-react';

interface MicrosoftAuthModalProps {
  authData: {
    botId: string;
    userCode: string;
    url: string;
    message?: string;
  } | null;
  accountEmail?: string;
  isPolling?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
}

export const MicrosoftAuthModal: React.FC<MicrosoftAuthModalProps> = ({
  authData,
  accountEmail,
  isPolling,
  errorMessage,
  onClose
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!authData) return null;

  // Ensure prompt=select_account is always present so Microsoft never auto-confirms an already-active session
  let forceAccountUrl = authData.url || 'https://www.microsoft.com/link';
  if (!forceAccountUrl.includes('prompt=')) {
    forceAccountUrl += (forceAccountUrl.includes('?') ? '&' : '?') + 'prompt=select_account';
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(authData.userCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(forceAccountUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Microsoft Authentication</h2>
              <span className="text-[11px] text-emerald-700 font-semibold">1-Time Device Link</span>
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
        <div className="p-6 space-y-4 text-center overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-0.5">
                <span className="block font-bold">Verification Error</span>
                <span className="font-normal text-[11px] leading-relaxed">{errorMessage}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            Microsoft requires you to verify ownership of your Minecraft account. Enter this code at the Microsoft link below:
          </p>

          {/* Big Code Card */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Your Verification Code:
            </span>
            <div className="font-mono text-3xl sm:text-4xl font-black text-amber-400 tracking-widest select-all">
              {authData.userCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer shadow-xs"
            >
              {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Code Copied!' : 'Copy Code'}
            </button>
          </div>

          {/* Polling / Waiting Indicator */}
          {isPolling && !errorMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              <span>Waiting for approval on Microsoft... (Auto-detecting)</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <a
              href={forceAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
            >
              <ExternalLink className="w-4 h-4" />
              Open Microsoft Login Page
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="https://login.live.com/logout.srf"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition border border-amber-200 cursor-pointer flex items-center justify-center gap-1.5"
                title="Log out of current Microsoft account in browser"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-700" />
                <span>Sign Out of Microsoft</span>
              </a>

              <button
                onClick={handleCopyLink}
                className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition border border-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied!' : 'Copy Private Link'}
              </button>
            </div>
          </div>

          {/* Multi-Account Advice Box */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-left space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Adding a 2nd or 3rd Account?</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              If your browser automatically logs you into an already-linked account, click <b>Sign Out of Microsoft</b> above or paste the link into an <b>Incognito / Private tab</b> so you can enter the credentials for your new Minecraft account!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
