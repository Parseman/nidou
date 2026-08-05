import { useState, useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { calcStats, canAct, COOLDOWN_MS, type PetRow, type Mood } from '../pet/PetPage'

function getMood(row: PetRow): Mood {
  const s   = calcStats(row)
  const avg = (s.hunger + s.hygiene + s.happiness) / 3
  return avg > 65 ? 'happy' : avg > 30 ? 'normal' : 'sad'
}

function StatDot({ value }: { value: number }) {
  const color =
    value > 60 ? 'bg-green-400' :
    value > 30 ? 'bg-amber-400' :
                 'bg-red-400'
  return <span className={`w-3 h-3 rounded-full ${color} shadow-sm`} />
}

export function NidouChatIcon({ onOpen }: { onOpen: () => void }) {
  const [row, setRow] = useState<PetRow | null>(null)
  const instanceId = useId()

  useEffect(() => {
    supabase
      .from('pet')
      .select('hunger, hygiene, happiness, last_fed_at, last_washed_at, last_pet_at')
      .eq('id', 1)
      .single()
      .then(({ data }) => { if (data) setRow(data as PetRow) })

    const channel = supabase
      .channel(`pet-icon-realtime-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pet' },
        ({ new: r }) => setRow(r as PetRow),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [instanceId])

  const mood       = row ? getMood(row) : 'normal'
  const moodLabel  = mood === 'happy' ? 'Heureux 😸' : mood === 'sad' ? 'Malheureux 😿' : 'Ça va 🐱'
  const stats      = row ? calcStats(row) : null
  const needsAttention = row
    ? (!canAct(row.last_fed_at, COOLDOWN_MS.hunger) === false ||
       !canAct(row.last_washed_at, COOLDOWN_MS.hygiene) === false ||
       !canAct(row.last_pet_at, COOLDOWN_MS.happiness) === false)
    : false

  return (
    <motion.button
      onClick={onOpen}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full max-w-sm rounded-3xl overflow-hidden cursor-pointer
                 shadow-xl shadow-violet-200/50 focus:outline-none group"
      aria-label="Ouvrir Nidou le chat"
    >
      {/* Image principale */}
      <img
        src="/nidou-cover.png"
        alt="Nidou le chat"
        className="w-full object-cover aspect-square
                   group-hover:scale-105 transition-transform duration-500"
      />

      {/* Overlay gradient bas */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* Badge attention */}
      {needsAttention && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full
                     bg-red-500 text-white text-xs font-bold
                     flex items-center justify-center shadow-md"
        >
          !
        </motion.span>
      )}

      {/* Infos en bas */}
      <div className="absolute bottom-0 left-0 right-0 px-5 py-4 flex items-end justify-between">
        <div className="text-left">
          <p
            className="text-white font-bold text-lg leading-tight"
            style={{ fontFamily: '"Varela Round", sans-serif' }}
          >
            Nidou
          </p>
          <p className="text-white/70 text-xs mt-0.5">{moodLabel}</p>
        </div>

        {/* Dots de stat */}
        {stats && (
          <div className="flex gap-2 items-center">
            <StatDot value={stats.hunger} />
            <StatDot value={stats.hygiene} />
            <StatDot value={stats.happiness} />
          </div>
        )}
      </div>
    </motion.button>
  )
}

export default NidouChatIcon
