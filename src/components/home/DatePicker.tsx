import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDisplay(s: string): string {
  return parseISODate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

type Props = {
  value: string // 'YYYY-MM-DD' ou ''
  onChange: (v: string) => void
  min?: string // 'YYYY-MM-DD'
  max?: string // 'YYYY-MM-DD'
  placeholder?: string
  className?: string
}

const POPOVER_WIDTH = 256 // w-64
const POPOVER_MARGIN = 16 // marge mini avec le bord de l'écran

/**
 * Sélecteur de date custom (calendrier maison), pour remplacer
 * `<input type="date">` dont le rendu natif sur mobile (Safari iOS en
 * particulier) ignore la largeur CSS imposée et déborde de son conteneur.
 *
 * Le popover est rendu dans un portail (document.body) plutôt qu'en enfant
 * direct : la plupart des modales de l'app (SettingsModal, etc.) ont un
 * conteneur `overflow-y-auto`, qui coupe tout ce qui dépasse visuellement —
 * un simple z-index n'y change rien, seul un portail permet d'échapper à cet
 * ancêtre. La position est recalculée par rapport au bouton (viewport) à
 * l'ouverture et à chaque scroll/resize tant que le popover est ouvert.
 */
export function DatePicker({ value, onChange, min, max, placeholder = 'Choisir une date', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => (value ? parseISODate(value) : new Date()))
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updateCoords = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN)
    setCoords({ top: rect.bottom + 8, left: Math.max(POPOVER_MARGIN, left) })
  }, [])

  useEffect(() => {
    if (!open) return
    updateCoords()
    // capture: true — capte aussi le scroll d'un ancêtre (ex: la modale en
    // overflow-y-auto), pas seulement celui de la fenêtre.
    window.addEventListener('resize', updateCoords)
    document.addEventListener('scroll', updateCoords, true)
    return () => {
      window.removeEventListener('resize', updateCoords)
      document.removeEventListener('scroll', updateCoords, true)
    }
  }, [open, updateCoords])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggleOpen() {
    if (!open) setViewDate(value ? parseISODate(value) : new Date())
    setOpen(o => !o)
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7 // lundi = colonne 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const minDate = min ? parseISODate(min) : null
  const maxDate = max ? parseISODate(max) : null
  const selected = value ? parseISODate(value) : null

  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  function selectDay(d: Date) {
    onChange(toISODate(d))
    setOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`input-field text-sm flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={value ? '' : 'text-pink-300 dark:text-pink-500/60'}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        <CalendarIcon size={16} className="shrink-0 opacity-60" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
              className="z-[100] glass-card rounded-2xl p-3 shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(year, month - 1, 1))}
                  className="p-1 rounded-lg hover:bg-pink-100 dark:hover:bg-white/10 text-pink-500 dark:text-pink-300"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-slate-700 dark:text-pink-200">
                  {MONTHS[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(year, month + 1, 1))}
                  className="p-1 rounded-lg hover:bg-pink-100 dark:hover:bg-white/10 text-pink-500 dark:text-pink-300"
                  aria-label="Mois suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="text-[10px] text-center font-semibold text-pink-400 dark:text-pink-400/70">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />
                  const disabled = (minDate && d < minDate) || (maxDate && d > maxDate)
                  const isSelected = selected ? isSameDay(d, selected) : false
                  return (
                    <button
                      type="button"
                      key={i}
                      disabled={!!disabled}
                      onClick={() => selectDay(d)}
                      className={`text-xs h-7 rounded-lg transition-colors
                        ${isSelected ? 'bg-pink-500 text-white font-bold' : 'text-slate-700 dark:text-pink-200 hover:bg-pink-100 dark:hover:bg-white/10'}
                        ${disabled ? 'opacity-25 cursor-not-allowed hover:bg-transparent' : ''}`}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
