import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Lightweight toast notification system.
 *
 * Wrap the app once with <ToastProvider> (done in App.tsx), then anywhere
 * inside call the useToast() hook to fire toasts:
 *
 *   const toast = useToast();
 *   toast.success("Client saved");
 *   toast.error("Could not save client");
 *   toast.info("Roster regenerated");
 *
 * Or the generic form: toast.show({ tone: "success", message: "..." }).
 */

export type ToastTone = "success" | "error" | "info";

interface ToastOptions {
  tone?: ToastTone;
  message: string;
  /** Milliseconds before auto-dismiss. Default 4000. Pass 0 to persist until closed. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "message" | "tone">> {
  id: number;
  duration: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { bg: string; icon: string }> = {
  success: { bg: "bg-emerald-600", icon: "✓" },
  error: { bg: "bg-red-600", icon: "!" },
  info: { bg: "bg-brand-primary", icon: "i" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ tone = "info", message, duration = 4000 }: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, tone, message, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    show,
    success: (message, duration) => show({ tone: "success", message, duration }),
    error: (message, duration) => show({ tone: "error", message, duration }),
    info: (message, duration) => show({ tone: "info", message, duration }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-3 pt-3 sm:items-end sm:px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-panel px-4 py-3 text-sm font-medium text-white shadow-soft-lg",
                tone.bg
              )}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                {tone.icon}
              </span>
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
