import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { calcStats } from '../pet/PetPage'
import type { PetRow } from '../pet/PetPage'

type Settled = {
  coins: number
  at: number
  rate: number
}

function computeDisplay(s: Settled): number {
  const elapsed = Math.floor((Date.now() - s.at) / 60_000)
  return s.coins + elapsed * s.rate
}

export function CoinPot() {
  const [display, setDisplay] = useState<number | null>(null)
  const [rate, setRate] = useState(0)
  const settledRef = useRef<Settled | null>(null)

  useEffect(() => {
    let cancelled = false

    async function settle() {
      const [{ data: pet }, { data: cfg }] = await Promise.all([
        supabase.from('pet').select('*').eq('id', 1).single(),
        supabase.from('couple_settings')
          .select('coins, last_coin_update_at, coin_rate')
          .eq('id', 1)
          .maybeSingle(),
      ])

      if (!pet || cancelled) return

      const stats = calcStats(pet as PetRow)
      const avg = (stats.hunger + stats.hygiene + stats.happiness) / 3
      const newRate = avg > 75 ? 1 : -2

      const lastAt = cfg?.last_coin_update_at
        ? new Date(cfg.last_coin_update_at).getTime()
        : Date.now()
      const elapsed = Math.floor((Date.now() - lastAt) / 60_000)
      const newCoins = (cfg?.coins ?? 0) + elapsed * newRate

      await supabase.from('couple_settings').upsert({
        id: 1,
        coins: newCoins,
        last_coin_update_at: new Date().toISOString(),
        coin_rate: newRate,
      })

      if (cancelled) return
      const s: Settled = { coins: newCoins, at: Date.now(), rate: newRate }
      settledRef.current = s
      setRate(newRate)
      setDisplay(newCoins)
    }

    settle()

    const channel = supabase
      .channel('coinpot-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couple_settings' },
        (payload) => {
          const { coins, last_coin_update_at, coin_rate } = payload.new as Record<string, unknown>
          if (typeof coins !== 'number' || cancelled) return
          const s: Settled = {
            coins,
            at: new Date(last_coin_update_at as string).getTime(),
            rate: (coin_rate as number) ?? 0,
          }
          settledRef.current = s
          setRate(s.rate)
          setDisplay(computeDisplay(s))
        }
      )
      .subscribe()

    const tick = setInterval(() => {
      if (settledRef.current) setDisplay(computeDisplay(settledRef.current))
    }, 60_000)

    return () => {
      cancelled = true
      channel.unsubscribe()
      clearInterval(tick)
    }
  }, [])

  const isLoading = display === null

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-bold text-amber-700 flex items-center gap-2"
          style={{ fontFamily: '"Varela Round", sans-serif' }}
        >
          <span>🪙</span> Pot commun
        </h2>

        {rate !== 0 && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            rate > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
          }`}>
            {rate > 0 ? '+1' : '−2'} / min
          </span>
        )}
      </div>

      <div className="flex items-center justify-center py-4">
        {isLoading ? (
          <span className="text-4xl font-bold text-amber-300">…</span>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={display}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className={`text-5xl font-bold tabular-nums ${
                display >= 0 ? 'text-amber-500' : 'text-red-400'
              }`}
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              {display.toLocaleString('fr-FR')}
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      <p className="text-center text-xs text-pink-400 mt-1">
        {rate > 0
          ? "Nidou est heureux, les pièces s'accumulent 😸"
          : rate < 0
          ? "Nidou est triste, les pièces s'envolent 😿"
          : 'Chargement…'}
      </p>
    </div>
  )
}
