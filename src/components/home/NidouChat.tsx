import { useState, useEffect, useRef, useId, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Utensils, Droplets, Heart } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { awardCoins } from '../../lib/wallet'

// ── Constantes ────────────────────────────────────────────────────────────────

export const DECAY_PER_HOUR = { hunger: 3, hygiene: 2, happiness: 1.5 }

export const COOLDOWN_MS = {
  hunger:    4 * 3_600_000,
  hygiene:   6 * 3_600_000,
  happiness: 30 * 60_000,
}

export const BONUS = { hunger: 80, hygiene: 80, happiness: 60 }

// Récompense en pièces de la bourse individuelle pour chaque action
const COIN_REWARD = { hunger: 20, hygiene: 20, happiness: 5 }

const STAT_CONFIG = {
  hunger:    { lastKey: 'last_fed_at'    as const, animKey: 'fed'    as const },
  hygiene:   { lastKey: 'last_washed_at' as const, animKey: 'washed' as const },
  happiness: { lastKey: 'last_pet_at'    as const, animKey: 'pet'    as const },
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PetRow = {
  hunger:         number
  hygiene:        number
  happiness:      number
  last_fed_at:    string
  last_washed_at: string
  last_pet_at:    string
}

export type StatKey   = keyof typeof STAT_CONFIG
export type AnimState = 'idle' | 'fed' | 'washed' | 'pet'
export type Mood      = 'happy' | 'normal' | 'sad'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function calcStats(row: PetRow) {
  const now = Date.now()
  const hrs  = (ts: string) => (now - new Date(ts).getTime()) / 3_600_000
  return {
    hunger:    Math.max(0, Math.min(100, row.hunger    - DECAY_PER_HOUR.hunger    * hrs(row.last_fed_at))),
    hygiene:   Math.max(0, Math.min(100, row.hygiene   - DECAY_PER_HOUR.hygiene   * hrs(row.last_washed_at))),
    happiness: Math.max(0, Math.min(100, row.happiness - DECAY_PER_HOUR.happiness * hrs(row.last_pet_at))),
  }
}

export function canAct(lastAt: string, cooldownMs: number) {
  return Date.now() - new Date(lastAt).getTime() > cooldownMs
}

function fmtCooldown(lastAt: string, cooldownMs: number): string {
  const remaining = cooldownMs - (Date.now() - new Date(lastAt).getTime())
  if (remaining <= 0) return ''
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getMood(row: PetRow): Mood {
  const s   = calcStats(row)
  const avg = (s.hunger + s.hygiene + s.happiness) / 3
  return avg > 65 ? 'happy' : avg > 30 ? 'normal' : 'sad'
}

// ── 3D : modèle ───────────────────────────────────────────────────────────────

function CatModel({ anim, mood }: { anim: AnimState; mood: Mood }) {
  const { scene } = useGLTF('/nidouchat-v1.glb')
  const g    = useRef<THREE.Group>(null)
  const prog = useRef(0)

  useEffect(() => { prog.current = 0 }, [anim])

  useFrame((state, delta) => {
    if (!g.current) return
    const t = state.clock.getElapsedTime()

    if (anim === 'idle') {
      const speed = mood === 'happy' ? 2.2 : mood === 'sad' ? 0.7 : 1.5
      const amp   = mood === 'happy' ? 0.07 : mood === 'sad' ? 0.02 : 0.04
      g.current.position.y = (mood === 'sad' ? -0.06 : 0) + Math.sin(t * speed) * amp
      g.current.rotation.y = Math.sin(t * 0.4) * (mood === 'sad' ? 0.05 : 0.15)
      g.current.rotation.z = 0
      g.current.scale.setScalar(mood === 'sad' ? 0.92 : 1)

    } else if (anim === 'fed') {
      prog.current = Math.min(prog.current + delta * 2, 1)
      const p = prog.current
      g.current.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.28)
      g.current.position.y  = Math.abs(Math.sin(p * Math.PI * 2)) * 0.2
      g.current.rotation.y += delta * 2.5
      g.current.rotation.z  = 0

    } else if (anim === 'washed') {
      prog.current = Math.min(prog.current + delta * 3, 1)
      const p = prog.current
      g.current.rotation.z  = Math.sin(p * Math.PI * 5) * 0.45 * (1 - p * 0.8)
      g.current.position.y  = Math.sin(t * 2) * 0.03
      g.current.scale.setScalar(1)

    } else if (anim === 'pet') {
      prog.current = Math.min(prog.current + delta * 2.5, 1)
      const p = prog.current
      g.current.position.y  = Math.abs(Math.sin(p * Math.PI * 4)) * 0.16
      g.current.rotation.y += delta * 3.5
      g.current.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.14)
      g.current.rotation.z  = 0
    }
  })

  return (
    <group ref={g}>
      <primitive object={scene} scale={0.8} rotation={[0, 0, 0]} />
    </group>
  )
}

useGLTF.preload('/nidouchat-v1.glb')

// ── Petite pastille de stat (carte compacte) ─────────────────────────────────

function StatDot({ value }: { value: number }) {
  const color =
    value > 60 ? 'bg-green-400' :
    value > 30 ? 'bg-amber-400' :
                 'bg-red-400'
  return <span className={`w-3 h-3 rounded-full ${color} shadow-sm`} />
}

// ── Actions & stats (contenu de la modale) ───────────────────────────────────

const ACTIONS_META = [
  {
    stat:    'hunger'    as StatKey,
    emoji:   '🍣',
    label:   'Nourrir',
    animKey: 'fed'    as AnimState,
    cooldownMs: COOLDOWN_MS.hunger,
    lastKey: 'last_fed_at' as keyof PetRow,
  },
  {
    stat:    'hygiene'   as StatKey,
    emoji:   '🛁',
    label:   'Laver',
    animKey: 'washed' as AnimState,
    cooldownMs: COOLDOWN_MS.hygiene,
    lastKey: 'last_washed_at' as keyof PetRow,
  },
  {
    stat:    'happiness' as StatKey,
    emoji:   '🫶',
    label:   'Câliner',
    animKey: 'pet'    as AnimState,
    cooldownMs: COOLDOWN_MS.happiness,
    lastKey: 'last_pet_at' as keyof PetRow,
  },
]

const STATS_META = [
  { key: 'hunger'    as StatKey, label: 'Faim',    icon: <Utensils size={13} />, gradient: 'from-amber-400 to-orange-400' },
  { key: 'hygiene'   as StatKey, label: 'Hygiène', icon: <Droplets size={13} />, gradient: 'from-blue-400 to-cyan-400'   },
  { key: 'happiness' as StatKey, label: 'Bonheur', icon: <Heart    size={13} />, gradient: 'from-pink-400 to-violet-400' },
]

function ActionsRow({
  row,
  anim,
  onAct,
}: {
  row:   PetRow
  anim:  AnimState
  onAct: (stat: StatKey) => void
}) {
  const [, tick] = useState(0)
  // Rafraîchit le countdown chaque minute
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS_META.map(({ stat, emoji, label, cooldownMs, lastKey }) => {
        const available = canAct(row[lastKey] as string, cooldownMs)
        const countdown = available ? '' : fmtCooldown(row[lastKey] as string, cooldownMs)
        const busy = anim !== 'idle'

        return (
          <motion.button
            key={stat}
            onClick={() => onAct(stat)}
            disabled={!available || busy}
            whileHover={available && !busy ? { scale: 1.04 } : {}}
            whileTap={available && !busy ? { scale: 0.96 } : {}}
            className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl text-center transition-colors
                        ${available && !busy
                          ? 'bg-white/60 dark:bg-white/5 hover:bg-pink-50 dark:hover:bg-pink-900/20 cursor-pointer shadow-sm'
                          : 'bg-pink-50/30 dark:bg-white/5 cursor-not-allowed'
                        }`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className={`text-xs font-bold ${available && !busy ? 'text-pink-700 dark:text-pink-200' : 'text-pink-300 dark:text-pink-500'}`}>
              {label}
            </span>
            <span className={`text-[10px] ${available && !busy ? 'text-pink-400 dark:text-pink-300' : 'text-pink-200 dark:text-pink-600'}`}>
              {available ? 'Disponible' : countdown}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

function StatsRow({ stats }: { stats: ReturnType<typeof calcStats> }) {
  return (
    <div className="flex flex-col gap-2.5">
      {STATS_META.map(({ key, label, icon, gradient }) => {
        const value = stats[key]
        const barColor =
          value > 60 ? gradient :
          value > 30 ? 'from-amber-300 to-orange-300' :
                       'from-red-400 to-red-500'

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-300">
                {icon}
                <span className="text-xs font-semibold">{label}</span>
              </div>
              <span className="text-xs font-bold text-pink-500 dark:text-pink-300 tabular-nums">
                {Math.round(value)}
              </span>
            </div>
            <div className="h-2 bg-pink-50 dark:bg-pink-900/30 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal : card + modale ──────────────────────────────────────

export function NidouChatIcon({ user }: { user: User }) {
  const [row, setRow] = useState<PetRow | null>(null)
  const [open, setOpen] = useState(false)
  const [anim, setAnim] = useState<AnimState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const animTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

    return () => {
      supabase.removeChannel(channel)
      if (animTimer.current)  clearTimeout(animTimer.current)
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [instanceId])

  const triggerAnim = (a: AnimState) => {
    if (animTimer.current) clearTimeout(animTimer.current)
    setAnim(a)
    animTimer.current = setTimeout(() => setAnim('idle'), 1800)
  }

  const act = async (stat: StatKey) => {
    if (!row || anim !== 'idle') return
    const { lastKey, animKey } = STAT_CONFIG[stat]
    if (!canAct(row[lastKey], COOLDOWN_MS[stat])) return

    const previous = row
    const current  = calcStats(row)
    const newValue = Math.min(100, current[stat] + BONUS[stat])
    const now      = new Date().toISOString()

    setRow((prev) => prev ? { ...prev, [stat]: newValue, [lastKey]: now } : prev)
    triggerAnim(animKey)

    const { error } = await supabase
      .from('pet')
      .update({ [stat]: newValue, [lastKey]: now, updated_at: now })
      .eq('id', 1)

    if (!error) {
      awardCoins(user.id, COIN_REWARD[stat])
    }

    if (error) {
      setRow(previous)
      if (animTimer.current) clearTimeout(animTimer.current)
      setAnim('idle')
      if (errorTimer.current) clearTimeout(errorTimer.current)
      setActionError("Échec de la sauvegarde, réessaie.")
      errorTimer.current = setTimeout(() => setActionError(null), 4000)
    }
  }

  const mood       = row ? getMood(row) : 'normal'
  const moodLabel  = mood === 'happy' ? 'Heureux 😸' : mood === 'sad' ? 'Malheureux 😿' : 'Ça va 🐱'
  const stats      = row ? calcStats(row) : null
  const needsAttention = row
    ? (!canAct(row.last_fed_at, COOLDOWN_MS.hunger) === false ||
       !canAct(row.last_washed_at, COOLDOWN_MS.hygiene) === false ||
       !canAct(row.last_pet_at, COOLDOWN_MS.happiness) === false)
    : false

  return (
    <>
      {/* ── Card compacte ──────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden cursor-pointer
                   shadow-xl shadow-violet-200/50 focus:outline-none group"
        aria-label="Ouvrir Nidou le chat"
      >
        <img
          src="/nidou-cover.png"
          alt="Nidou le chat"
          className="w-full object-cover aspect-square
                     group-hover:scale-105 transition-transform duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

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

          {stats && (
            <div className="flex gap-2 items-center">
              <StatDot value={stats.hunger} />
              <StatDot value={stats.hygiene} />
              <StatDot value={stats.happiness} />
            </div>
          )}
        </div>
      </motion.button>

      {/* ── Modale ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-md glass-card rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-pink-700 dark:text-pink-200 text-base flex items-center gap-2"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}>
                  🐱 Nidou le chat
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-pink-400 dark:text-pink-300 font-medium">{moodLabel}</span>
                  <button onClick={() => setOpen(false)}
                    className="text-pink-300 hover:text-pink-500 dark:hover:text-pink-200 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 3D */}
              <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-violet-50 via-pink-50 to-white dark:from-violet-950/40 dark:via-pink-950/30 dark:to-transparent shadow-inner mb-4"
                style={{ height: 260 }}>
                <Canvas camera={{ position: [0, 0.3, 6], fov: 40 }}>
                  <ambientLight intensity={1} />
                  <directionalLight position={[4, 6, 4]} intensity={1.4} castShadow />
                  <pointLight position={[-3, 3, -2]} intensity={0.6} color="#f9a8d4" />
                  <pointLight position={[3, -1, 3]}  intensity={0.3} color="#c4b5fd" />

                  <Suspense fallback={null}>
                    <OrbitControls
                      enablePan={false}
                      enableZoom={false}
                      minPolarAngle={Math.PI / 4}
                      maxPolarAngle={Math.PI / 1.8}
                    />
                    <CatModel anim={anim} mood={mood} />
                    <ContactShadows
                      position={[0, -1, 0]}
                      opacity={0.15}
                      blur={2}
                      scale={5}
                    />
                  </Suspense>
                </Canvas>
              </div>

              {/* Actions */}
              {row ? (
                <ActionsRow row={row} anim={anim} onAct={act} />
              ) : (
                <div className="h-20 rounded-2xl bg-pink-50/40 dark:bg-white/5 animate-pulse" />
              )}

              <AnimatePresence>
                {actionError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-500 text-center font-medium mt-2"
                  >
                    {actionError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Stats */}
              <div className="border-t border-pink-100 dark:border-pink-900/30 mt-4 pt-4">
                {stats ? (
                  <StatsRow stats={stats} />
                ) : (
                  <div className="h-16 rounded-2xl bg-pink-50/40 dark:bg-white/5 animate-pulse" />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default NidouChatIcon
