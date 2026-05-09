import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { X, Bell, BellOff, BellRing } from 'lucide-react'
import { registerPush } from '../../lib/pushNotifications'

type Props = {
  open: boolean
  onClose: () => void
  user: User
}

export function SettingsModal({ open, onClose, user }: Props) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
  }, [open])

  async function handleEnable() {
    setLoading(true)
    await registerPush(user.id)
    if ('Notification' in window) setPermission(Notification.permission)
    setLoading(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: '-45%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: '-45%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="glass-card rounded-2xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-lg font-bold text-pink-700"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  ⚙️ Paramètres
                </h2>
                <button
                  onClick={onClose}
                  className="text-pink-300 hover:text-pink-500 transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Section notifications */}
              <div>
                <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">
                  Notifications
                </p>

                <div className="bg-white/40 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {permission === 'granted' ? (
                      <BellRing size={20} className="text-violet-500 shrink-0" />
                    ) : permission === 'denied' ? (
                      <BellOff size={20} className="text-pink-300 shrink-0" />
                    ) : (
                      <Bell size={20} className="text-pink-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-pink-700">
                        Notifications push
                      </p>
                      <p className="text-xs text-pink-400 mt-0.5">
                        {permission === 'granted'
                          ? 'Activées ✓'
                          : permission === 'denied'
                          ? 'Bloquées — autorise dans les réglages du navigateur'
                          : 'Messages, défis, rappels quotidiens'}
                      </p>
                    </div>
                  </div>

                  {permission !== 'granted' && permission !== 'denied' && (
                    <button
                      onClick={handleEnable}
                      disabled={loading}
                      className="btn-primary text-xs px-3 py-1.5 shrink-0 disabled:opacity-50"
                    >
                      {loading ? '…' : 'Activer'}
                    </button>
                  )}

                  {permission === 'granted' && (
                    <span className="text-lg shrink-0">✅</span>
                  )}
                </div>

                {permission === 'denied' && (
                  <p className="text-xs text-pink-400 mt-2 text-center">
                    Sur iPhone : Réglages → Safari → Notifications → autorise le site
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
