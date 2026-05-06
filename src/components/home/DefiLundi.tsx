import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Plus, Camera, Check } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Challenge = {
  id: string
  created_by: string
  creator_name: string | null
  title: string
  description: string | null
  status: 'pending' | 'completed'
  proof_url: string | null
  completed_by: string | null
  completer_name: string | null
  completed_at: string | null
  created_at: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function DefiLundi({ user }: { user: User }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const senderName =
    user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null

  const fetchChallenges = () =>
    supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setChallenges(data ?? []))

  useEffect(() => {
    fetchChallenges().then(() => setLoaded(true))

    const channel = supabase
      .channel('challenges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, fetchChallenges)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const active = challenges.find((c) => c.status === 'pending') ?? null
  const history = challenges.filter((c) => c.status === 'completed')
  const iMadeCurrent = active?.created_by === user.id

  const createChallenge = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    await supabase.from('challenges').insert({
      created_by: user.id,
      creator_name: senderName,
      title: title.trim(),
      description: description.trim() || null,
    })
    setTitle('')
    setDescription('')
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
          status: 'completed',
          proof_url: publicUrl,
          completed_by: user.id,
          completer_name: senderName,
          completed_at: new Date().toISOString(),
        })
        .eq('id', active.id)
    }
    setSelectedFile(null)
    setUploadPreview(null)
    setUploading(false)
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
              <p className="text-pink-700 text-sm font-medium line-clamp-1 mb-1">
                {active.title}
              </p>
              <p className="text-pink-400 text-xs">
                {iMadeCurrent ? '⏳ En attente de validation' : '🎯 À toi de relever !'}
              </p>
            </div>
          ) : (
            <p className="text-pink-400 text-sm">
              {history.length > 0
                ? 'Aucun défi en cours — lancer le prochain →'
                : 'Lancer votre premier défi →'}
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
                      <div className="bg-gradient-to-br from-pink-50 to-violet-50 rounded-2xl p-4">
                        <p className="font-bold text-pink-800 text-base mb-1">{active.title}</p>
                        {active.description && (
                          <p className="text-pink-600 text-sm leading-relaxed">{active.description}</p>
                        )}
                        <p className="text-pink-300 text-xs mt-2">
                          Lancé par {active.creator_name ?? 'inconnu'} · {fmtDate(active.created_at)}
                        </p>
                      </div>

                      {/* Recipient: upload proof */}
                      {!iMadeCurrent && (
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
                                  {uploading ? 'Envoi…' : 'Valider le défi'}
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

                      {/* Creator: waiting */}
                      {iMadeCurrent && (
                        <p className="text-pink-400 text-sm">
                          ⏳ En attente que ton partenaire relève le défi…
                        </p>
                      )}
                    </div>
                  ) : (
                    /* No active challenge: create form */
                    !creating ? (
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
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
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
                            onClick={() => { setCreating(false); setTitle(''); setDescription('') }}
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
                      {history.map((c) => (
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
                            <p className="font-semibold text-pink-800 text-sm leading-snug line-clamp-2">
                              {c.title}
                            </p>
                            <p className="text-pink-400 text-xs mt-1">
                              ✅ Relevé par {c.completer_name ?? 'inconnu'}
                            </p>
                            <p className="text-pink-300 text-xs">
                              {c.completed_at ? fmtDate(c.completed_at) : ''}
                            </p>
                          </div>
                        </motion.div>
                      ))}
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
