import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Message = {
  id: string
  sender_id: string
  sender_name: string | null
  content: string
  created_at: string
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function CroustiMessage({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoaded(true)
      })

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
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

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

  const lastMsg = messages[messages.length - 1]

  return (
    <>
      {/* ── Preview card ── */}
      <div
        className="glass-card rounded-3xl p-6 cursor-pointer group
                   hover:shadow-lg hover:shadow-pink-100 transition-all duration-200"
        onClick={() => setIsOpen(true)}
        role="button"
        aria-label="Ouvrir Crousti-message"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-pink-400" size={18} strokeWidth={1.8} />
            <h2
              className="font-bold text-pink-700 text-sm"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Crousti-message 💌
            </h2>
          </div>
          <span className="text-pink-300 text-xs group-hover:text-pink-500 transition-colors">
            →
          </span>
        </div>

        {loaded ? (
          lastMsg ? (
            <div>
              <p className="text-pink-600 text-sm leading-relaxed line-clamp-2">
                <span className="font-medium">
                  {lastMsg.sender_id === user.id ? 'Moi' : lastMsg.sender_name ?? 'Eux'}&nbsp;:&nbsp;
                </span>
                {lastMsg.content}
              </p>
              <p className="text-pink-300 text-xs mt-2">{fmtTime(lastMsg.created_at)}</p>
            </div>
          ) : (
            <p className="text-pink-400 text-sm">Envoyer votre premier Crousti-message 💕</p>
          )
        ) : null}
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
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-pink-950/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
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
                  <span className="text-xl" role="img" aria-label="lettre">💌</span>
                  <h2
                    className="font-bold text-pink-700"
                    style={{ fontFamily: '"Varela Round", sans-serif' }}
                  >
                    Crousti-message
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

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <span className="text-5xl">💕</span>
                    <p className="text-pink-400 text-sm leading-relaxed">
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
                              : 'bg-pink-50 text-pink-800 rounded-2xl rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-pink-300 text-xs px-1">{fmtTime(msg.created_at)}</span>
                      </motion.div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-4 border-t border-pink-100 shrink-0">
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
