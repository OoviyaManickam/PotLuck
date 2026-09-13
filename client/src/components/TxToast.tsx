'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { X, ExternalLink } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastVariant = 'pending' | 'confirming' | 'success' | 'error';

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  hash?: string;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  removeToast: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);
const ToastListContext = createContext<Toast[]>([]);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProviderWithHost');
  return ctx;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  pending: 'border-surface-2 bg-surface text-text-muted',
  confirming: 'border-accent/40 bg-surface text-text',
  success: 'border-accent/60 bg-surface-2 text-text',
  error: 'border-red-500/50 bg-surface text-red-400',
};

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  pending: <span className="animate-spin inline-block">⌛</span>,
  confirming: <span className="animate-pulse inline-block">⏳</span>,
  success: <span>✓</span>,
  error: <span>✕</span>,
};

// ── Single toast item ──────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.variant === 'success' || toast.variant === 'error') {
      const t = setTimeout(() => onRemove(toast.id), 6000);
      return () => clearTimeout(t);
    }
  }, [toast.variant, toast.id, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 pr-2 shadow-lg backdrop-blur-sm text-sm w-80 transition-all ${VARIANT_STYLES[toast.variant]}`}
      role="status"
    >
      <span className="mt-0.5 shrink-0 text-base">{VARIANT_ICONS[toast.variant]}</span>
      <div className="flex-1 min-w-0">
        <p className="leading-snug break-words">{toast.message}</p>
        {toast.hash && toast.variant === 'success' && (
          <a
            href={`https://sepolia.etherscan.io/tx/${toast.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-accent hover:underline text-xs"
          >
            View on Etherscan <ExternalLink size={10} />
          </a>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Toast host (renders the fixed stack) ──────────────────────────────────────

export function ToastHost() {
  const toasts = useContext(ToastListContext);
  const { removeToast } = useToast();

  const remove = useCallback((id: string) => removeToast(id), [removeToast]);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}

// ── Provider (wraps app, includes ToastHost) ──────────────────────────────────

export function ToastProviderWithHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, updateToast, removeToast }}>
      <ToastListContext.Provider value={toasts}>
        {children}
        <ToastHost />
      </ToastListContext.Provider>
    </ToastContext.Provider>
  );
}
