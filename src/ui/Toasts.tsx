import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame, type Toast } from '../store/game';

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGame((s) => s.dismissToast);
  const undoRestart = useGame((s) => s.undoRestart);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.undo ? 7000 : 3400);
    return () => clearTimeout(t);
  }, [toast.id, toast.undo, dismiss]);
  return (
    <motion.div
      layout
      className={`toast ${toast.tone}`}
      role="status"
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 480, damping: 30 }}
    >
      <span className="dot" aria-hidden="true" />
      <span>
        <b>{toast.title}</b>
        {toast.body}
      </span>
      {toast.undo && (
        <button
          className="btn small"
          style={{ minHeight: 36 }}
          onClick={() => {
            undoRestart();
            dismiss(toast.id);
          }}
        >
          Undo
        </button>
      )}
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
