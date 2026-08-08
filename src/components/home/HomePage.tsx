import { useState } from 'react'
import { motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { LogOut, Settings, Smartphone } from 'lucide-react'
import { NextMeetingCard } from './NextMeetingCard'
import { CroustiMessage } from './CroustiMessage'
import { DefiLundi } from './DefiLundi'
import { SettingsModal } from './SettingsModal'
import { PhoneModal } from './PhoneModal'
import { CoinPot } from './CoinPot'
import { useStreak } from '../../lib/useStreak'
import { DistanceCard } from './DistanceCard'
import { TripProgress } from './TripProgress'


type Props = {
  user: User
  onSignOut: () => void
}

export function HomePage({ user, onSignOut }: Props) {
  const displayName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'toi'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const streak = useStreak(user)

  return (
    <div className="min-h-screen relative">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-pink-200/30 dark:bg-violet-900/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-200/25 dark:bg-violet-900/15 rounded-full blur-3xl animate-blob-delayed" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-rose-200/20 dark:bg-indigo-900/20 rounded-full blur-3xl animate-blob-slow" />
      </div>

      {/* Sticky navbar */}
      <nav className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <div className="max-w-5xl mx-auto glass-card rounded-2xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl" role="img" aria-label="nid d'oiseau">🪺</span>
            <span
              className="font-bold text-pink-700 dark:text-pink-200 text-lg"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Nidou
            </span>
            {streak !== null && (
              <span
                className="flex items-center gap-0.5 text-sm font-bold text-orange-500 dark:text-orange-400"
                title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée`}
              >
                🔥{streak}
              </span>
            )}
          </div>

          <TripProgress user={user} />

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-pink-400 dark:text-pink-300 text-xs hidden sm:block truncate max-w-[180px]">
              {user.user_metadata?.first_name ?? user.email}
            </span>
            <div className="w-px h-4 bg-pink-100 dark:bg-pink-900" aria-hidden />
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 text-pink-400 dark:text-pink-300 hover:text-pink-600 dark:hover:text-pink-100 transition-colors cursor-pointer text-sm font-medium"
              aria-label="Paramètres"
            >
              <Settings size={15} aria-hidden />
              <span className="hidden sm:block">Paramètres</span>
            </button>
            <div className="w-px h-4 bg-pink-100 dark:bg-pink-900" aria-hidden />
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-pink-400 dark:text-pink-300 hover:text-pink-600 dark:hover:text-pink-100 transition-colors cursor-pointer text-sm font-medium"
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
        <section className="px-4 pt-4 pb-2 md:pt-6 md:pb-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1
              className="text-3xl md:text-5xl font-bold text-pink-700 dark:text-pink-200 mb-1 md:mb-3 leading-tight"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Bienvenue,&nbsp;
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>

            <p className="text-pink-400 dark:text-pink-300 text-sm md:text-lg max-w-sm mx-auto leading-relaxed">
              Espace de crousti jeu et crousti défi pour nous !
            </p>
          </motion.div>
        </section>

        {/* Cards principales */}
        <section className="px-4 pb-3 md:pb-4">
          <div className="max-w-3xl lg:max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <NextMeetingCard />
            <DefiLundi user={user} />
            <CoinPot user={user} />
            <DistanceCard user={user} />
          </div>
        </section>

        {/* Téléphone — seul point d'entrée vers les jeux, PC uniquement (mobile/tablette : bulle flottante ci-dessous) */}
        <section className="hidden lg:flex justify-center pb-4 px-4">
          <button
            onClick={() => setPhoneOpen(true)}
            className="glass-card rounded-2xl px-5 py-3 flex items-center gap-2 text-pink-500 dark:text-pink-200 hover:text-pink-700 dark:hover:text-pink-100 transition-colors cursor-pointer text-sm font-medium"
          >
            <Smartphone size={18} aria-hidden />
            Ouvrir le téléphone
          </button>
        </section>

      </main>

      {/* Bulle flottante téléphone — mobile/tablette uniquement, miroir de CroustiMessage à gauche */}
      <motion.button
        onClick={() => setPhoneOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full
                   bg-gradient-to-br from-pink-400 to-violet-400
                   shadow-lg shadow-pink-300/40
                   flex items-center justify-center cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Ouvrir le téléphone"
      >
        <Smartphone size={24} className="text-white" strokeWidth={1.8} />
      </motion.button>

      <footer className="text-center py-2 md:py-4 px-4">
        <p className="text-pink-300 dark:text-pink-400 text-xs">
          💕Site des Crousti'Amoureux tout chaud💕
        </p>
      </footer>

      <CroustiMessage user={user} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} user={user} />
      <PhoneModal open={phoneOpen} onClose={() => setPhoneOpen(false)} user={user} />
    </div>
  )
}
