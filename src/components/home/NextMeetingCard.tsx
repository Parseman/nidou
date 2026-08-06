import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Settings = {
  next_meeting_date: string | null
  last_meeting_date: string | null
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysRemaining(next: string): number {
  return Math.ceil((parseDate(next).getTime() - today().getTime()) / 86400000)
}

function progressPct(last: string | null, next: string): number {
  if (!last) return 0
  const l = parseDate(last).getTime()
  const n = parseDate(next).getTime()
  const t = today().getTime()
  const total = n - l
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((t - l) / total) * 100))
}

function fmtLong(s: string): string {
  return parseDate(s).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fmtShort(s: string): string {
  return parseDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function NextMeetingCard() {
  const [data, setData] = useState<Settings | null>(null)
  const [editing, setEditing] = useState(false)
  const [nextDate, setNextDate] = useState('')
  const [lastDate, setLastDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('couple_settings')
      .select('next_meeting_date, last_meeting_date')
      .maybeSingle()
      .then(({ data: row, error: fetchError }) => {
        if (fetchError) {
          console.error('couple_settings fetch:', fetchError)
          setData({ next_meeting_date: null, last_meeting_date: null })
          return
        }
        const settings = row ?? { next_meeting_date: null, last_meeting_date: null }
        setData(settings)
        setNextDate(settings.next_meeting_date ?? '')
        setLastDate(settings.last_meeting_date ?? '')
      })
  }, [])

  const openEdit = () => {
    setNextDate(data?.next_meeting_date ?? '')
    setLastDate(data?.last_meeting_date ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('couple_settings').upsert({
      id: 1,
      next_meeting_date: nextDate || null,
      last_meeting_date: lastDate || null,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.error('couple_settings upsert:', error)
      setError('Erreur lors de la sauvegarde. Réessaie.')
      setSaving(false)
      return
    }
    setData({ next_meeting_date: nextDate || null, last_meeting_date: lastDate || null })
    setSaving(false)
    setEditing(false)

    if (nextDate) {
      sendNotif(daysRemaining(nextDate))
    }
  }

  async function sendNotif(days: number) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-meeting-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ days }),
      })
    } catch { /* non-bloquant */ }
  }

  if (data === null) return null

  const hasNext = !!data.next_meeting_date
  const days = hasNext ? daysRemaining(data.next_meeting_date!) : null
  const pct = hasNext ? progressPct(data.last_meeting_date, data.next_meeting_date!) : 0
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="glass-card rounded-3xl p-4 md:p-6">
      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="text-pink-400" size={18} strokeWidth={1.8} />
                <h2
                  className="font-bold text-pink-700 text-sm"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  Prochaines retrouvailles
                </h2>
              </div>
              <button
                onClick={openEdit}
                className="text-pink-300 hover:text-pink-500 transition-colors cursor-pointer p-1"
                aria-label="Modifier la date"
              >
                <Pencil size={15} />
              </button>
            </div>

            {hasNext ? (
              <>
                <p
                  className="text-lg md:text-xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent mb-1 capitalize"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  {fmtLong(data.next_meeting_date!)}
                </p>

                <p className="text-pink-400 text-sm mb-2 md:mb-5">
                  {days === 0
                    ? "C'est aujourd'hui ! 🎉"
                    : days! < 0
                    ? 'Vous vous êtes vus ! 🥰'
                    : `${days} jour${days! > 1 ? 's' : ''} restant${days! > 1 ? 's' : ''}`}
                </p>

                <div className="relative h-2.5 bg-pink-100 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-400 to-violet-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>

                {data.last_meeting_date && (
                  <div className="flex justify-between mt-2 text-xs text-pink-300">
                    <span className="capitalize">{fmtShort(data.last_meeting_date)}</span>
                    <span className="capitalize">{fmtShort(data.next_meeting_date!)}</span>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={openEdit}
                className="text-pink-400 text-sm hover:text-pink-600 transition-colors cursor-pointer"
              >
                Configurer vos prochaines retrouvailles →
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <h2
              className="font-bold text-pink-700 text-sm"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Configurer les retrouvailles
            </h2>

            <div>
              <label className="block text-xs font-semibold text-pink-600 mb-1.5">
                Dernière fois qu'on s'est vus
              </label>
              <input
                type="date"
                value={lastDate}
                max={todayStr}
                onChange={(e) => setLastDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-pink-600 mb-1.5">
                Prochaine fois qu'on se voit
              </label>
              <input
                type="date"
                value={nextDate}
                min={todayStr}
                onChange={(e) => setNextDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving || !nextDate}
                className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
              >
                <Check size={14} />
                {saving ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 text-sm px-4 py-2 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer"
              >
                <X size={14} />
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
