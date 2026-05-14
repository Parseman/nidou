import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, ShoppingBag, Lock, Paintbrush } from 'lucide-react'
import type { RoomData } from './RoomPage'
import { StickerDrawer } from './StickerDrawer'
import { supabase } from '../../lib/supabase'

const WALL_COLORS = [
  { label: 'Rose',        value: '#fce7f3' },
  { label: 'Violet',      value: '#ede9fe' },
  { label: 'Bleu ciel',   value: '#dbeafe' },
  { label: 'Vert menthe', value: '#dcfce7' },
  { label: 'Pêche',       value: '#ffedd5' },
  { label: 'Jaune pâle',  value: '#fef9c3' },
  { label: 'Blanc',       value: '#f9fafb' },
  { label: 'Gris doux',   value: '#f3f4f6' },
]

const FLOOR_COLORS = [
  { label: 'Parquet doré', value: '#d4a96a' },
  { label: 'Chêne foncé',  value: '#a07840' },
  { label: 'Béton clair',  value: '#e5e7eb' },
  { label: 'Blanc',        value: '#f9fafb' },
  { label: 'Terracotta',   value: '#d97706' },
  { label: 'Vert sauge',   value: '#86efac' },
  { label: 'Violet pâle',  value: '#e9d5ff' },
  { label: 'Rose pâle',    value: '#fce7f3' },
]

const ALL_OBJECTS = [
  { id: 'bed',       label: 'Lit',           emoji: '🛏️', free: true  },
  { id: 'plant',     label: 'Plante',        emoji: '🪴', free: true  },
  { id: 'desk',      label: 'Bureau',        emoji: '🖥️', free: false, cost: 4500  },
  { id: 'bookshelf', label: 'Bibliothèque',  emoji: '📚', free: false, cost: 6000  },
  { id: 'rug',       label: 'Tapis',         emoji: '🟣', free: false, cost: 2500  },
  { id: 'lamp',      label: 'Lampe',         emoji: '💡', free: false, cost: 3500  },
]

const STD_STICKERS = [
  { id: 'heart',   label: 'Cœur',   emoji: '♥', color: 'text-pink-500'   },
  { id: 'star',    label: 'Étoile', emoji: '★', color: 'text-amber-400'  },
  { id: 'moon',    label: 'Lune',   emoji: '☽', color: 'text-violet-400' },
  { id: 'flowers', label: 'Fleurs', emoji: '✿', color: 'text-rose-400'   },
]

const AMBIANCES = [
  { id: 'day',    label: 'Journée',          emoji: '☀️' },
  { id: 'sunset', label: 'Coucher de soleil', emoji: '🌅' },
  { id: 'night',  label: 'Nuit',             emoji: '🌙' },
]

type Tab = 'couleurs' | 'objets' | 'deco' | 'photos'

type Props = {
  room: RoomData
  onSave: (updates: Partial<RoomData>) => void
  onClose: () => void
  onOpenShop: () => void
  userId: string
}

export function RoomCustomizer({ room, onSave, onClose, onOpenShop, userId }: Props) {
  const [tab, setTab]         = useState<Tab>('couleurs')
  const [uploading, setUploading] = useState<number | null>(null)
  const [stickerDrawSlot, setStickerDrawSlot] = useState<number | null>(null)
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
                   useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function toggleObject(id: string) {
    if (!room.unlocked_objects.includes(id)) return
    const next = room.objects.includes(id)
      ? room.objects.filter(o => o !== id)
      : [...room.objects, id]
    onSave({ objects: next })
  }

  function toggleSticker(id: string) {
    const next = room.stickers.includes(id)
      ? room.stickers.filter(s => s !== id)
      : [...room.stickers, id]
    onSave({ stickers: next })
  }

  async function uploadPhoto(slot: number, file: File) {
    setUploading(slot)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/slot_${slot}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('room-photos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('room-photos').getPublicUrl(path)
      const photos = room.photos.filter(p => p.slot !== slot)
      photos.push({ slot, url: publicUrl })
      onSave({ photos })
    } catch (e) {
      console.error('Upload photo chambre :', e)
    } finally {
      setUploading(null)
    }
  }

  function removePhoto(slot: number) {
    onSave({ photos: room.photos.filter(p => p.slot !== slot) })
  }

  function saveCustomSticker(slot: number, url: string) {
    const custom = room.custom_stickers.filter(s => s.slot !== slot)
    custom.push({ slot, url })
    onSave({ custom_stickers: custom })
    setStickerDrawSlot(null)
  }

  const tabLabels: Record<Tab, string> = {
    couleurs: '🎨 Couleurs',
    objets:   '🛋️ Objets',
    deco:     '✨ Déco',
    photos:   '📸 Photos',
  }

  const photoSlots = Array.from({ length: room.photo_slots }, (_, i) => i)

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        >
          {/* Poignée */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-pink-200 rounded-full" />
          </div>

          {/* En-tête */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h3 className="font-bold text-pink-700 text-lg" style={{ fontFamily: '"Varela Round", sans-serif' }}>
              Décorer ma chambre
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenShop}
                className="flex items-center gap-1.5 text-amber-500 hover:text-amber-600 transition-colors cursor-pointer text-xs font-medium"
              >
                <ShoppingBag size={14} />
                Boutique
              </button>
              <button onClick={onClose} className="text-pink-400 hover:text-pink-600 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex gap-1 px-5 mb-3">
            {(Object.keys(tabLabels) as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  tab === t ? 'bg-pink-100 text-pink-600' : 'text-pink-400 hover:text-pink-500'
                }`}
              >
                {tabLabels[t]}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div className="overflow-y-auto flex-1 px-5 pb-10">

            {/* ── Couleurs ── */}
            {tab === 'couleurs' && (
              <div className="space-y-6">
                <div>
                  <p className="text-pink-500 text-sm font-medium mb-3">Couleur des murs</p>
                  <div className="grid grid-cols-4 gap-2">
                    {WALL_COLORS.map(c => (
                      <button key={c.value} onClick={() => onSave({ wall_color: c.value })} title={c.label}
                        className={`aspect-square rounded-xl border-2 transition-all cursor-pointer ${room.wall_color === c.value ? 'border-pink-500 scale-90 shadow-md' : 'border-transparent hover:border-pink-300'}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-pink-500 text-sm font-medium mb-3">Couleur du sol</p>
                  <div className="grid grid-cols-4 gap-2">
                    {FLOOR_COLORS.map(c => (
                      <button key={c.value} onClick={() => onSave({ floor_color: c.value })} title={c.label}
                        className={`aspect-square rounded-xl border-2 transition-all cursor-pointer ${room.floor_color === c.value ? 'border-pink-500 scale-90 shadow-md' : 'border-transparent hover:border-pink-300'}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-pink-500 text-sm font-medium mb-3">Ambiance lumineuse</p>
                  <div className="grid grid-cols-3 gap-2">
                    {AMBIANCES.map(a => (
                      <button key={a.id} onClick={() => onSave({ light_ambiance: a.id as RoomData['light_ambiance'] })}
                        className={`py-3 rounded-xl text-sm font-medium border-2 transition-all cursor-pointer text-center ${room.light_ambiance === a.id ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-pink-100 text-pink-400 hover:border-pink-300'}`}
                      >
                        <div className="text-xl mb-1">{a.emoji}</div>
                        <div className="text-xs">{a.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Objets ── */}
            {tab === 'objets' && (
              <div className="space-y-2">
                <p className="text-pink-400 text-xs mb-3">Les objets verrouillés s'achètent à la boutique</p>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_OBJECTS.map(obj => {
                    const unlocked = room.unlocked_objects.includes(obj.id)
                    const active   = room.objects.includes(obj.id)
                    return (
                      <button
                        key={obj.id}
                        onClick={() => unlocked ? toggleObject(obj.id) : onOpenShop()}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          !unlocked ? 'border-gray-100 opacity-60' :
                          active    ? 'border-pink-400 bg-pink-50 text-pink-600' :
                                      'border-pink-100 text-pink-400 hover:border-pink-300'
                        }`}
                      >
                        <span className="text-xl">{obj.emoji}</span>
                        <span className="text-sm font-medium flex-1 text-left">{obj.label}</span>
                        {!unlocked ? (
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <Lock size={11} />
                            <span>{obj.cost}</span>
                          </div>
                        ) : active ? (
                          <span className="text-pink-400 text-xs">✓</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Déco ── */}
            {tab === 'deco' && (
              <div className="space-y-4">
                {/* Stickers standards */}
                <div>
                  <p className="text-pink-500 text-sm font-medium mb-3">Stickers</p>
                  <div className="grid grid-cols-2 gap-3">
                    {STD_STICKERS.map(s => (
                      <button key={s.id} onClick={() => toggleSticker(s.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          room.stickers.includes(s.id)
                            ? 'border-violet-400 bg-violet-50 text-violet-600'
                            : 'border-pink-100 text-pink-400 hover:border-pink-300'
                        }`}
                      >
                        <span className={`text-2xl ${s.color}`}>{s.emoji}</span>
                        <span className="text-sm font-medium flex-1 text-left">{s.label}</span>
                        {room.stickers.includes(s.id) && <span className="text-violet-400 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stickers perso dessinés */}
                <div>
                  <p className="text-pink-500 text-sm font-medium mb-3">Stickers perso</p>
                  {room.custom_sticker_slots === 0 ? (
                    <button
                      onClick={onOpenShop}
                      className="w-full py-3 border-2 border-dashed border-amber-200 rounded-xl flex items-center justify-center gap-2 text-amber-500 hover:border-amber-400 cursor-pointer transition-colors text-sm"
                    >
                      <ShoppingBag size={15} />
                      Acheter un emplacement sticker (400 🪙)
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: room.custom_sticker_slots }, (_, slot) => {
                        const existing = room.custom_stickers.find(s => s.slot === slot)
                        return (
                          <div key={slot} className="border-2 border-violet-100 rounded-xl p-3">
                            <p className="text-violet-500 text-xs font-medium mb-2">Sticker #{slot + 1}</p>
                            {existing ? (
                              <div className="relative">
                                <img src={existing.url} alt={`Sticker ${slot+1}`} className="w-full aspect-square object-cover rounded-lg" />
                                <button
                                  onClick={() => setStickerDrawSlot(slot)}
                                  className="absolute bottom-1 right-1 bg-white/85 rounded-full p-1 text-violet-500 hover:text-violet-700 cursor-pointer shadow"
                                >
                                  <Paintbrush size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setStickerDrawSlot(slot)}
                                className="w-full aspect-square border-2 border-dashed border-violet-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-violet-400 hover:border-violet-400 cursor-pointer transition-colors"
                              >
                                <Paintbrush size={18} />
                                <span className="text-xs">Dessiner</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Photos ── */}
            {tab === 'photos' && (
              <div className="space-y-4">
                <p className="text-pink-400 text-xs mb-1">
                  {room.photo_slots} cadre{room.photo_slots > 1 ? 's' : ''} disponible{room.photo_slots > 1 ? 's' : ''}
                  {room.photo_slots < 4 && (
                    <button onClick={onOpenShop} className="ml-2 text-amber-500 hover:text-amber-600 underline cursor-pointer">
                      + Acheter un cadre
                    </button>
                  )}
                </p>
                {photoSlots.map(slot => {
                  const photo   = room.photos.find(p => p.slot === slot)
                  const fileRef = fileRefs[slot]
                  return (
                    <div key={slot} className="border-2 border-pink-100 rounded-2xl p-4">
                      <p className="text-pink-500 text-sm font-medium mb-3">Cadre {slot + 1}</p>
                      {photo?.url ? (
                        <div className="relative">
                          <img src={photo.url} alt={`Photo ${slot+1}`} className="w-full h-44 object-cover rounded-xl" />
                          <button
                            onClick={() => removePhoto(slot)}
                            className="absolute top-2 right-2 bg-white/85 rounded-full p-1.5 text-pink-400 hover:text-pink-600 cursor-pointer shadow"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileRef?.current?.click()}
                          disabled={uploading === slot}
                          className="w-full h-36 border-2 border-dashed border-pink-200 rounded-xl flex flex-col items-center justify-center gap-2 text-pink-400 hover:border-pink-400 hover:text-pink-500 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {uploading === slot ? (
                            <span className="text-xs">Envoi…</span>
                          ) : (
                            <>
                              <Upload size={20} />
                              <span className="text-xs">Choisir une photo</span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadPhoto(slot, file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>

      {/* Mini-canvas pour sticker perso */}
      {stickerDrawSlot !== null && (
        <StickerDrawer
          slot={stickerDrawSlot}
          userId={userId}
          onSave={(url) => saveCustomSticker(stickerDrawSlot, url)}
          onClose={() => setStickerDrawSlot(null)}
        />
      )}
    </>
  )
}
