import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, ThumbsUp, ThumbsDown, Camera, RefreshCw, Clock } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { THEMES } from '../../lib/photoGameThemes'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

type GameRow = {
  id: number
  theme_index: number
  started_at: string
  photo_1_url: string | null
  photo_1_user_id: string | null
  photo_2_url: string | null
  photo_2_user_id: string | null
  vote_1: boolean | null
  vote_2: boolean | null
  status: 'active' | 'voting' | 'done'
  updated_at: string
}

function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return 'Expiré'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  return `${h}h${m > 0 ? ` ${m}m` : ''}`
}

export function PhotoGame({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [game, setGame] = useState<GameRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from('photo_game').select('*').eq('id', 1).single()
    if (!data) { setLoading(false); return }
    const g = data as GameRow
    const expired =
      (g.status === 'active' && Date.now() - new Date(g.started_at).getTime() > THREE_DAYS_MS) ||
      (g.status === 'done' && Date.now() - new Date(g.updated_at).getTime() > THREE_DAYS_MS)
    if (expired) {
      const { data: advanced } = await supabase.rpc('advance_photo_game')
      if (advanced) await sendNotif('new_theme')
      const { data: fresh } = await supabase.from('photo_game').select('*').eq('id', 1).single()
      if (fresh) setGame(fresh as GameRow)
    } else {
      setGame(g)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadGame()
    const ch = supabase
      .channel('photo-game-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'photo_game' },
        (p) => setGame(p.new as GameRow))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadGame])

  useEffect(() => {
    if (!game || (game.status !== 'active' && game.status !== 'done')) { setTimeLeft(''); return }
    const baseTime = game.status === 'active' ? game.started_at : game.updated_at
    const tick = () => {
      const ms = THREE_DAYS_MS - (Date.now() - new Date(baseTime).getTime())
      setTimeLeft(fmtTimeLeft(ms))
      if (ms <= 0) {
        supabase.rpc('advance_photo_game').then(({ data: advanced }) => {
          if (advanced) sendNotif('new_theme')
          loadGame()
        })
      }
    }
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [game?.started_at, game?.updated_at, game?.status, loadGame])

  // Ma position (slot 1 ou 2)
  const mySlot = game?.photo_1_user_id === user.id ? 1
    : game?.photo_2_user_id === user.id ? 2
    : null
  const myPhoto = mySlot === 1 ? game?.photo_1_url : mySlot === 2 ? game?.photo_2_url : null
  const partnerPhoto = mySlot === 1 ? game?.photo_2_url : mySlot === 2 ? game?.photo_1_url : null
  // Mon vote (sur la photo du partenaire) + le vote du partenaire (sur ma photo)
  const myVote = mySlot === 1 ? game?.vote_2 : mySlot === 2 ? game?.vote_1 : null
  const partnerVoteOnMine = mySlot === 1 ? game?.vote_1 : mySlot === 2 ? game?.vote_2 : null

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !game || uploading) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${game.theme_index}/${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('photo-game').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('photo-game').getPublicUrl(path)

      const { data: g2 } = await supabase.from('photo_game')
        .select('photo_1_user_id, photo_2_user_id').eq('id', 1).single()
      if (!g2) throw new Error('Game not found')

      // Éviter le double upload
      if (g2.photo_1_user_id === user.id || g2.photo_2_user_id === user.id) return

      const useSlot1 = !g2.photo_1_user_id
      const otherUserId = useSlot1 ? g2.photo_2_user_id : g2.photo_1_user_id
      const willComplete = !!otherUserId

      await supabase.from('photo_game').update({
        ...(useSlot1
          ? { photo_1_url: publicUrl, photo_1_user_id: user.id }
          : { photo_2_url: publicUrl, photo_2_user_id: user.id }),
        ...(willComplete ? { status: 'voting' } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', 1)

      if (willComplete && otherUserId) {
        await sendNotif('partner_uploaded', { target_user_id: otherUserId })
      } else {
        await sendNotif('photo_uploaded', { exclude_user_id: user.id })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function castVote(liked: boolean) {
    if (!game || voting || mySlot === null || myVote !== null && myVote !== undefined) return
    setVoting(true)
    try {
      const myVoteField = mySlot === 1 ? 'vote_2' : 'vote_1'
      const partnerVoteField = mySlot === 1 ? 'vote_1' : 'vote_2'
      const partnerId = mySlot === 1 ? game.photo_2_user_id : game.photo_1_user_id
      const { data: g2 } = await supabase.from('photo_game').select('vote_1, vote_2').eq('id', 1).single()
      const partnerDone = g2 ? (g2 as Record<string, unknown>)[partnerVoteField] !== null : false
      await supabase.from('photo_game').update({
        [myVoteField]: liked,
        ...(partnerDone ? { status: 'done' } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      if (partnerId) {
        if (partnerDone) {
          await sendNotif('game_done', { target_user_id: partnerId })
        } else {
          await sendNotif('vote_cast', {
            target_user_id: partnerId,
            actor_name: user.user_metadata?.first_name,
            liked,
          })
        }
      }
    } finally {
      setVoting(false)
    }
  }

  async function sendNotif(
    type: string,
    opts: { exclude_user_id?: string | null; target_user_id?: string | null; actor_name?: string; liked?: boolean } = {},
  ) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-photo-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type, ...opts }),
      })
    } catch { /* non-bloquant */ }
  }

  const theme = THEMES[(game?.theme_index ?? 0) % THEMES.length]

  function statusLabel(): string {
    if (!game) return ''
    if (game.status === 'done') return '✅ Résultats'
    if (game.status === 'voting') return myVote !== null && myVote !== undefined ? '⏳ Vote envoyé' : '👍 À toi de voter !'
    return myPhoto ? '⏳ En attente de ton partenaire' : '📸 Upload ta photo'
  }

  const needsAction =
    (game?.status === 'voting' && (myVote === null || myVote === undefined)) ||
    (game?.status === 'active' && !myPhoto)

  if (loading) return <div className="rounded-3xl glass-card animate-pulse" style={{ aspectRatio: '1/1' }} />

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Compact card */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full rounded-3xl overflow-hidden cursor-pointer shadow-xl shadow-orange-200/40 dark:shadow-orange-900/20 focus:outline-none group"
        style={{ aspectRatio: '1 / 1' }}
        aria-label="Photo Duel"
      >
        <img
          src="/photo-duel-cover.png"
          alt="Photo Duel"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {needsAction && (
          <div className="absolute top-3 left-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: '"Varela Round", sans-serif' }}>
            Photo Duel
          </p>
          <p className="text-white/70 text-xs truncate">{statusLabel()}</p>
        </div>
      </motion.button>

      {/* Modal */}
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
              className="relative w-full max-w-lg glass-card rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">📸</span>
                    <h2 className="font-bold text-pink-700 dark:text-pink-200 text-base"
                      style={{ fontFamily: '"Varela Round", sans-serif' }}>
                      Photo Duel
                    </h2>
                    {(game?.status === 'active' || game?.status === 'done') && timeLeft && (
                      <span className="flex items-center gap-1 text-xs text-pink-400 dark:text-pink-300 bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> {timeLeft}
                      </span>
                    )}
                  </div>
                  <p className="text-pink-600 dark:text-pink-300 text-sm leading-snug">{theme}</p>
                </div>
                <button onClick={() => setOpen(false)}
                  className="text-pink-300 hover:text-pink-500 dark:hover:text-pink-200 transition-colors mt-0.5">
                  <X size={20} />
                </button>
              </div>

              {/* Photos */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Ma photo */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-pink-500 dark:text-pink-400 text-center tracking-wide uppercase">Toi</p>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-pink-50 dark:bg-pink-950/40 border-2 border-pink-100 dark:border-pink-800/30 relative">
                    {myPhoto ? (
                      <>
                        <img src={myPhoto} alt="Ma photo" className="w-full h-full object-cover" />
                        {game?.status === 'done' && partnerVoteOnMine !== null && partnerVoteOnMine !== undefined && (
                          <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/70 rounded-full p-1 text-lg leading-none">
                            {partnerVoteOnMine ? '👍' : '👎'}
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || game?.status !== 'active'}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 text-pink-300 dark:text-pink-500 hover:text-pink-500 dark:hover:text-pink-300 transition-colors disabled:opacity-40"
                      >
                        {uploading
                          ? <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                          : <>
                              <Upload size={24} />
                              <span className="text-xs font-medium">Uploader</span>
                            </>
                        }
                      </button>
                    )}
                  </div>
                  {game?.status === 'done' && partnerVoteOnMine !== null && partnerVoteOnMine !== undefined && (
                    <p className="text-xs text-center text-pink-500 dark:text-pink-400">
                      {partnerVoteOnMine ? 'Ton partenaire a aimé ❤️' : 'Ton partenaire a pas aimé 💔'}
                    </p>
                  )}
                </div>

                {/* Photo partenaire */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-violet-500 dark:text-violet-400 text-center tracking-wide uppercase">Partenaire</p>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-violet-50 dark:bg-violet-950/40 border-2 border-violet-100 dark:border-violet-800/30 relative">
                    {partnerPhoto ? (
                      <>
                        <img src={partnerPhoto} alt="Photo partenaire" className="w-full h-full object-cover" />
                        {game?.status === 'done' && myVote !== null && myVote !== undefined && (
                          <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/70 rounded-full p-1 text-lg leading-none">
                            {myVote ? '👍' : '👎'}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-violet-300 dark:text-violet-500">
                        <Camera size={24} />
                        <span className="text-xs font-medium">En attente…</span>
                      </div>
                    )}
                  </div>
                  {game?.status === 'done' && myVote !== null && myVote !== undefined && (
                    <p className="text-xs text-center text-violet-500 dark:text-violet-400">
                      {myVote ? 'Tu as aimé ❤️' : 'Tu as pas aimé 💔'}
                    </p>
                  )}
                </div>
              </div>

              {/* Zone de vote */}
              {game?.status === 'voting' && partnerPhoto && (myVote === null || myVote === undefined) && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-pink-600 dark:text-pink-300 text-center mb-3">
                    Tu aimes la photo de ton partenaire ?
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => castVote(true)}
                      disabled={voting}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-semibold hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors disabled:opacity-50 text-sm"
                    >
                      <ThumbsUp size={16} /> J'aime
                    </button>
                    <button
                      onClick={() => castVote(false)}
                      disabled={voting}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-semibold hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors disabled:opacity-50 text-sm"
                    >
                      <ThumbsDown size={16} /> Pas fan
                    </button>
                  </div>
                </div>
              )}

              {game?.status === 'voting' && (myVote !== null && myVote !== undefined) && !partnerPhoto && (
                <p className="text-center text-sm text-pink-400 dark:text-pink-300 mb-4">
                  ⏳ En attente de la photo de ton partenaire…
                </p>
              )}

              {game?.status === 'voting' && (myVote !== null && myVote !== undefined) && partnerPhoto && (
                <p className="text-center text-sm text-pink-400 dark:text-pink-300 mb-4">
                  ⏳ Vote envoyé ! En attente de ton partenaire…
                </p>
              )}

              {/* Résultats + compte à rebours prochain thème */}
              {game?.status === 'done' && (
                <div className="text-center mt-2">
                  <p className="flex items-center justify-center gap-1.5 text-xs text-pink-400 dark:text-pink-300">
                    <RefreshCw size={12} /> Prochain thème dans {timeLeft || '…'}
                  </p>
                </div>
              )}

              {/* Bouton upload principal (fallback si hors grille photos) */}
              {game?.status === 'active' && !myPhoto && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full btn-primary py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
                >
                  {uploading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Upload size={16} />
                  }
                  {uploading ? 'Upload en cours…' : 'Uploader ma photo'}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
