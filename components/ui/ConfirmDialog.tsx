'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

const Ctx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setState(o);
      }),
    []
  );

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => close(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="bg-bg border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {state.title && <h3 className="font-bold text-[17px] mb-2">{state.title}</h3>}
              <p className="text-ink-secondary text-[14px] mb-5" dir="auto">
                {state.message}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 rounded-[10px] border border-border hover:border-border-strong text-[14px] font-semibold min-h-[44px]"
                >
                  ביטול
                </button>
                <button
                  onClick={() => close(true)}
                  className={`px-4 py-2 rounded-[10px] text-[14px] font-bold min-h-[44px] active:scale-95 transition-transform ${
                    state.danger
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-brand hover:bg-brand-hover text-bg'
                  }`}
                >
                  {state.confirmLabel ?? 'אישור'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
