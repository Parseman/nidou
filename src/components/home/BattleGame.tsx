import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useBattleGame } from '../../lib/useBattleGame'
import { ITEM_EMOJI, ITEM_LABEL, ITEM_DESC } from '../../lib/battleGame'

// ── 3D ───────────────────────────────────────────────────────────────────────

useGLTF.preload('/prisca.glb')
useGLTF.preload('/cookie.glb')

function CatModel3D({ src, offsetX, flip }: { src: string; offsetX: number; flip?: boolean }) {
  const { scene } = useGLTF(src)
  const cloned = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) groupRef.current.position.set(offsetX, -0.5, 0)
  }, [offsetX])

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.position.y = -0.5 + Math.sin(state.clock.getElapsedTime() * 1.2 + offsetX) * 0.06
  })

  return (
    <>
      <group ref={groupRef}>
        <primitive
          object={cloned}
          scale={flip ? [-0.65, 0.65, 0.65] : [0.65, 0.65, 0.65]}
          position={[0, 0, 0]}
        />
      </group>
    </>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function HPBar({ hp, color }: { hp: number; color: 'pink' | 'violet' }) {
  const fill = hp > 6 ? 'bg-green-400' : hp > 3 ? 'bg-yellow-400' : 'bg-red-400'
  const bg = color === 'pink' ? 'bg-pink-100/40 dark:bg-pink-900/20' : 'bg-violet-100/40 dark:bg-violet-900/20'
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`h-2.5 flex-1 rounded-full transition-colors duration-500 ${i < hp ? fill : bg}`} />
      ))}
    </div>
  )
}

function XPBar({ xp }: { xp: number }) {
  return (
    <div className="w-full h-1.5 bg-white/20 dark:bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-yellow-400 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${xp % 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BattleGame({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showForge, setShowForge] = useState(false)

  const {
    myState, partnerState, inventory, spawn,
    showItemModal, setShowItemModal,
    claiming, acting, actionMsg,
    myLevel, partnerLevel, myHp,
    swordCount, shieldCount, canForge,
    claimItem, handleUseSword, handleUseHeart, handleActivateShield, handleForge,
  } = useBattleGame(user)

  async function onForge(base: 'sword' | 'shield') {
    const ok = await handleForge(base)
    if (ok) {
      setShowForge(false)
      setShowInventory(true)
    }
  }

  // Attribution des modèles : user_id le plus petit alphabétiquement = prisca, l'autre = cookie
  const partnerId = partnerState?.user_id ?? ''
  const iAmPrisca = !partnerId || user.id < partnerId
  const myModel      = iAmPrisca ? '/prisca.glb' : '/cookie.glb'
  const partnerModel = iAmPrisca ? '/cookie.glb' : '/prisca.glb'
  const myLabel      = iAmPrisca ? 'Prisca (Clément)' : 'Cookie (Léona)'
  const partnerLabel = iAmPrisca ? 'Cookie (Léona)' : 'Prisca (Clément)'

  const hasUnclaimedItem = spawn && !spawn.claimed_by
  const myShieldLabel = myState?.shield_type
    ? myState.shield_type === 'enhanced'
      ? `🛡️✨ Bouclier Amélioré (${myState.shield_charges}/3)`
      : '🛡️ Bouclier Normal actif'
    : null

  return (
    <>
      {/* ── Compact card ─────────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full rounded-3xl overflow-hidden cursor-pointer shadow-xl shadow-purple-300/50 dark:shadow-purple-900/20 focus:outline-none group"
        style={{ aspectRatio: '1 / 1' }}
        aria-label="Jeu Combat"
      >
        <img
          src="/battle-cover.png"
          alt="Combat"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {hasUnclaimedItem && (
          <div className="absolute top-3 left-3 w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse z-10" />
        )}

        {/* HP dots */}
        <div className="absolute top-4 left-4 flex gap-0.5 max-w-[calc(100%-3.5rem)]">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${
              i < myHp
                ? myHp > 6 ? 'bg-green-300' : myHp > 3 ? 'bg-yellow-300' : 'bg-red-300'
                : 'bg-white/25'
            }`} />
          ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="w-full h-1 bg-white/30 rounded-full mb-1.5 overflow-hidden">
            <div className="h-full bg-yellow-300 rounded-full" style={{ width: `${(myState?.xp ?? 0) % 100}%` }} />
          </div>
          <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: '"Varela Round", sans-serif' }}>
            Combat
          </p>
          <p className="text-white/80 text-xs truncate">
            {myShieldLabel || `Niv. ${myLevel} · ${myHp}/10 ❤️`}
          </p>
        </div>
      </motion.button>

      {/* ── Item spawn modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showItemModal && spawn && !spawn.claimed_by && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              className="relative glass-card rounded-3xl p-8 max-w-xs w-full text-center"
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            >
              <button onClick={() => setShowItemModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-pink-200 transition-colors">
                <X size={18} />
              </button>
              <motion.div className="text-7xl mb-4"
                animate={{ rotate: [-8, 8, -8], scale: [1, 1.12, 1] }}
                transition={{ duration: 2, repeat: Infinity }}>
                {spawn.item_type === 'sword' ? '⚔️' : spawn.item_type === 'heart' ? '💛' : '🛡️'}
              </motion.div>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-300 tracking-widest uppercase mb-2">Un objet est apparu !</p>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-pink-200 mb-2"
                style={{ fontFamily: '"Varela Round", sans-serif' }}>
                {spawn.item_type === 'sword' ? 'Épée' : spawn.item_type === 'heart' ? 'Cœur' : 'Bouclier'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-pink-300 mb-6">
                {ITEM_DESC[spawn.item_type]}
              </p>
              <motion.button
                onClick={claimItem}
                disabled={claiming}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="btn-primary w-full py-3 rounded-2xl font-bold text-base disabled:opacity-50"
              >
                {claiming
                  ? <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Récupération…
                    </span>
                  : '✅ Récupérer !'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game modal ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-2xl glass-card rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800 dark:text-pink-200 text-lg flex items-center gap-2"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}>
                  ⚔️ Combat
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowForge(false); setShowInventory(v => !v) }}
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      showInventory
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50'
                    }`}
                  >
                    🎒 Sac ({inventory.length})
                  </button>
                  {canForge && (
                    <button
                      onClick={() => { setShowInventory(false); setShowForge(v => !v) }}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                        showForge
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50'
                      }`}
                    >
                      🔨 Enclume
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-pink-200 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Action message */}
              <AnimatePresence>
                {actionMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-3 text-center text-sm font-bold text-purple-900 dark:text-purple-200 bg-purple-200/70 dark:bg-purple-900/40 px-4 py-2.5 rounded-2xl border border-purple-300/50 dark:border-purple-700/30"
                  >
                    {actionMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 2 carrés — un par chat */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* ── Mon chat ── */}
                <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-pink-100 to-purple-50 dark:from-pink-900/30 dark:to-purple-900/20 border border-pink-200/50 dark:border-pink-800/20">
                  <p className="text-xs font-bold text-pink-700 dark:text-pink-300 tracking-wide text-center pt-2">
                    {myLabel} — Niv. {myLevel}
                  </p>
                  <div style={{ height: 150 }}>
                    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-4xl">🐱</div>}>
                      <Canvas camera={{ position: [0, 0.1, 1.1], fov: 28 }}>
                        <ambientLight intensity={2.5} />
                        <directionalLight position={[2, 5, 3]} intensity={3} />
                        <directionalLight position={[-2, 2, -2]} intensity={1} />
                        <CatModel3D src={myModel} offsetX={0} />
                        <ContactShadows position={[0, -1.2, 0]} opacity={0.2} blur={2} />
                        <OrbitControls enablePan={false} minDistance={0.8} maxDistance={4} />
                      </Canvas>
                    </Suspense>
                  </div>
                  <div className="px-3 pb-3 space-y-1.5">
                    {myState?.shield_type && (
                      <div className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-lg text-center">
                        {myState.shield_type === 'enhanced' ? `🛡️✨ ×3 (${myState.shield_charges})` : '🛡️ Bouclier'}
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-pink-700 dark:text-pink-300">❤️ {myState?.hp ?? 10}/10</span>
                      <HPBar hp={myState?.hp ?? 10} color="pink" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">⭐ {(myState?.xp ?? 0) % 100}/100</span>
                      <XPBar xp={myState?.xp ?? 0} />
                    </div>
                  </div>
                </div>

                {/* ── Chat partenaire ── */}
                <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-violet-100 to-indigo-50 dark:from-violet-900/30 dark:to-indigo-900/20 border border-violet-200/50 dark:border-violet-800/20">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300 tracking-wide text-center pt-2">
                    {partnerLabel} — Niv. {partnerLevel}
                  </p>
                  <div style={{ height: 150 }}>
                    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-4xl">🐱</div>}>
                      <Canvas camera={{ position: [0, 0.1, 1.1], fov: 28 }}>
                        <ambientLight intensity={2.5} />
                        <directionalLight position={[-2, 5, 3]} intensity={3} />
                        <directionalLight position={[2, 2, -2]} intensity={1} />
                        <CatModel3D src={partnerModel} offsetX={0} flip />
                        <ContactShadows position={[0, -1.2, 0]} opacity={0.2} blur={2} />
                        <OrbitControls enablePan={false} minDistance={0.8} maxDistance={4} />
                      </Canvas>
                    </Suspense>
                  </div>
                  <div className="px-3 pb-3 space-y-1.5">
                    {partnerState?.shield_type && (
                      <div className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-lg text-center">
                        {partnerState.shield_type === 'enhanced' ? `🛡️✨ ×3 (${partnerState.shield_charges})` : '🛡️ Bouclier'}
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">❤️ {partnerState?.hp ?? 10}/10</span>
                      <HPBar hp={partnerState?.hp ?? 10} color="violet" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">⭐ {(partnerState?.xp ?? 0) % 100}/100</span>
                      <XPBar xp={partnerState?.xp ?? 0} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory panel */}
              <AnimatePresence>
                {showInventory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-200 dark:border-pink-900/30 pt-4 mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-pink-300 mb-3">🎒 Inventaire</h3>
                      {inventory.length === 0 ? (
                        <p className="text-center text-sm text-slate-500 dark:text-pink-400 py-3">
                          Ton inventaire est vide…
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {inventory.map(item => (
                            <div key={item.id}
                              className="flex items-center justify-between bg-white/70 dark:bg-white/5 rounded-2xl px-3 py-2 border border-slate-100 dark:border-white/5">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{ITEM_EMOJI[item.item_type]}</span>
                                <span className="text-sm font-semibold text-slate-800 dark:text-pink-200">
                                  {ITEM_LABEL[item.item_type]}
                                </span>
                              </div>
                              <div className="flex gap-1.5">
                                {(item.item_type === 'sword' || item.item_type === 'enhanced_sword') && (
                                  <button
                                    onClick={() => handleUseSword(item)}
                                    disabled={acting}
                                    className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold disabled:opacity-40 transition-colors"
                                  >
                                    Attaquer
                                  </button>
                                )}
                                {item.item_type === 'heart' && (
                                  <button
                                    onClick={() => handleUseHeart(item)}
                                    disabled={acting || (myState?.hp ?? 10) >= 10}
                                    className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold disabled:opacity-40 transition-colors"
                                  >
                                    Se soigner
                                  </button>
                                )}
                                {(item.item_type === 'shield' || item.item_type === 'enhanced_shield') && (
                                  <button
                                    onClick={() => handleActivateShield(item)}
                                    disabled={acting || !!myState?.shield_type}
                                    className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-40 transition-colors"
                                  >
                                    {myState?.shield_type ? 'Déjà actif' : 'Activer'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Forge panel */}
              <AnimatePresence>
                {showForge && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-200 dark:border-pink-900/30 pt-4 mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-orange-300 mb-1">🔨 Enclume — Forge</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Fusionne 3 objets identiques pour créer une version améliorée.
                      </p>
                      <div className="space-y-2">
                        {swordCount >= 3 && (
                          <div className="flex items-center justify-between bg-white/70 dark:bg-white/5 rounded-2xl px-3 py-2 border border-slate-100 dark:border-white/5">
                            <div>
                              <span className="text-sm font-semibold text-slate-800 dark:text-pink-200">
                                ⚔️⚔️⚔️ → 🗡️ Épée Améliorée
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Inflige 5 dégâts au lieu de 1</p>
                            </div>
                            <button
                              onClick={() => onForge('sword')}
                              disabled={acting}
                              className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-40 transition-colors"
                            >
                              Forger !
                            </button>
                          </div>
                        )}
                        {shieldCount >= 3 && (
                          <div className="flex items-center justify-between bg-white/70 dark:bg-white/5 rounded-2xl px-3 py-2 border border-slate-100 dark:border-white/5">
                            <div>
                              <span className="text-sm font-semibold text-slate-800 dark:text-pink-200">
                                🛡️🛡️🛡️ → 🛡️✨ Bouclier Amélioré
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">3 charges + riposte automatique</p>
                            </div>
                            <button
                              onClick={() => onForge('shield')}
                              disabled={acting}
                              className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-40 transition-colors"
                            >
                              Forger !
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Spawn status */}
              <div className="border-t border-slate-200 dark:border-pink-900/30 pt-3">
                <p className="text-xs text-center text-slate-500 dark:text-pink-400">
                  {!spawn
                    ? '⏳ Prochain objet bientôt…'
                    : spawn.claimed_by
                      ? spawn.claimed_by === user.id
                        ? '✅ Objet récupéré par toi'
                        : '✅ Objet récupéré par ton partenaire'
                      : '🟡 Un objet est disponible sur la page d\'accueil !'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
