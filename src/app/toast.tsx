import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  action?: { label: string; onClick: () => void };
  /** ms; default 4000 */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children, hasTabs }: { children: ReactNode; hasTabs: boolean }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-1), { id, message, ...options }]);
      const timer = window.setTimeout(() => dismiss(id), options.duration ?? (options.action ? 5000 : 3000));
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={`toast-host${hasTabs ? '' : ' toast-host--no-tabs'}`} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast" role="status">
            <span className="toast__text">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
