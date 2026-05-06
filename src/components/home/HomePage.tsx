import { motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import {
  CalendarDays,
  Music,
  Camera,
  Moon,
  LogOut,
  Lock,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { NextMeetingCard } from './NextMeetingCard'
import { CroustiMessage } from './CroustiMessage'
import { DefiLundi } from './DefiLundi'

type Feature = {
  icon: LucideIcon
  title: string
  description: string
  iconColor: string
  bgColor: string
  delay: number
}

const FEATURES: Feature[] = [
  {
    icon: CalendarDays,
    title: 'Compteur de Jours',
    description: 'Comptez les jours séparés et anticipez les prochaines retrouvailles',
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-50',
    delay: 0,
  },
  {
    icon: Music,
    title: 'Playlist Partagée',
    description: 'Créez votre bande-son commune, chanson après chanson',
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50',
    delay: 0.06,
  },
  {
    icon: Camera,
    title: 'Mémoires Ensemble',
    description: 'Votre album photo de couple, un souvenir à la fois',
    iconColor: 'text-rose-500',
    bgColor: 'bg-rose-50',
    delay: 0.12,
  },
  {
    icon: Moon,
    title: 'Rituel du Soir',
    description: 'Partagez votre humeur et vos rêves chaque soir',
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    delay: 0.18,
  },
]

type Props = {
  user: User
  onSignOut: () => void
}

export function HomePage({ user, onSignOut }: Props) {
  const displayName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'toi'

  return (
    <div className="min-h-screen relative">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-200/25 rounded-full blur-3xl animate-blob-delayed" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-rose-200/20 rounded-full blur-3xl animate-blob-slow" />
      </div>

      {/* Sticky navbar */}
      <nav className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <div className="max-w-5xl mx-auto glass-card rounded-2xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label="nid d'oiseau">🪺</span>
            <span
              className="font-bold text-pink-700 text-lg"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Nidou
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-pink-400 text-xs hidden sm:block truncate max-w-[180px]">
              {user.user_metadata?.first_name ?? user.email}
            </span>
            <div className="w-px h-4 bg-pink-100 hidden sm:block" aria-hidden />
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer text-sm font-medium"
              aria-label="Se déconnecter"
            >
              <LogOut size={15} aria-hidden />
              <span className="hidden sm:block">Déconnexion</span>
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero section */}
        <section className="px-4 pt-12 pb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.span
              className="text-6xl inline-block mb-5"
              animate={{ rotate: [0, -8, 8, -4, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              role="img"
              aria-label="nid d'oiseau"
            >
              🪺
            </motion.span>

            <h1
              className="text-4xl md:text-5xl font-bold text-pink-700 mb-4 leading-tight"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Bienvenue,&nbsp;
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>

            <p className="text-pink-400 text-base md:text-lg max-w-sm mx-auto leading-relaxed">
              Votre espace pour garder la flamme, peu importe les kilomètres.
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <Sparkles size={14} className="text-pink-300" aria-hidden />
              <span className="text-pink-300 text-xs font-medium">
                Connecté·e avec succès
              </span>
              <Sparkles size={14} className="text-pink-300" aria-hidden />
            </div>
          </motion.div>
        </section>

        {/* Cards principales */}
        <section className="px-4 pb-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NextMeetingCard />
            <CroustiMessage user={user} />
            <DefiLundi user={user} />
          </div>
        </section>

        {/* Features grid */}
        <section className="px-4 pb-16" aria-label="Fonctionnalités">
          <div className="max-w-5xl mx-auto" aria-label="Fonctionnalités à venir">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-center mb-8"
            >
              <h2
                className="text-2xl font-bold text-pink-700"
                style={{ fontFamily: '"Varela Round", sans-serif' }}
              >
                Votre nid, en construction
              </h2>
              <p className="text-pink-400 text-sm mt-1.5">
                De belles fonctionnalités arrivent très bientôt…
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: feature.delay + 0.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="glass-card rounded-2xl p-6 cursor-pointer group
                             hover:shadow-lg hover:shadow-pink-100 hover:scale-[1.025]
                             transition-all duration-200"
                >
                  <div
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${feature.bgColor} mb-4
                                group-hover:scale-110 transition-transform duration-200`}
                    aria-hidden
                  >
                    <feature.icon className={`w-5 h-5 ${feature.iconColor}`} strokeWidth={1.8} />
                  </div>

                  <h3
                    className="font-bold text-pink-800 text-base mb-1.5"
                    style={{ fontFamily: '"Varela Round", sans-serif' }}
                  >
                    {feature.title}
                  </h3>

                  <p className="text-pink-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-pink-50">
                    <Lock size={12} className="text-pink-200" aria-hidden />
                    <span className="text-pink-200 text-xs font-medium">Bientôt disponible</span>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center py-8 px-4">
        <p className="text-pink-300 text-xs">
          Fait avec amour, pour les cœurs qui battent à distance 💕
        </p>
      </footer>
    </div>
  )
}
