import { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Trash2, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CANVAS_SIZE = 200
const COLORS = [
  '#1f2937', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff', '#fcd7e8', '#fbbf24', '#a3e635',
]
const SIZES = [4, 8, 16]

type Props = {
  slot: number
  userId: string
  onSave: (url: string) => void
  onClose: () => void
}

export function StickerDrawer({ slot, userId, onSave, onClose }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const isDrawing  = useRef(false)
  const lastPoint  = useRef<{ x: number; y: number } | null>(null)
  const colorRef   = useRef('#ec4899')
  const sizeRef    = useRef(8)

  const [color, setColor]   = useState('#ec4899')
  const [size, setSize]     = useState(8)
  const [saving, setSaving] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current = size }, [size])

  // Initialise le fond blanc
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    }
  }

  function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth   = sizeRef.current
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    setHasContent(true)
  }

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
    const pos = getPos(e)
    lastPoint.current = pos
    drawLine(pos, pos)
  }, [])

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing.current || !lastPoint.current) return
    const pos = getPos(e)
    drawLine(lastPoint.current, pos)
    lastPoint.current = pos
  }, [])

  const onEnd = useCallback(() => {
    isDrawing.current = false
    lastPoint.current = null
  }, [])

  function clear() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    setHasContent(false)
  }

  async function handleSave() {
    if (!canvasRef.current || !hasContent) return
    setSaving(true)
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvasRef.current!.toBlob(b => b ? res(b) : rej(new Error('canvas empty')), 'image/png')
      )
      const path = `stickers/${userId}/slot_${slot}_${Date.now()}.png`
      const { error } = await supabase.storage
        .from('room-photos')
        .upload(path, blob, { upsert: true, contentType: 'image/png' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('room-photos').getPublicUrl(path)
      onSave(publicUrl)
    } catch (e) {
      console.error('Erreur upload sticker :', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3
            className="font-bold text-pink-700 text-base"
            style={{ fontFamily: '"Varela Round", sans-serif' }}
          >
            Dessine ton sticker #{slot + 1}
          </h3>
          <button onClick={onClose} className="text-pink-400 hover:text-pink-600 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Canvas */}
        <div className="px-5">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-full rounded-2xl border-2 border-pink-100 touch-none cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
            onMouseDown={onStart}
            onMouseMove={onMove}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={onStart}
            onTouchMove={onMove}
            onTouchEnd={onEnd}
          />
        </div>

        {/* Couleurs */}
        <div className="px-5 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                  color === c ? 'border-pink-500 scale-90 shadow' : 'border-transparent hover:border-pink-300'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Taille du pinceau */}
        <div className="px-5 pt-3 pb-4 flex items-center gap-3">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                size === s ? 'border-pink-400 bg-pink-50' : 'border-pink-100 hover:border-pink-300'
              }`}
              style={{ width: s * 2.5 + 16, height: s * 2.5 + 16 }}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: s, height: s, color: color === '#ffffff' ? '#ccc' : color }}
              />
            </button>
          ))}

          <div className="flex-1" />

          {/* Effacer */}
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer text-xs"
          >
            <Trash2 size={14} />
            Effacer
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-pink-100 text-pink-400 font-medium text-sm hover:border-pink-300 cursor-pointer transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!hasContent || saving}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:shadow-lg hover:shadow-pink-200 transition-all"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Envoi…' : 'Coller au mur'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
