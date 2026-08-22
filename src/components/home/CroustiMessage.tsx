import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { fmtRelativeOrShort } from '../../lib/dates'

type Message = {
  id: string
  sender_id: string
  sender_name: string | null
  content: string
  created_at: string
}

const LS_LAST_SEEN = 'nidou_messages_last_seen'

export function CroustiMessage({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lastSeen, setLastSeen] = useState<string>(
    () => localStorage.getItem(LS_LAST_SEEN) ?? new Date(0).toISOString()
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => setMessages(data ?? []))

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 60)
    return () => clearTimeout(timer)
  }, [isOpen, messages.length])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  const unreadCount = messages.filter(
    (m) => m.sender_id !== user.id && m.created_at > lastSeen
  ).length

  const openModal = () => {
    const now = new Date().toISOString()
    setLastSeen(now)
    localStorage.setItem(LS_LAST_SEEN, now)
    setIsOpen(true)
  }

  const closeModal = () => setIsOpen(false)

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    await supabase.from('messages').insert({
      sender_id: user.id,
      sender_name: user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null,
      content,
    })
    setSending(false)
  }

  return (
    <>
      {/* ── Bulle flottante ── */}
      <motion.button
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full
                   bg-gradient-to-br from-pink-400 to-violet-400
                   shadow-lg shadow-pink-300/40
                   flex items-center justify-center cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Ouvrir les messages"
      >
        <MessageCircle size={24} className="text-white" strokeWidth={1.8} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full
                         bg-red-500 text-white text-xs font-bold
                         flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Modale ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-pink-950/20 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Panel */}
            <motion.div
              className="relative z-10 w-full max-w-lg flex flex-col rounded-3xl overflow-hidden
                         bg-white/95 dark:bg-[#140a30]/95 backdrop-blur-md shadow-2xl shadow-pink-200/40 dark:shadow-purple-950/40"
              style={{ height: '85vh' }}
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100 dark:border-pink-900/30 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl" role="img" aria-label="lettre">💌</span>
                  <h2
                    className="font-bold text-pink-700 dark:text-pink-200"
                    style={{ fontFamily: '"Varela Round", sans-serif' }}
                  >
                    Crousti-message
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="text-pink-300 hover:text-pink-500 dark:text-pink-400 dark:hover:text-pink-200 transition-colors cursor-pointer p-1"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <span className="text-5xl">💕</span>
                    <p className="text-pink-400 dark:text-pink-300 text-sm leading-relaxed">
                      Aucun message pour l'instant.
                      <br />
                      Soyez le premier à en envoyer un !
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user.id
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed break-words ${
                            isMine
                              ? 'bg-gradient-to-br from-pink-400 to-violet-400 text-white rounded-2xl rounded-br-sm'
                              : 'bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-100 rounded-2xl rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-pink-300 dark:text-pink-400 text-xs px-1">{fmtRelativeOrShort(msg.created_at)}</span>
                      </motion.div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-4 border-t border-pink-100 dark:border-pink-900/30 shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); send() }}
                  className="flex gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Un petit message doux…"
                    className="input-field flex-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="btn-primary px-4 py-2 flex items-center justify-center shrink-0"
                    aria-label="Envoyer"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
