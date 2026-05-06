import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Plus, Camera, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Difficulty = 'easy' | 'medium' | 'hard' | 'legendary'

type Challenge = {
  id: string
  created_by: string
  creator_name: string | null
  title: string
  description: string | null
  difficulty: Difficulty | null
  status: 'pending' | 'proof_submitted' | 'validated' | 'rejected' | 'completed'
  proof_url: string | null
  completed_by: string | null
  completer_name: string | null
  completed_at: string | null
  deadline: string | null
  validated: boolean | null
  validated_at: string | null
  validated_by: string | null
  validator_name: string | null
  created_at: string
}

const DIFFS = [
  { key: 'easy' as Difficulty,      label: 'Facile',      textColor: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-300',  badge: 'bg-green-100 text-green-700' },
  { key: 'medium' as Difficulty,    label: 'Moyen',       textColor: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-300',   badge: 'bg-blue-100 text-blue-700' },
  { key: 'hard' as Difficulty,      label: 'Dur',         textColor: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-300', badge: 'bg-violet-100 text-violet-700' },
  { key: 'legendary' as Difficulty, label: 'Légendaire',  textColor: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-600' },
]

function getDiff(key: Difficulty | null) {
  return DIFFS.find((d) => d.key === key) ?? DIFFS[1]
}

function getNextMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  d.setDate(d.getDate() + diff)
  d.setHours(23, 59, 59, 0)
  return d
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function DefiLundi({ user }: { user: User }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const senderName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null
  const isMonday = new Date().getDay() === 1

  const fetchChallenges = async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    const rows = (data ?? []) as Challenge[]

    // Auto-valider les défis dont la preuve est soumise et la deadline dépassée
    const expired = rows.filter(
      (c) => c.status === 'proof_submitted' && c.deadline && new Date(c.deadline) < new Date()
    )
    if (expired.length > 0) {
      await Promise.all(
        expired.map((c) =>
          supabase.from('challenges').update({
            status: 'validated',
            validated: true,
            validated_at: new Date().toISOString(),
          }).eq('id', c.id)
        )
      )
      const { data: fresh } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setChallenges((fresh ?? []) as Challenge[])
      return
    }

    setChallenges(rows)
  }

  useEffect(() => {
    fetchChallenges().then(() => setLoaded(true))

    const channel = supabase
      .channel('challenges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, fetchChallenges)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const active = challenges.find(
    (c) => c.status === 'pending' || c.status === 'proof_submitted'
  ) ?? null

  const history = challenges.filter(
    (c) => c.status === 'validated' || c.status === 'rejected' || c.status === 'completed'
  )

  const iMadeActive = active?.created_by === user.id
  const isProofPhase = active?.status === 'proof_submitted'

  const createChallenge = async () => {
    if (!title.trim() || submitting || !isMonday) return
    setSubmitting(true)
    await supabase.from('challenges').insert({
      created_by: user.id,
      creator_name: senderName,
      title: title.trim(),
      description: description.trim() || null,
      difficulty,
      deadline: getNextMonday().toISOString(),
    })
    setTitle('')
    setDescription('')
    setDifficulty('medium')
    setCreating(false)
    setSubmitting(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setSelectedFile(file)
    setUploadPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const uploadProof = async () => {
    if (!selectedFile || !active || uploading) return
    setUploading(true)
    const ext = selectedFile.name.split('.').pop() ?? 'jpg'
    const path = `${active.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('challenges').upload(path, selectedFile)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('challenges').getPublicUrl(path)
      await supabase
        .from('challenges')
        .update({
          status: 'proof_submitted',
          proof_url: publicUrl,
          completed_by: user.id,
          completer_name: senderName,
          completed_at: new Date().toISOString(),
          // Si pas de deadline (défi ancien), on en crée une à partir de maintenant
          deadline: active.deadline ?? getNextMonday().toISOString(),
        })
        .eq('id', active.id)
    }
    setSelectedFile(null)
    setUploadPreview(null)
    setUploading(false)
  }

  const validateChallenge = async (accept: boolean) => {
    if (!active || validating) return
    setValidating(true)
    await supabase
      .from('challenges')
      .update({
        status: accept ? 'validated' : 'rejected',
        validated: accept,
        validated_at: new Date().toISOString(),
        validated_by: user.id,
        validator_name: senderName,
      })
      .eq('id', active.id)
    setValidating(false)
  }

  const cancelUpload = () => {
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
    setSelectedFile(null)
  }

  return (
    <>
      {/* ── Preview card ── */}
      <div
        className="glass-card rounded-3xl p-6 cursor-pointer group
                   hover:shadow-lg hover:shadow-pink-100 transition-all duration-200"
        onClick={() => setIsOpen(true)}
        role="button"
        aria-label="Ouvrir le Défi du Lundi"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-pink-400" size={18} strokeWidth={1.8} />
            <h2
              className="font-bold text-pink-700 text-sm"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Défi du Lundi 🏆
            </h2>
          </div>
          <span className="text-pink-300 text-xs group-hover:text-pink-500 transition-colors">→</span>
        </div>

        {loaded && (
          active ? (
            <div>
              {active.difficulty && (
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${getDiff(active.difficulty).badge}`}>
                  {getDiff(active.difficulty).label}
                </span>
              )}
              <p className="text-pink-700 text-sm font-medium line-clamp-1 mb-1">{active.title}</p>
              <p className="text-pink-400 text-xs">
                {isProofPhase
                  ? (iMadeActive ? '📸 Preuve soumise — à valider' : '⏳ En attente de validation')
                  : (iMadeActive ? '⏳ En attente de réalisation' : '🎯 À toi de relever !')}
              </p>
            </div>
          ) : (
            <p className="text-pink-400 text-sm">
              {history.length > 0 ? 'Aucun défi en cours →' : 'Lancer votre premier défi →'}
            </p>
          )
        )}
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-pink-950/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="relative z-10 w-full max-w-lg flex flex-col rounded-3xl overflow-hidden
                         bg-white/95 backdrop-blur-md shadow-2xl shadow-pink-200/40"
              style={{ height: '85vh' }}
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <h2
                    className="font-bold text-pink-700"
                    style={{ fontFamily: '"Varela Round", sans-serif' }}
                  >
                    Défi du Lundi
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-pink-300 hover:text-pink-500 transition-colors cursor-pointer p-1"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Défi en cours ── */}
                <div className="px-5 py-5 border-b border-pink-50">
                  <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-3">
                    Défi en cours
                  </p>

                  {active ? (
                    <div className="space-y-3">
                      {/* Carte du défi */}
                      <div className={`rounded-2xl p-4 ${active.difficulty ? getDiff(active.difficulty).bg : 'bg-gradient-to-br from-pink-50 to-violet-50'}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-bold text-pink-800 text-base">{active.title}</p>
                          {active.difficulty && (
                            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${getDiff(active.difficulty).badge}`}>
                              {getDiff(active.difficulty).label}
                            </span>
                          )}
                        </div>
                        {active.description && (
                          <p className="text-pink-600 text-sm leading-relaxed mb-2">{active.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 text-xs text-pink-300">
                          <span>Lancé par {active.creator_name ?? 'inconnu'}</span>
                          {active.deadline && <span>· Jusqu'au {fmtDate(active.deadline)}</span>}
                        </div>
                      </div>

                      {/* Phase preuve : créateur valide */}
                      {isProofPhase && iMadeActive && (
                        <div className="space-y-3">
                          <p className="text-pink-600 text-sm font-medium">
                            📸 Preuve reçue de {active.completer_name ?? 'ton partenaire'} :
                          </p>
                          {active.proof_url && (
                            <button
                              onClick={() => setLightbox(active.proof_url!)}
                              className="w-full focus:outline-none"
                            >
                              <img
                                src={active.proof_url}
                                alt="Preuve"
                                className="w-full h-44 object-cover rounded-2xl cursor-zoom-in hover:opacity-90 transition-opacity"
                              />
                            </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => validateChallenge(true)}
                              disabled={validating}
                              className="flex-1 flex items-center justify-center gap-1.5
                                         bg-green-500 hover:bg-green-600 text-white
                                         text-sm font-semibold py-2.5 px-4 rounded-2xl
                                         transition-colors cursor-pointer disabled:opacity-60"
                            >
                              <ThumbsUp size={14} />
                              Valider
                            </button>
                            <button
                              onClick={() => validateChallenge(false)}
                              disabled={validating}
                              className="flex-1 flex items-center justify-center gap-1.5
                                         bg-red-400 hover:bg-red-500 text-white
                                         text-sm font-semibold py-2.5 px-4 rounded-2xl
                                         transition-colors cursor-pointer disabled:opacity-60"
                            >
                              <ThumbsDown size={14} />
                              Refuser
                            </button>
                          </div>
                          {active.deadline && (
                            <p className="text-pink-300 text-xs text-center">
                              Valide avant le {fmtDate(active.deadline)}, sinon validé automatiquement
                            </p>
                          )}
                        </div>
                      )}

                      {/* Phase preuve : compléteur en attente */}
                      {isProofPhase && !iMadeActive && (
                        <div className="text-center py-3 space-y-2">
                          <p className="text-pink-500 text-sm">⏳ Preuve envoyée ! En attente de validation…</p>
                          {active.proof_url && (
                            <button onClick={() => setLightbox(active.proof_url!)} className="focus:outline-none">
                              <img
                                src={active.proof_url}
                                alt="Ta preuve"
                                className="h-28 object-cover rounded-xl mx-auto cursor-zoom-in hover:opacity-90 transition-opacity"
                              />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Phase pending : destinataire envoie la preuve */}
                      {!isProofPhase && !iMadeActive && (
                        <div className="space-y-3">
                          <p className="text-pink-600 text-sm font-medium">
                            🎯 C'est ton défi ! Uploade ta photo preuve :
                          </p>
                          {uploadPreview ? (
                            <div className="space-y-2">
                              <img
                                src={uploadPreview}
                                alt="Aperçu"
                                className="w-full h-44 object-cover rounded-2xl"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={uploadProof}
                                  disabled={uploading}
                                  className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
                                >
                                  <Check size={14} />
                                  {uploading ? 'Envoi…' : 'Envoyer la preuve'}
                                </button>
                                <button
                                  onClick={cancelUpload}
                                  className="text-sm text-pink-400 hover:text-pink-600 transition-colors cursor-pointer px-3"
                                >
                                  Changer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full border-2 border-dashed border-pink-200 rounded-2xl py-7
                                         text-pink-400 hover:border-pink-400 hover:text-pink-600
                                         transition-colors cursor-pointer flex flex-col items-center gap-2"
                            >
                              <Camera size={24} strokeWidth={1.5} />
                              <span className="text-sm">Choisir une photo</span>
                            </button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                        </div>
                      )}

                      {/* Phase pending : créateur en attente */}
                      {!isProofPhase && iMadeActive && (
                        <p className="text-pink-400 text-sm">
                          ⏳ En attente que ton partenaire relève le défi…
                        </p>
                      )}
                    </div>

                  ) : (
                    /* Pas de défi actif */
                    !creating ? (
                      isMonday ? (
                        <button
                          onClick={() => setCreating(true)}
                          className="w-full flex items-center justify-center gap-2 border-2 border-dashed
                                     border-pink-200 rounded-2xl py-6 text-pink-400
                                     hover:border-pink-400 hover:text-pink-600 transition-colors cursor-pointer"
                        >
                          <Plus size={18} />
                          <span className="text-sm font-medium">Lancer un nouveau défi</span>
                        </button>
                      ) : (
                        <div className="text-center py-6 px-4">
                          <p className="text-4xl mb-3">📅</p>
                          <p className="text-pink-600 text-sm font-medium mb-1">Rendez-vous lundi !</p>
                          <p className="text-pink-400 text-xs leading-relaxed">
                            Les défis ne peuvent être lancés que le lundi.
                          </p>
                        </div>
                      )
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-pink-600 mb-1.5">
                            Le défi 🎯
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex : Cuisiner un plat inconnu…"
                            className="input-field text-sm"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-pink-600 mb-1.5">
                            Détails (optionnel)
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Précisions sur le défi…"
                            className="input-field text-sm resize-none"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-pink-600 mb-2">
                            Difficulté
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {DIFFS.map((d) => (
                              <button
                                key={d.key}
                                onClick={() => setDifficulty(d.key)}
                                className={`py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer
                                  ${difficulty === d.key
                                    ? `${d.bg} ${d.border} ${d.textColor}`
                                    : 'bg-white border-pink-100 text-pink-300 hover:border-pink-200'
                                  }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={createChallenge}
                            disabled={!title.trim() || submitting}
                            className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
                          >
                            <Trophy size={14} />
                            {submitting ? 'Envoi…' : 'Lancer le défi'}
                          </button>
                          <button
                            onClick={() => { setCreating(false); setTitle(''); setDescription(''); setDifficulty('medium') }}
                            className="text-sm text-pink-400 hover:text-pink-600 transition-colors cursor-pointer px-3"
                          >
                            Annuler
                          </button>
                        </div>
                      </motion.div>
                    )
                  )}
                </div>

                {/* ── Historique ── */}
                {history.length > 0 && (
                  <div className="px-5 py-5">
                    <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-4">
                      Historique ({history.length})
                    </p>
                    <div className="space-y-4">
                      {history.map((c) => {
                        const isValidated = c.status === 'validated' || c.status === 'completed' || c.validated === true
                        const hDiff = getDiff(c.difficulty)
                        return (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-3 items-start"
                          >
                            {c.proof_url ? (
                              <button
                                onClick={() => setLightbox(c.proof_url!)}
                                className="shrink-0 focus:outline-none"
                                aria-label="Voir la photo preuve"
                              >
                                <img
                                  src={c.proof_url}
                                  alt="Preuve"
                                  className="w-16 h-16 object-cover rounded-xl hover:opacity-80 transition-opacity cursor-zoom-in"
                                />
                              </button>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-pink-50 shrink-0 flex items-center justify-center">
                                <Trophy size={20} className="text-pink-200" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <p className="font-semibold text-pink-800 text-sm leading-snug">{c.title}</p>
                                {c.difficulty && (
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${hDiff.badge}`}>
                                    {hDiff.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-pink-400 text-xs">
                                {isValidated ? '✅ Validé' : '❌ Refusé'} · {c.completer_name ?? 'inconnu'}
                              </p>
                              {c.completed_at && (
                                <p className="text-pink-300 text-xs">{fmtDate(c.completed_at)}</p>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 cursor-zoom-out"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.img
              src={lightbox}
              alt="Photo preuve"
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
