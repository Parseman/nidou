import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { AuthPage } from './components/auth/AuthPage'
import { HomePage } from './components/home/HomePage'
import { PetPage } from './components/pet/PetPage'
import { registerPush } from './lib/pushNotifications'

type Page = 'home' | 'pet'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin mx-auto mb-3" aria-hidden />
        <p className="text-pink-400 text-sm">Chargement de votre nid…</p>
      </div>
    </div>
  )
}

const pageVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir: number) => ({ opacity: 0, x: dir * -40 }),
}

export default function App() {
  const { user, loading, signIn, signOut } = useAuth()
  const [page, setPage] = useState<Page>('home')
  const [dir,  setDir]  = useState(1)

  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'granted') {
      registerPush(user.id)
    }
  }, [user])

  const navigate = (to: Page) => {
    setDir(to === 'pet' ? 1 : -1)
    setPage(to)
  }

  if (loading) return <LoadingScreen />
  if (!user)   return <AuthPage onSignIn={signIn} />

  return (
    <AnimatePresence mode="wait" custom={dir}>
      {page === 'home' ? (
        <motion.div
          key="home"
          custom={dir}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <HomePage user={user} onSignOut={signOut} onGoToPet={() => navigate('pet')} />
        </motion.div>
      ) : (
        <motion.div
          key="pet"
          custom={dir}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <PetPage user={user} onBack={() => navigate('home')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
