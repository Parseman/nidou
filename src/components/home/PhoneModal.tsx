import { motion, AnimatePresence } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { X } from 'lucide-react'
import { NidouChatIcon } from './NidouChat'
import { CroustiArt } from './CroustiArt'
import { PhotoGame } from './PhotoGame'
import { BattleGame } from './BattleGame'

type Props = {
  open: boolean
  onClose: () => void
  user: User
}

export function PhoneModal({ open, onClose, user }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 lg:block hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center lg:pointer-events-none"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pointer-events-auto w-full h-full lg:w-[300px] lg:h-[620px] bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 dark:from-purple-950 dark:via-purple-900 dark:to-violet-950 lg:bg-gray-900 lg:dark:bg-black lg:rounded-[3rem] lg:p-3 lg:shadow-2xl lg:border-4 lg:border-gray-800 lg:dark:border-gray-700">
              <div className="relative w-full h-full flex flex-col bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 dark:from-purple-950 dark:via-purple-900 dark:to-violet-950 lg:rounded-[2.25rem] overflow-hidden">
                <div className="hidden lg:flex absolute top-0 inset-x-0 justify-center pt-2 z-10">
                  <div className="w-24 h-5 bg-gray-900 dark:bg-black rounded-full" />
                </div>

                <div className="flex lg:hidden items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
                  <span
                    className="font-bold text-pink-700 dark:text-pink-200 text-lg"
                    style={{ fontFamily: '"Varela Round", sans-serif' }}
                  >
                    Mes jeux
                  </span>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full text-pink-500 dark:text-pink-200 hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Fermer"
                  >
                    <X size={22} aria-hidden />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pt-4 lg:pt-10 px-4 pb-4">
                  <div className="grid grid-cols-2 gap-4 lg:gap-3 justify-items-center">
                    <div className="w-full max-w-[140px] lg:w-[92px]"><NidouChatIcon user={user} /></div>
                    <div className="w-full max-w-[140px] lg:w-[92px]"><CroustiArt user={user} compact /></div>
                    <div className="w-full max-w-[140px] lg:w-[92px]"><PhotoGame user={user} /></div>
                    <div className="w-full max-w-[140px] lg:w-[92px]"><BattleGame user={user} /></div>
                  </div>
                </div>

                <div className="shrink-0 min-h-[100px] lg:min-h-[160px] border-t border-white/60 dark:border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-md px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:pb-6">
                  {/* Dock : nouveaux jeux à venir */}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
