import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastKind = 'ok' | 'err' | 'info';
type ToastItem = { id: number; kind: ToastKind; text: string };

type ToastApi = {
  push: (text: string, kind?: ToastKind) => void;
  ok: (text: string) => void;
  err: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastApi>({
  push: () => {},
  ok: () => {},
  err: () => {},
  info: () => {},
});

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = seq++;
    setItems((prev) => [...prev.slice(-4), { id, kind, text }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      ok: (t) => push(t, 'ok'),
      err: (t) => push(t, 'err'),
      info: (t) => push(t, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm shadow-lg ring-1 ${
                t.kind === 'ok'
                  ? 'bg-moss text-cream ring-moss/30'
                  : t.kind === 'err'
                    ? 'bg-terra text-cream ring-terra/30'
                    : 'bg-ink text-cream ring-ink/20'
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
