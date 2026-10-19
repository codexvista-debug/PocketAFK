'use client';

import React from 'react';
import { ContainerWindow } from '../types';
import { X, PackageOpen, MousePointerClick } from 'lucide-react';

interface ContainerModalProps {
  window: ContainerWindow | null;
  onClose: () => void;
  onClickSlot: (slot: number, mouseButton?: number) => void;
}

function parseText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    if (val.trim().startsWith('{') && val.trim().endsWith('}')) {
      try {
        const obj = JSON.parse(val);
        return parseText(obj);
      } catch {}
    }
    return val;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    let t = val.text || val.value || '';
    if (Array.isArray(val.extra)) {
      t += val.extra.map((e: any) => parseText(e)).join('');
    }
    if (Array.isArray(val.with)) {
      t += val.with.map((w: any) => parseText(w)).join(' ');
    }
    if (!t && val.translate) {
      t = val.translate;
    }
    return t || (typeof val.toString === 'function' && val.toString !== Object.prototype.toString ? val.toString() : '');
  }
  return String(val || '');
}

export const ContainerModal: React.FC<ContainerModalProps> = ({
  window,
  onClose,
  onClickSlot
}) => {
  if (!window || !Array.isArray(window.slots)) return null;

  const windowTitle = parseText(window.title) || 'Server Menu / Chest';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <PackageOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">{windowTitle}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold">
              Window #{window.windowId}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Slot Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100">
          <div className="flex items-center gap-2 mb-3 text-xs text-slate-600 font-medium">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-600" />
            <span>Click any slot to interact. Right-click for secondary action.</span>
          </div>

          {/* Minecraft 9-column grid */}
          <div className="grid grid-cols-9 gap-1.5 sm:gap-2 p-3.5 bg-white border border-slate-300 rounded-xl shadow-xs">
            {window.slots.map((item, index) => {
              const itemTitle = item ? (parseText(item.customName) || parseText(item.displayName) || item.name || 'Item') : '';
              const stackCount = item && typeof item.count === 'number' ? item.count : 1;

              return (
                <div
                  key={index}
                  onClick={() => onClickSlot(index, 0)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onClickSlot(index, 1);
                  }}
                  className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative cursor-pointer group transition select-none ${
                    item
                      ? 'bg-slate-50 border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50/50 border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  {/* Slot index hint */}
                  <span className="absolute top-0.5 left-1 text-[8px] text-slate-400 font-mono">
                    {index}
                  </span>

                  {item ? (
                    <>
                      {/* Item representation */}
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 text-center px-1 truncate max-w-full">
                        {itemTitle.length > 10 ? itemTitle.slice(0, 10) + '...' : itemTitle}
                      </span>

                      {/* Stack Count */}
                      {stackCount > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-amber-600 font-mono">
                          {stackCount}
                        </span>
                      )}

                      {/* Hover Tooltip */}
                      <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-50 pointer-events-none text-left">
                        <div className="font-bold text-xs text-emerald-400 mb-1">
                          {itemTitle}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mb-1">
                          Item: {String(item.name || 'item')}
                        </div>
                        {Array.isArray(item.lore) && item.lore.length > 0 && (
                          <div className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1">
                            {item.lore.map((l, i) => (
                              <div key={i}>{parseText(l)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            Close Menu
          </button>
        </div>
      </div>
    </div>
  );
};
