'use client';

import React, { useEffect, useRef } from 'react';
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
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-full px-4 pointer-events-none animate-in fade-in slide-in-from-top-3 duration-200">
      <div
        className={`pointer-events-auto flex items-center gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition ${
          toast.type === 'success'
            ? 'bg-white/95 text-slate-900 border-emerald-300 shadow-emerald-950/10'
            : toast.type === 'error'
            ? 'bg-white/95 text-slate-900 border-rose-300 shadow-rose-950/10'
            : 'bg-white/95 text-slate-900 border-slate-200 shadow-slate-900/10'
        }`}
      >
        <div className="shrink-0">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-sky-600" />}
        </div>

        <div className="flex-1 text-xs font-semibold leading-relaxed text-slate-800">
          {toast.message}
        </div>

        <button
          onClick={() => onDismissRef.current()}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
