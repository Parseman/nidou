import { Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { AuthPage } from './components/auth/AuthPage'
import { HomePage } from './components/home/HomePage'

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

export default function App() {
  const { user, loading, signIn, signOut } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <AuthPage onSignIn={signIn} />

  return <HomePage user={user} onSignOut={signOut} />
}
