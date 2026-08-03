import { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Utensils, Droplets, Heart } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// ── Constantes ────────────────────────────────────────────────────────────────

export const DECAY_PER_HOUR = { hunger: 3, hygiene: 2, happiness: 1.5 }

export const COOLDOWN_MS = {
  hunger:    4 * 3_600_000,
  hygiene:   6 * 3_600_000,
  happiness: 30 * 60_000,
}

export const BONUS = { hunger: 80, hygiene: 80, happiness: 60 }

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
      {/* ⚙️ Ajuste scale/rotation si le chat n'est pas bien cadré */}
      <primitive object={scene} scale={0.8} rotation={[0, 0, 0]} />
    </group>
  )
}

useGLTF.preload('/nidouchat-v1.glb')

// ── Panneau Stats (droite) ────────────────────────────────────────────────────

const STATS_META = [
  { key: 'hunger'    as StatKey, label: 'Faim',    icon: <Utensils size={15} />, gradient: 'from-amber-400 to-orange-400' },
  { key: 'hygiene'   as StatKey, label: 'Hygiène', icon: <Droplets size={15} />, gradient: 'from-blue-400 to-cyan-400'   },
  { key: 'happiness' as StatKey, label: 'Bonheur', icon: <Heart    size={15} />, gradient: 'from-pink-400 to-violet-400' },
]

function StatsPanel({ stats }: { stats: ReturnType<typeof calcStats> }) {
  return (
    <div className="glass-card rounded-3xl p-6 flex flex-col gap-6 h-full">
      <p className="text-xs font-bold text-pink-400 uppercase tracking-widest">État de santé</p>

      <div className="flex flex-col gap-5 flex-1 justify-center">
        {STATS_META.map(({ key, label, icon, gradient }) => {
          const value = stats[key]
          const barColor =
            value > 60 ? gradient :
            value > 30 ? 'from-amber-300 to-orange-300' :
                         'from-red-400 to-red-500'
          const emoji =
            value > 70 ? '😊' : value > 40 ? '😐' : '😟'

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-pink-600">
                  {icon}
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{emoji}</span>
                  <span className="text-sm font-bold text-pink-500 tabular-nums w-7 text-right">
                    {Math.round(value)}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-pink-50 rounded-full overflow-hidden">
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

      {/* Score global */}
      <div className="border-t border-pink-100 pt-4">
        <p className="text-xs text-pink-400 mb-1 font-medium">Bien-être global</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-pink-50 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400"
              animate={{ width: `${(stats.hunger + stats.hygiene + stats.happiness) / 3}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs font-bold text-pink-500 tabular-nums">
            {Math.round((stats.hunger + stats.hygiene + stats.happiness) / 3)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Panneau Actions (gauche) ──────────────────────────────────────────────────

const ACTIONS_META = [
  {
    stat:    'hunger'    as StatKey,
    emoji:   '🍣',
    label:   'Nourrir',
    desc:    'Donne-lui à manger',
    animKey: 'fed'    as AnimState,
    cooldownMs: COOLDOWN_MS.hunger,
    lastKey: 'last_fed_at' as keyof PetRow,
  },
  {
    stat:    'hygiene'   as StatKey,
    emoji:   '🛁',
    label:   'Laver',
    desc:    'Donne-lui un bain',
    animKey: 'washed' as AnimState,
    cooldownMs: COOLDOWN_MS.hygiene,
    lastKey: 'last_washed_at' as keyof PetRow,
  },
  {
    stat:    'happiness' as StatKey,
    emoji:   '🫶',
    label:   'Câliner',
    desc:    'Fais-lui des câlins',
    animKey: 'pet'    as AnimState,
    cooldownMs: COOLDOWN_MS.happiness,
    lastKey: 'last_pet_at' as keyof PetRow,
  },
]

function ActionsPanel({
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
    <div className="glass-card rounded-3xl p-6 flex flex-col gap-4 h-full">
      <p className="text-xs font-bold text-pink-400 uppercase tracking-widest">Actions</p>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {ACTIONS_META.map(({ stat, emoji, label, desc, cooldownMs, lastKey }) => {
          const available = canAct(row[lastKey] as string, cooldownMs)
          const countdown = available ? '' : fmtCooldown(row[lastKey] as string, cooldownMs)
          const busy = anim !== 'idle'

          return (
            <motion.button
              key={stat}
              onClick={() => onAct(stat)}
              disabled={!available || busy}
              whileHover={available && !busy ? { scale: 1.03 } : {}}
              whileTap={available && !busy ? { scale: 0.97 } : {}}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left
                          transition-colors
                          ${available && !busy
                            ? 'bg-white/60 hover:bg-pink-50 cursor-pointer shadow-sm'
                            : 'bg-pink-50/30 cursor-not-allowed'
                          }`}
            >
              <span className="text-3xl shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${available && !busy ? 'text-pink-700' : 'text-pink-300'}`}>
                  {label}
                </p>
                <p className={`text-xs mt-0.5 ${available && !busy ? 'text-pink-400' : 'text-pink-200'}`}>
                  {available ? desc : `Disponible dans ${countdown}`}
                </p>
              </div>
              <AnimatePresence>
                {available && !busy && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-2 h-2 rounded-full bg-green-400 shrink-0"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>

      <p className="text-xs text-pink-200 text-center leading-relaxed">
        Prenez soin de lui ensemble 🐾
      </p>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function PetPage({ user: _user, onBack }: { user: User; onBack: () => void }) {
  const [row,  setRow]  = useState<PetRow | null>(null)
  const [anim, setAnim] = useState<AnimState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const animTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase
      .from('pet')
      .select('hunger, hygiene, happiness, last_fed_at, last_washed_at, last_pet_at')
      .eq('id', 1)
      .single()
      .then(({ data }) => { if (data) setRow(data as PetRow) })

    const channel = supabase
      .channel('pet-page-realtime')
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
  }, [])

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

    if (error) {
      setRow(previous)
      if (animTimer.current) clearTimeout(animTimer.current)
      setAnim('idle')
      if (errorTimer.current) clearTimeout(errorTimer.current)
      setActionError("Échec de la sauvegarde, réessaie.")
      errorTimer.current = setTimeout(() => setActionError(null), 4000)
    }
  }

  const stats = row ? calcStats(row) : { hunger: 0, hygiene: 0, happiness: 0 }
  const avg   = (stats.hunger + stats.hygiene + stats.happiness) / 3
  const mood: Mood = avg > 65 ? 'happy' : avg > 30 ? 'normal' : 'sad'

  const moodLabel = mood === 'happy' ? 'Heureux 😸' : mood === 'sad' ? 'Malheureux 😿' : 'Ça va 🐱'

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-200/25 rounded-full blur-3xl animate-blob-delayed" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-rose-200/20 rounded-full blur-3xl animate-blob-slow" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <div className="max-w-5xl mx-auto glass-card rounded-2xl px-4 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-pink-400 hover:text-pink-600
                       transition-colors cursor-pointer font-medium text-sm"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
            <span>Retour</span>
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="font-bold text-pink-700 text-base"
              style={{ fontFamily: '"Varela Round", sans-serif' }}>
              Nidou le chat
            </span>
            <span className="text-xs text-pink-400 font-medium">· {moodLabel}</span>
          </div>

          {/* Spacer pour centrer le titre */}
          <div className="w-16" aria-hidden />
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="px-4 py-6">
        <div className="max-w-5xl mx-auto">

          {/* Layout desktop : 3 colonnes / mobile : empilé */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={{ minHeight: '72vh' }}>

            {/* ── Colonne gauche : Actions ── */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
              {row ? (
                <ActionsPanel row={row} anim={anim} onAct={act} />
              ) : (
                <div className="glass-card rounded-3xl h-full min-h-48 animate-pulse" />
              )}
              <AnimatePresence>
                {actionError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-500 text-center font-medium px-2"
                  >
                    {actionError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Colonne centrale : 3D ── */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1 rounded-3xl overflow-hidden
                              bg-gradient-to-b from-violet-50 via-pink-50 to-white
                              shadow-inner" style={{ minHeight: '360px' }}>
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

              {/* Hint interaction */}
              <p className="text-center text-pink-300 text-xs">
                Glisse pour faire tourner le chat
              </p>
            </div>

            {/* ── Colonne droite : Stats ── */}
            <div className="w-full lg:w-64 shrink-0">
              {row ? (
                <StatsPanel stats={stats} />
              ) : (
                <div className="glass-card rounded-3xl h-full min-h-48 animate-pulse" />
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
