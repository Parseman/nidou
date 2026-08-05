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

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('user_wallet').select('user_id, coins')
      if (cancelled) return
      const rows = (data ?? []) as WalletRow[]
      setMine(rows.find((w) => w.user_id === user.id)?.coins ?? 0)
      const other = rows.find((w) => w.user_id !== user.id)
      setPartner(other ? other.coins : null)
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

  const isLoading = mine === null

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-bold text-amber-700 flex items-center gap-2"
          style={{ fontFamily: '"Varela Round", sans-serif' }}
        >
          <span>🪙</span> Ma bourse
        </h2>
      </div>

      <div className="flex items-center justify-center py-4">
        {isLoading ? (
          <span className="text-4xl font-bold text-amber-300">…</span>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={mine}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className={`text-5xl font-bold tabular-nums ${
                mine >= 0 ? 'text-amber-500' : 'text-red-400'
              }`}
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              {mine.toLocaleString('fr-FR')}
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      <p className="text-center text-xs text-pink-400 mt-1">
        {isLoading ? 'Chargement…' : 'Câlins, repas, défis, duels… chaque action rapporte 🪙'}
      </p>

      {partner !== null && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-amber-100">
          <span className="text-xs text-pink-400">Bourse du partenaire</span>
          <span className={`text-sm font-bold tabular-nums ${
            partner >= 0 ? 'text-amber-500' : 'text-red-400'
          }`}>
            {partner.toLocaleString('fr-FR')} 🪙
          </span>
        </div>
      )}
    </div>
  )
}
