import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Send } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

const COLORS = [
  '#1f2937', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
]
const SIZES = [3, 7, 14]
const CANVAS_SIZE = 400
const LS_KEY = 'nidou_art_last_seen'

type Artwork = {
  id: string
  sender_id: string
  sender_name: string | null
  image_url: string
  created_at: string
}

export function CroustiArt({ user, compact = false }: { user: User; compact?: boolean }) {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [color, setColor] = useState('#ec4899')
  const [brushSize, setBrushSize] = useState(7)
  const [isSending, setIsSending] = useState(false)
  const [hasNew, setHasNew] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const colorRef = useRef(color)
  const brushRef = useRef(brushSize)

  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { brushRef.current = brushSize }, [brushSize])

  const senderName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null

  useEffect(() => {
    supabase
      .from('artworks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = (data ?? []) as Artwork[]
        setArtworks(rows)
        const lastSeen = localStorage.getItem(LS_KEY)
        const newFromOther = rows.some(
          (a) => a.sender_id !== user.id && (!lastSeen || new Date(a.created_at) > new Date(lastSeen))
        )
        setHasNew(newFromOther)
      })

    const channel = supabase
      .channel('artworks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'artworks' },
        (payload) => {
          const a = payload.new as Artwork
          setArtworks((prev) => [a, ...prev])
          if (a.sender_id !== user.id) setHasNew(true)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [isOpen])

  function getPos(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (clientY - rect.top) * (CANVAS_SIZE / rect.height),
    }
  }

  function startDraw(x: number, y: number) {
    isDrawing.current = true
    lastPoint.current = { x, y }
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.fillStyle = colorRef.current
    ctx.beginPath()
    ctx.arc(x, y, brushRef.current / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  function continueDraw(x: number, y: number) {
    if (!isDrawing.current || !lastPoint.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = brushRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    lastPoint.current = { x, y }
  }

  function stopDraw() {
    isDrawing.current = false
    lastPoint.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }

  async function sendArtwork() {
    const canvas = canvasRef.current
    if (!canvas || isSending) return
    setIsSending(true)
    canvas.toBlob(async (blob) => {
      if (!blob) { setIsSending(false); return }
      const path = `${user.id}/${Date.now()}.png`
      const { error } = await supabase.storage
        .from('artworks')
        .upload(path, blob, { contentType: 'image/png' })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('artworks').getPublicUrl(path)
        await supabase.from('artworks').insert({
          sender_id: user.id,
          sender_name: senderName,
          image_url: publicUrl,
        })
        clearCanvas()
      }
      setIsSending(false)
    }, 'image/png')
  }

  function openModal() {
    setIsOpen(true)
    setHasNew(false)
    localStorage.setItem(LS_KEY, new Date().toISOString())
  }

  const lastReceived = artworks.find((a) => a.sender_id !== user.id)

  return (
    <>
      {/* ── Preview card ── */}
      {compact ? (
        <motion.div
          className="relative w-full rounded-3xl overflow-hidden cursor-pointer shadow-xl shadow-pink-200/50 group"
          style={{ aspectRatio: '1 / 1' }}
          onClick={openModal}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.97 }}
          role="button"
          aria-label="Ouvrir CroustiArt"
        >
          {lastReceived ? (
            <img
              src={lastReceived.image_url}
              alt="Dernière œuvre"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-200 via-rose-100 to-violet-100 flex flex-col items-center justify-center gap-2">
              <span className="text-4xl">🎨</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
            <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: '"Varela Round", sans-serif' }}>
              CroustiArt
            </p>
            <p className="text-white/70 text-xs">🎨 Dessine !</p>
          </div>
          {hasNew && (
            <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </motion.div>
      ) : (
        <div
          className="glass-card rounded-3xl overflow-hidden cursor-pointer group relative
                     hover:shadow-lg hover:shadow-pink-100 transition-all duration-200"
          onClick={openModal}
          role="button"
          aria-label="Ouvrir CroustiArt"
        >
          {lastReceived ? (
            <div className="relative h-40">
              <img src={lastReceived.image_url} alt="Dernière œuvre" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-bold text-sm" style={{ fontFamily: '"Varela Round", sans-serif' }}>
                  🎨 CroustiArt
                </p>
                <p className="text-white/75 text-xs">
                  Dessin de {lastReceived.sender_name ?? 'ton partenaire'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-pink-700 text-sm" style={{ fontFamily: '"Varela Round", sans-serif' }}>
                  🎨 CroustiArt
                </h2>
                <span className="text-pink-300 text-xs group-hover:text-pink-500 transition-colors">→</span>
              </div>
              <p className="text-pink-400 text-sm">Dessine quelque chose pour ton partenaire !</p>
            </div>
          )}
          {hasNew && (
            <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      )}

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
            <div className="absolute inset-0 bg-pink-950/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

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
                <h2 className="font-bold text-pink-700" style={{ fontFamily: '"Varela Round", sans-serif' }}>
                  🎨 CroustiArt
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-pink-300 hover:text-pink-500 transition-colors cursor-pointer p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Canvas + outils */}
                <div className="px-5 py-4 border-b border-pink-50">
                  <div className="rounded-2xl overflow-hidden border-2 border-pink-100 mb-4">
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_SIZE}
                      height={CANVAS_SIZE}
                      className="w-full touch-none block"
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => { const p = getPos(e.clientX, e.clientY); startDraw(p.x, p.y) }}
                      onMouseMove={(e) => { const p = getPos(e.clientX, e.clientY); continueDraw(p.x, p.y) }}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={(e) => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); startDraw(p.x, p.y) }}
                      onTouchMove={(e) => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); continueDraw(p.x, p.y) }}
                      onTouchEnd={stopDraw}
                    />
                  </div>

                  {/* Palette */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${color === c ? 'scale-125 border-pink-500' : 'border-transparent hover:scale-110'}`}
                        style={{
                          backgroundColor: c,
                          boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e5e7eb' : undefined,
                        }}
                        aria-label={`Couleur ${c}`}
                      />
                    ))}
                  </div>

                  {/* Taille + actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {SIZES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setBrushSize(s)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer
                            ${brushSize === s ? 'border-pink-400 bg-pink-50' : 'border-pink-100 hover:border-pink-200'}`}
                        >
                          <span className="rounded-full bg-pink-400" style={{ width: s, height: s }} />
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={clearCanvas}
                        className="flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-600 transition-colors cursor-pointer px-3 py-2"
                      >
                        <Trash2 size={14} />
                        Effacer
                      </button>
                      <button
                        onClick={sendArtwork}
                        disabled={isSending}
                        className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2 disabled:opacity-50"
                      >
                        <Send size={14} />
                        {isSending ? 'Envoi…' : 'Envoyer'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Galerie */}
                {artworks.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-3">
                      Galerie
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {artworks.map((a) => (
                        <div key={a.id}>
                          <img
                            src={a.image_url}
                            alt="Œuvre"
                            className="w-full aspect-square object-cover rounded-xl border border-pink-100"
                          />
                          <p className="text-xs text-pink-400 text-center mt-1 truncate">
                            {a.sender_id === user.id ? 'Moi' : (a.sender_name ?? '?')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
