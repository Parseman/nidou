import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BarChart3, Trophy, Camera, Swords, ShoppingBag, Palette, MessageCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type Counts = { mine: number; partner: number }

type Stats = {
  totalInteractions: number
  since: string | null // date ISO la plus ancienne trouvée, proxy "ensemble depuis"
  photoDuel: { wins: Counts; rounds: number }
  challenges: { completed: Counts; validated: number; rejected: number; byDifficulty: Record<string, number> }
  market: { spent: Counts; fulfilled: Counts }
  artworks: Counts
  messages: Counts & { total: number }
  battle: { level: Counts; hp: Counts }
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Facile', medium: 'Moyen', hard: 'Difficile', legendary: 'Légendaire',
}

function emptyCounts(): Counts {
  return { mine: 0, partner: 0 }
}

function incr(counts: Counts, isMine: boolean, by = 1) {
  if (isMine) counts.mine += by
  else counts.partner += by
}

function oldest(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a
  if (!a) return b
  return new Date(b) < new Date(a) ? b : a
}

async function loadStats(userId: string): Promise<Stats> {
  const isMine = (id: string | null) => id === userId

  const [pgh, challenges, market, artworks, messages, battle] = await Promise.all([
    supabase.from('photo_game_history').select('photo_1_user_id, photo_2_user_id, vote_1, vote_2, started_at'),
    supabase.from('challenges').select('completed_by, status, difficulty, validated, created_at'),
    supabase.from('market_purchases').select('buyer_id, price, status, created_at'),
    supabase.from('artworks').select('sender_id, created_at'),
    supabase.from('messages').select('sender_id, created_at'),
    supabase.from('battle_state').select('user_id, hp, xp'),
  ])

  let since: string | null = null

  // Photo Duel : victoire = son propre vote (sur SA photo) est true et l'autre false
  const wins = emptyCounts()
  const pghRows = pgh.data ?? []
  for (const r of pghRows) {
    since = oldest(since, r.started_at)
    if (r.vote_1 && !r.vote_2 && r.photo_1_user_id) incr(wins, isMine(r.photo_1_user_id))
    if (r.vote_2 && !r.vote_1 && r.photo_2_user_id) incr(wins, isMine(r.photo_2_user_id))
  }

  // Défi du Lundi
  const completed = emptyCounts()
  let validated = 0
  let rejected = 0
  const byDifficulty: Record<string, number> = {}
  const challengeRows = challenges.data ?? []
  for (const c of challengeRows) {
    since = oldest(since, c.created_at)
    if (c.completed_by && (c.status === 'validated' || c.status === 'proof_submitted' || c.status === 'completed')) {
      incr(completed, isMine(c.completed_by))
      if (c.difficulty) byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] ?? 0) + 1
    }
    if (c.validated === true) validated++
    if (c.validated === false) rejected++
  }

  // Marché
  const spent = emptyCounts()
  const fulfilled = emptyCounts()
  const marketRows = market.data ?? []
  for (const m of marketRows) {
    since = oldest(since, m.created_at)
    incr(spent, isMine(m.buyer_id), m.price)
    if (m.status === 'done') incr(fulfilled, isMine(m.buyer_id))
  }

  // CroustiArt
  const artworkCounts = emptyCounts()
  const artworkRows = artworks.data ?? []
  for (const a of artworkRows) {
    since = oldest(since, a.created_at)
    incr(artworkCounts, isMine(a.sender_id))
  }

  // Messages
  const messageCounts = emptyCounts()
  const messageRows = messages.data ?? []
  for (const m of messageRows) {
    since = oldest(since, m.created_at)
    incr(messageCounts, isMine(m.sender_id))
  }

  // Combat (état courant, pas d'historique de victoires)
  const level = emptyCounts()
  const hp = emptyCounts()
  const battleRows = battle.data ?? []
  for (const b of battleRows) {
    const lvl = Math.floor((b.xp ?? 0) / 100) + 1
    if (isMine(b.user_id)) { level.mine = lvl; hp.mine = b.hp }
    else { level.partner = lvl; hp.partner = b.hp }
  }

  const totalInteractions =
    pghRows.length + challengeRows.length + marketRows.length + artworkRows.length + messageRows.length

  return {
    totalInteractions,
    since,
    photoDuel: { wins, rounds: pghRows.length },
    challenges: { completed, validated, rejected, byDifficulty },
    market: { spent, fulfilled },
    artworks: artworkCounts,
    messages: { ...messageCounts, total: messageRows.length },
    battle: { level, hp },
  }
}

// ── UI ────────────────────────────────────────────────────────────────────────

function ComparisonBar({
  label, mine, partner, myName, partnerName, unit = '', higherIsBetter = true,
}: {
  label: string
  mine: number
  partner: number
  myName: string
  partnerName: string
  unit?: string
  higherIsBetter?: boolean
}) {
  const max = Math.max(mine, partner, 1)
  const mineLeads = higherIsBetter ? mine > partner : mine < partner
  const partnerLeads = higherIsBetter ? partner > mine : partner < mine

  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-pink-300 mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] w-16 shrink-0 truncate ${mineLeads ? 'font-bold text-pink-600 dark:text-pink-300' : 'text-slate-500 dark:text-pink-400/70'}`}>
            {myName}
          </span>
          <div className="flex-1 h-2.5 bg-pink-100 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-pink-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(mine / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-pink-200 w-12 text-right shrink-0">
            {mine}{unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] w-16 shrink-0 truncate ${partnerLeads ? 'font-bold text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-pink-400/70'}`}>
            {partnerName}
          </span>
          <div className="flex-1 h-2.5 bg-violet-100 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(partner / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-pink-200 w-12 text-right shrink-0">
            {partner}{unit}
          </span>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-800 dark:text-pink-200">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function StatsBoard({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  const myName: string = user.user_metadata?.first_name ?? 'Toi'
  const partnerName = myName === 'Léona' ? 'Clément' : 'Léona'

  async function openBoard() {
    setOpen(true)
    if (stats) return // déjà chargé cette session
    setLoading(true)
    try {
      const s = await loadStats(user.id)
      setStats(s)
    } finally {
      setLoading(false)
    }
  }

  const sinceLabel = stats?.since
    ? Math.max(1, Math.ceil((Date.now() - new Date(stats.since).getTime()) / 86_400_000))
    : null

  return (
    <>
      <motion.button
        onClick={openBoard}
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full rounded-3xl overflow-hidden cursor-pointer shadow-xl shadow-violet-300/50 dark:shadow-violet-900/20 focus:outline-none group glass-card"
        style={{ aspectRatio: '1 / 1' }}
        aria-label="Statistiques du couple"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-rose-100 to-violet-200 dark:from-pink-950/60 dark:via-purple-950/60 dark:to-violet-950/60 group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
          <BarChart3 size={32} className="text-violet-500 dark:text-violet-300" strokeWidth={2.2} />
          <p
            className="text-slate-700 dark:text-pink-100 font-bold text-sm leading-tight text-center"
            style={{ fontFamily: '"Varela Round", sans-serif' }}
          >
            Stats du couple
          </p>
          {stats && (
            <p className="text-slate-500 dark:text-pink-300/80 text-[11px] text-center">
              {stats.totalInteractions} interactions ✨
            </p>
          )}
        </div>
      </motion.button>

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
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="font-bold text-slate-800 dark:text-pink-200 text-lg flex items-center gap-2"
                  style={{ fontFamily: '"Varela Round", sans-serif' }}
                >
                  📊 Stats du couple
                </h2>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-pink-200 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loading && stats && (
                <>
                  {sinceLabel && (
                    <p className="text-xs text-center text-slate-500 dark:text-pink-400 mb-5">
                      Ensemble sur Nidou depuis {sinceLabel} jour{sinceLabel > 1 ? 's' : ''} · {stats.totalInteractions} interactions au total ✨
                    </p>
                  )}

                  <Section icon={<Camera size={16} className="text-pink-500" />} title="Photo Duel">
                    <ComparisonBar
                      label="Photos gagnantes (votée préférée)"
                      mine={stats.photoDuel.wins.mine}
                      partner={stats.photoDuel.wins.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-pink-400/70">{stats.photoDuel.rounds} tour{stats.photoDuel.rounds > 1 ? 's' : ''} joué{stats.photoDuel.rounds > 1 ? 's' : ''} au total</p>
                  </Section>

                  <Section icon={<Trophy size={16} className="text-amber-500" />} title="Défi du Lundi">
                    <ComparisonBar
                      label="Défis relevés"
                      mine={stats.challenges.completed.mine}
                      partner={stats.challenges.completed.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-pink-400/70 mb-1">
                      <span>✅ {stats.challenges.validated} validé{stats.challenges.validated > 1 ? 's' : ''}</span>
                      <span>❌ {stats.challenges.rejected} refusé{stats.challenges.rejected > 1 ? 's' : ''}</span>
                    </div>
                    {Object.keys(stats.challenges.byDifficulty).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(stats.challenges.byDifficulty).map(([diff, count]) => (
                          <span key={diff} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                            {DIFFICULTY_LABEL[diff] ?? diff} × {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </Section>

                  <Section icon={<ShoppingBag size={16} className="text-yellow-600" />} title="Marché">
                    <ComparisonBar
                      label="Pièces dépensées"
                      mine={stats.market.spent.mine}
                      partner={stats.market.spent.partner}
                      myName={myName}
                      partnerName={partnerName}
                      unit=" 🪙"
                    />
                    <ComparisonBar
                      label="Demandes réalisées (pour l'autre)"
                      mine={stats.market.fulfilled.mine}
                      partner={stats.market.fulfilled.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                  </Section>

                  <Section icon={<Swords size={16} className="text-red-500" />} title="Combat">
                    <ComparisonBar
                      label="Niveau actuel"
                      mine={stats.battle.level.mine}
                      partner={stats.battle.level.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                    <ComparisonBar
                      label="PV actuels"
                      mine={stats.battle.hp.mine}
                      partner={stats.battle.hp.partner}
                      myName={myName}
                      partnerName={partnerName}
                      unit=" ❤️"
                    />
                  </Section>

                  <Section icon={<Palette size={16} className="text-purple-500" />} title="CroustiArt">
                    <ComparisonBar
                      label="Dessins envoyés"
                      mine={stats.artworks.mine}
                      partner={stats.artworks.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                  </Section>

                  <Section icon={<MessageCircle size={16} className="text-blue-500" />} title="Messages">
                    <ComparisonBar
                      label={`Messages envoyés (${stats.messages.total} au total)`}
                      mine={stats.messages.mine}
                      partner={stats.messages.partner}
                      myName={myName}
                      partnerName={partnerName}
                    />
                  </Section>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
