import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type WalletRow = {
  user_id: string
  coins: number
}

export function CoinPot({ user }: { user: User }) {
  const [mine, setMine] = useState<number | null>(null)
  const [partner, setPartner] = useState<number | null>(null)
  const [showPartner, setShowPartner] = useState(false)

  const myName = user.user_metadata?.first_name ?? 'Toi'
  const partnerName = myName === 'Léona' ? 'Clément' : 'Léona'

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('user_wallet').select('user_id, coins')
      if (cancelled) return
      const rows = (data ?? []) as WalletRow[]
      setMine(rows.find((w) => w.user_id === user.id)?.coins ?? 0)
      // Le partenaire existe toujours dans ce couple à 2 users — une ligne
      // absente veut dire "pas encore de récompense", pas "pas de partenaire".
      setPartner(rows.find((w) => w.user_id !== user.id)?.coins ?? 0)
    }

    load()

    const channel = supabase
      .channel('wallet-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_wallet' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (!row || typeof row.coins !== 'number' || cancelled) return
          if (row.user_id === user.id) {
            setMine(row.coins)
          } else {
            setPartner(row.coins)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [user.id])

  const isLoading = mine === null || partner === null
  const viewingPartner = showPartner
  const slideTransition = { duration: 0.4, ease: 'easeInOut' as const }

  return (
    <div className="glass-card relative overflow-hidden rounded-3xl">
      {/* Fond glissant : couvre toute la case, révélé uniquement quand le toggle est activé */}
      <div className="absolute inset-0">
        <AnimatePresence initial={false}>
          {viewingPartner ? (
            <motion.div
              key="bg-partner"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={slideTransition}
              className="absolute inset-0 bg-gradient-to-br from-violet-100 to-purple-200 dark:from-violet-950/60 dark:to-purple-900/60"
            />
          ) : (
            <motion.div
              key="bg-mine"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={slideTransition}
              className="absolute inset-0"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 p-4 md:p-6">
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <AnimatePresence mode="wait">
            <motion.h2
              key={viewingPartner ? 'partner-title' : 'mine-title'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="text-base font-bold text-amber-700 flex items-center gap-2 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              <span className="shrink-0">🪙</span>
              <span className="overflow-hidden text-ellipsis">
                {viewingPartner ? partnerName : 'Ma bourse'}
              </span>
            </motion.h2>
          </AnimatePresence>

          <button
            onClick={() => setShowPartner((v) => !v)}
            disabled={isLoading}
            aria-label={viewingPartner ? 'Afficher ma bourse' : `Afficher la bourse de ${partnerName}`}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
              ${viewingPartner ? 'bg-violet-500' : 'bg-pink-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
              ${viewingPartner ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        <div className="relative h-28 md:h-36 overflow-hidden">
          <AnimatePresence initial={false}>
            {isLoading ? (
              <motion.div key="loading" className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl md:text-4xl font-bold text-amber-300">…</span>
              </motion.div>
            ) : viewingPartner ? (
              <motion.div
                key="partner"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={slideTransition}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              >
                <span
                  className={`text-3xl md:text-5xl font-bold tabular-nums ${
                    partner >= 0 ? 'text-amber-500' : 'text-red-400'
                  }`}
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  {partner.toLocaleString('fr-FR')}
                </span>
                <p className="text-xs text-pink-400 px-2 text-center">
                  Ce que {partnerName} a accumulé jusqu'ici 🪙
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="mine"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={slideTransition}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              >
                <span
                  className={`text-3xl md:text-5xl font-bold tabular-nums ${
                    mine >= 0 ? 'text-amber-500' : 'text-red-400'
                  }`}
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  {mine.toLocaleString('fr-FR')}
                </span>
                <p className="text-xs text-pink-400 px-2 text-center">
                  Câlins, repas, défis, duels… chaque action rapporte 🪙
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
