'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  expiresAt: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const typeConfig: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(0,169,128,0.18)', border: 'rgba(0,169,128,0.45)', icon: '✅' },
  error: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.45)', icon: '❌' },
  warning: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.45)', icon: '⚠️' },
  info: { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.45)', icon: 'ℹ️' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((message: string, type: ToastType = 'info', durationMs = 4500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, type, expiresAt: Date.now() + durationMs }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // GC expired toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    timerRef.current = setInterval(() => {
      setToasts((prev) => {
        const now = Date.now();
        const live = prev.filter((t) => t.expiresAt > now);
        return live.length === prev.length ? prev : live;
      });
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
          display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem',
          maxWidth: 420, pointerEvents: 'none',
        }}>
          {toasts.map((toast) => {
            const cfg = typeConfig[toast.type];
            return (
              <div
                key={toast.id}
                style={{
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 10, padding: '0.75rem 1rem',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  pointerEvents: 'auto',
                  animation: 'toast-slide-in 200ms ease-out',
                }}
              >
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{cfg.icon}</span>
                <span style={{ color: '#fff', fontSize: '0.8rem', lineHeight: 1.4, flex: 1, fontFamily: 'inherit' }}>{toast.message}</span>
                <button
                  onClick={() => dismiss(toast.id)}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontSize: '0.8rem', padding: 0, flexShrink: 0,
                  }}
                  aria-label="Dismiss"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes toast-slide-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
