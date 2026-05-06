import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, ArrowRight, Loader2, Heart, Eye, EyeOff } from 'lucide-react'

type Props = {
  onSignIn: (email: string, password: string) => Promise<{ error: Error | null }>
}

type HeartConfig = {
  id: number
  left: string
  size: number
  opacity: number
  duration: number
  delay: number
}

function FloatingHearts() {
  const hearts = useMemo<HeartConfig[]>(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${5 + (i / 14) * 90}%`,
        size: 10 + (i % 4) * 6,
        opacity: 0.12 + (i % 3) * 0.07,
        duration: 7 + (i % 5) * 2,
        delay: (i * 1.1) % 8,
      })),
    [],
  )

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {hearts.map((h) => (
        <motion.div
          key={h.id}
          className="absolute"
          style={{ left: h.left, bottom: -40 }}
          animate={{ y: -1800, opacity: [0, h.opacity, h.opacity, 0] }}
          transition={{
            duration: h.duration,
            delay: h.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <Heart
            size={h.size}
            className="text-pink-300"
            fill="currentColor"
            strokeWidth={0}
          />
        </motion.div>
      ))}
    </div>
  )
}

function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-pink-200/50 rounded-full blur-3xl animate-blob" />
      <div className="absolute -bottom-48 -left-48 w-[28rem] h-[28rem] bg-violet-200/40 rounded-full blur-3xl animate-blob-delayed" />
      <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-rose-200/30 rounded-full blur-3xl animate-blob-slow" />
    </div>
  )
}

export function AuthPage({ onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError(null)

    const { error } = await onSignIn(email.trim(), password)
    setLoading(false)

    if (error) {
      setError('Email ou mot de passe incorrect.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundBlobs />
      <FloatingHearts />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <motion.span
              className="text-5xl inline-block mb-3"
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              role="img"
              aria-label="nid d'oiseau"
            >
              🪺
            </motion.span>
            <h1
              className="text-4xl font-bold text-pink-700 tracking-tight"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Nidou
            </h1>
            <p className="text-pink-400 mt-2 text-sm font-medium">
              Votre nid, peu importe la distance
            </p>
            <div className="mt-4 flex items-center gap-2 justify-center opacity-50">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-pink-200" />
              <Heart size={12} className="text-pink-300" fill="currentColor" strokeWidth={0} />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-pink-200" />
            </div>
          </div>

          <motion.form
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-pink-700 mb-2">
                Adresse email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-300"
                  size={18}
                  aria-hidden
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.fr"
                  className="input-field pl-10"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-pink-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-300"
                  size={18}
                  aria-hidden
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-pink-300 hover:text-pink-500 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-red-500 text-sm text-center bg-red-50 border border-red-100 rounded-xl p-3"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </>
              )}
            </button>
          </motion.form>
        </div>

        <p className="text-center text-pink-300 text-xs mt-5">
          Fait avec amour, pour les cœurs qui battent à distance 💕
        </p>
      </motion.div>
    </div>
  )
}
