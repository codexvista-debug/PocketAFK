'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ModernToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ModernToast: React.FC<ModernToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-100 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        className={`flex items-center gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/30'
            : toast.type === 'error'
            ? 'bg-rose-950/90 text-rose-100 border-rose-500/30'
            : 'bg-slate-900/90 text-slate-100 border-slate-700/50'
        }`}
      >
        <div className="shrink-0">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
        </div>

        <div className="flex-1 text-xs font-semibold leading-relaxed">
          {toast.message}
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
