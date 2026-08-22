import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { X, Bell, BellOff, Moon, Sun, Plus, Trash2 } from 'lucide-react'
import { registerPush, unregisterPush, getPushEnabled } from '../../lib/pushNotifications'
import { useTheme } from '../../lib/useTheme'
import { supabase } from '../../lib/supabase'
import { fmtDateShort } from '../../lib/dates'

type Props = {
  open: boolean
  onClose: () => void
  user: User
}

type FeedbackType = 'bug' | 'idea'

type FeedbackRow = {
  id: string
  user_id: string
  author_name: string | null
  type: FeedbackType
  description: string
  created_at: string
}

export function SettingsModal({ open, onClose, user }: Props) {
  const { dark, toggle: toggleDark } = useTheme()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = 'Notification' in window && 'PushManager' in window

  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [feedbackLoaded, setFeedbackLoaded] = useState(false)
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('idea')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  const [tripDeparture, setTripDeparture] = useState('')
  const [tripArrival, setTripArrival] = useState('')
  const [tripSaving, setTripSaving] = useState(false)
  const [tripSaved, setTripSaved] = useState(false)
  const [tripError, setTripError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if ('Notification' in window) setPermission(Notification.permission)
    getPushEnabled().then(setEnabled)
    fetchFeedback()
    fetchTrip()
  }, [open])

  async function fetchTrip() {
    const { data } = await supabase
      .from('user_trips')
      .select('departure_date, arrival_date')
      .eq('user_id', user.id)
      .maybeSingle()
    setTripDeparture(data?.departure_date ?? '')
    setTripArrival(data?.arrival_date ?? '')
    setTripSaved(false)
    setTripError(null)
  }

  async function saveTrip() {
    if (!tripDeparture || !tripArrival || tripSaving) return
    setTripSaving(true)
    setTripError(null)
    const { error } = await supabase.from('user_trips').upsert({
      user_id: user.id,
      user_name: user.user_metadata?.first_name ?? null,
      departure_date: tripDeparture,
      arrival_date: tripArrival,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.error('user_trips upsert:', error)
      setTripError('Erreur lors de la sauvegarde. Réessaie.')
      setTripSaving(false)
      return
    }
    setTripSaving(false)
    setTripSaved(true)
  }

  async function fetchFeedback() {
    const { data } = await supabase
      .from('feedback_reports')
      .select('*')
      .order('created_at', { ascending: false })
    setFeedback((data ?? []) as FeedbackRow[])
    setFeedbackLoaded(true)
  }

  async function submitFeedback() {
    if (!feedbackText.trim() || feedbackSubmitting) return
    setFeedbackSubmitting(true)
    await supabase.from('feedback_reports').insert({
      user_id: user.id,
      author_name: user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null,
      type: feedbackType,
      description: feedbackText.trim(),
    })
    setFeedbackText('')
    setFeedbackType('idea')
    setFeedbackFormOpen(false)
    setFeedbackSubmitting(false)
    fetchFeedback()
  }

  async function deleteFeedback(id: string) {
    setFeedback((prev) => prev.filter((f) => f.id !== id))
    await supabase.from('feedback_reports').delete().eq('id', id)
  }

  async function handleToggle() {
    setLoading(true)
    setError(null)
    if (enabled) {
      await unregisterPush()
      setEnabled(false)
    } else {
      const result = await registerPush(user.id)
      if (result.ok) {
        setPermission('granted')
        setEnabled(true)
      } else {
        setError(result.message)
      }
    }
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
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: '-45%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: '-45%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="glass-card rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-lg font-bold text-pink-700 dark:text-pink-200"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  ⚙️ Paramètres
                </h2>
                <button
                  onClick={onClose}
                  className="text-pink-300 hover:text-pink-500 dark:text-pink-400 dark:hover:text-pink-200 transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Section apparence */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wider mb-3">
                  Apparence
                </p>
                <div className="bg-white/40 dark:bg-purple-950/40 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {dark
                      ? <Moon size={20} className="text-violet-400 shrink-0" />
                      : <Sun size={20} className="text-amber-400 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium text-pink-700 dark:text-pink-200">Mode nuit</p>
                      <p className="text-xs text-pink-400 dark:text-pink-300 mt-0.5">
                        {dark ? 'Activé — thème sombre' : 'Désactivé — thème clair'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleDark}
                    aria-label={dark ? 'Désactiver le mode nuit' : 'Activer le mode nuit'}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer
                      ${dark ? 'bg-violet-500' : 'bg-pink-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                      ${dark ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>

              {/* Section trajet */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wider mb-3">
                  Ton trajet
                </p>
                <div className="bg-white/40 dark:bg-purple-950/40 rounded-xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-pink-600 dark:text-pink-300 mb-1">
                        Départ
                      </label>
                      <input
                        type="date"
                        value={tripDeparture}
                        onChange={(e) => { setTripDeparture(e.target.value); setTripSaved(false) }}
                        className="input-field text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-pink-600 dark:text-pink-300 mb-1">
                        Retour
                      </label>
                      <input
                        type="date"
                        value={tripArrival}
                        min={tripDeparture || undefined}
                        onChange={(e) => { setTripArrival(e.target.value); setTripSaved(false) }}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                  {tripError && <p className="text-xs text-red-500">{tripError}</p>}
                  <button
                    onClick={saveTrip}
                    disabled={tripSaving || !tripDeparture || !tripArrival}
                    className="btn-primary text-sm px-4 py-1.5 w-full"
                  >
                    {tripSaving ? 'Sauvegarde…' : tripSaved ? 'Enregistré ✓' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              {/* Section notifications */}
              <div>
                <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wider mb-3">
                  Notifications
                </p>

                <div className="bg-white/40 dark:bg-purple-950/40 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {enabled
                      ? <Bell size={20} className="text-violet-500 shrink-0" />
                      : <BellOff size={20} className="text-pink-300 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium text-pink-700 dark:text-pink-200">
                        Notifications push
                      </p>
                      <p className="text-xs text-pink-400 dark:text-pink-300 mt-0.5">
                        {permission === 'denied'
                          ? 'Bloquées — autorise dans les réglages navigateur'
                          : enabled
                          ? 'Messages, défis, rappels à 15h'
                          : 'Désactivées sur cet appareil'}
                      </p>
                    </div>
                  </div>

                  {supported && permission !== 'denied' && (
                    <button
                      onClick={handleToggle}
                      disabled={loading}
                      aria-label={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50 cursor-pointer
                        ${enabled ? 'bg-violet-500' : 'bg-pink-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                        ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  )}
                </div>

                {permission === 'denied' && (
                  <p className="text-xs text-pink-400 mt-2 text-center">
                    Sur iPhone : Réglages → Safari → Notifications → autorise le site
                  </p>
                )}
                {error && (
                  <p className="text-xs text-red-400 mt-2 text-center break-words">{error}</p>
                )}
              </div>

              {/* Section idées & bugs */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wider">
                    Idées & bugs
                  </p>
                  <button
                    onClick={() => setFeedbackFormOpen((v) => !v)}
                    className="text-pink-400 hover:text-pink-600 dark:text-pink-300 dark:hover:text-pink-100 transition-colors cursor-pointer"
                    aria-label="Envoyer une idée ou un bug"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {feedbackFormOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <div className="bg-white/40 dark:bg-purple-950/40 rounded-xl p-4 space-y-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFeedbackType('idea')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors cursor-pointer
                              ${feedbackType === 'idea' ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white/60 dark:bg-transparent border-pink-100 dark:border-pink-900 text-pink-300 dark:text-pink-400'}`}
                          >
                            💡 Idée
                          </button>
                          <button
                            onClick={() => setFeedbackType('bug')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors cursor-pointer
                              ${feedbackType === 'bug' ? 'bg-red-50 border-red-300 text-red-500' : 'bg-white/60 dark:bg-transparent border-pink-100 dark:border-pink-900 text-pink-300 dark:text-pink-400'}`}
                          >
                            🐛 Bug
                          </button>
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder={feedbackType === 'bug' ? 'Décris le bug rencontré…' : 'Décris ton idée…'}
                          className="input-field text-sm resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={submitFeedback}
                            disabled={!feedbackText.trim() || feedbackSubmitting}
                            className="btn-primary text-sm px-4 py-1.5"
                          >
                            {feedbackSubmitting ? 'Envoi…' : 'Envoyer'}
                          </button>
                          <button
                            onClick={() => { setFeedbackFormOpen(false); setFeedbackText('') }}
                            className="text-sm text-pink-400 hover:text-pink-600 transition-colors cursor-pointer px-2"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {feedbackLoaded && feedback.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {feedback.map((f) => (
                      <div key={f.id} className="bg-white/40 dark:bg-purple-950/40 rounded-xl p-3 flex items-start gap-2">
                        <span className="text-base shrink-0" aria-hidden>{f.type === 'bug' ? '🐛' : '💡'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-pink-700 dark:text-pink-200 break-words">{f.description}</p>
                          <p className="text-xs text-pink-300 dark:text-pink-400 mt-0.5">
                            {f.author_name ?? 'inconnu'} · {fmtDateShort(f.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteFeedback(f.id)}
                          className="text-pink-300 hover:text-red-500 dark:text-pink-400 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {feedbackLoaded && feedback.length === 0 && !feedbackFormOpen && (
                  <p className="text-xs text-pink-300 dark:text-pink-400 text-center py-2">
                    Aucune idée ni bug signalé pour l'instant
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
