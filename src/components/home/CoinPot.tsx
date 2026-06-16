import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { calcStats } from '../pet/PetPage'
import type { PetRow } from '../pet/PetPage'

const NIGHT_START_H = 1
const NIGHT_END_H = 8

function isNighttime(): boolean {
  const h = new Date().getHours()
  return h >= NIGHT_START_H && h < NIGHT_END_H
}

// Nombre de minutes nocturnes (1h-8h) dans l'intervalle [from, to]
function nightMinutes(from: number, to: number): number {
  const MS_PER_HOUR = 3_600_000
  const MS_PER_DAY = 86_400_000
  let totalNightMs = 0
  const d0 = new Date(from)
  d0.setHours(0, 0, 0, 0)
  let dayStart = d0.getTime()
  while (dayStart < to) {
    const nightStart = dayStart + NIGHT_START_H * MS_PER_HOUR
    const nightEnd = dayStart + NIGHT_END_H * MS_PER_HOUR
    const overlapStart = Math.max(from, nightStart)
    const overlapEnd = Math.min(to, nightEnd)
    if (overlapEnd > overlapStart) totalNightMs += overlapEnd - overlapStart
    dayStart += MS_PER_DAY
  }
  return Math.floor(totalNightMs / 60_000)
}

// Minutes effectives hors plage nocturne
function effectiveMinutes(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / 60_000) - nightMinutes(from, to))
}

type Settled = {
  coins: number
  at: number
  rate: number
}

function computeDisplay(s: Settled): number {
  const effective = effectiveMinutes(s.at, Date.now())
  return s.coins + effective * s.rate
}

export function CoinPot() {
  const [display, setDisplay] = useState<number | null>(null)
  const [rate, setRate] = useState(0)
  const [night, setNight] = useState(isNighttime())
  const settledRef = useRef<Settled | null>(null)

  useEffect(() => {
    let cancelled = false
    let wasNight = isNighttime()

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
      const happinessRate = avg > 50 ? 1 : -1
      const newRate = isNighttime() ? 0 : happinessRate

      const lastAt = cfg?.last_coin_update_at
        ? new Date(cfg.last_coin_update_at).getTime()
        : Date.now()
      // On applique happinessRate uniquement sur les minutes hors nuit
      const effective = effectiveMinutes(lastAt, Date.now())
      const newCoins = (cfg?.coins ?? 0) + effective * happinessRate

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
      setNight(isNighttime())
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
          setNight(isNighttime())
          setDisplay(computeDisplay(s))
        }
      )
      .subscribe()

    const tick = setInterval(() => {
      const nowNight = isNighttime()
      // Transition nuit↔jour : on re-settle pour mettre à jour le taux
      if (wasNight !== nowNight) {
        wasNight = nowNight
        settle()
        return
      }
      if (settledRef.current) setDisplay(computeDisplay(settledRef.current))
      setNight(nowNight)
    }, 60_000)

    return () => {
      cancelled = true
      channel.unsubscribe()
      clearInterval(tick)
    }
  }, [])

  const isLoading = display === null

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-bold text-amber-700 flex items-center gap-2"
          style={{ fontFamily: '"Varela Round", sans-serif' }}
        >
          <span>🪙</span> Pot commun
        </h2>

        {!isLoading && (
          night ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-400">
              💤 Pause nuit
            </span>
          ) : rate !== 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              rate > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
            }`}>
              {rate > 0 ? '+1' : '−1'} / min
            </span>
          )
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
        {isLoading
          ? 'Chargement…'
          : night
          ? 'Tout le monde dort, les pièces font une pause 🌙'
          : rate > 0
          ? "Nidou est heureux, les pièces s'accumulent 😸"
          : "Nidou est triste, les pièces s'envolent 😿"}
      </p>
    </div>
  )
}
