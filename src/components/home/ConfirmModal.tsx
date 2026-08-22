import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Modale de confirmation générique (style cohérent avec les autres modales de l'app). */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className="relative glass-card rounded-3xl p-6 max-w-xs w-full text-center"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          >
            <h2
              className="text-lg font-bold text-slate-800 dark:text-pink-200 mb-2"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              {title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-pink-300 mb-6">{message}</p>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-pink-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
