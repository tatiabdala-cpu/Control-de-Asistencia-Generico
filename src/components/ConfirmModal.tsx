import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, RotateCcw, Undo2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'undo';
  iconType?: 'trash' | 'warning' | 'reset' | 'undo';
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  iconType = 'trash',
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (iconType === 'undo') {
      return (
        <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Undo2 className="w-5 h-5 stroke-[2.5]" />
        </div>
      );
    }
    if (iconType === 'reset') {
      return (
        <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <RotateCcw className="w-5 h-5 stroke-[2.5]" />
        </div>
      );
    }
    if (iconType === 'trash' || variant === 'danger') {
      return (
        <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in"
      onClick={e => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] p-5 shadow-2xl text-slate-900 dark:text-white transition-all transform animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {renderIcon()}
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Confirmación requerida
              </p>
            </div>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6 bg-slate-50 dark:bg-[#0e1116] p-3.5 rounded-xl border border-slate-200 dark:border-[#212735] whitespace-pre-line">
          {message}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onConfirm();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/20'
                : variant === 'undo'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/20'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/20'
            }`}
          >
            {variant === 'danger' ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : variant === 'undo' || iconType === 'undo' ? (
              <Undo2 className="w-3.5 h-3.5" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
