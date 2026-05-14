import { useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { ArrowLeft, Home, User, Pencil, Loader2, ShoppingBag } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { RoomScene } from './RoomScene'
import { RoomCustomizer } from './RoomCustomizer'
import { RoomShop } from './RoomShop'
import { type ShopItem, SHOP_ITEMS } from './shopItems'

export type RoomPhoto    = { slot: number; url: string }
export type CustomSticker = { slot: number; url: string }

export type RoomData = {
  user_id:              string
  wall_color:           string
  floor_color:          string
  light_ambiance:       'day' | 'sunset' | 'night'
  objects:              string[]         // actuellement affichés
  unlocked_objects:     string[]         // débloqués (gratuits + achetés)
  photo_slots:          number           // 2, 3 ou 4
  photos:               RoomPhoto[]
  stickers:             string[]         // stickers prédéfinis
  custom_sticker_slots: number           // 0, 1 ou 2
  custom_stickers:      CustomSticker[]
  room_size_level:      number           // 0, 1, 2
}

export function defaultRoom(userId: string): RoomData {
  return {
    user_id:              userId,
    wall_color:           '#fce7f3',
    floor_color:          '#d4a96a',
    light_ambiance:       'day',
    objects:              ['bed', 'plant'],
    unlocked_objects:     ['bed', 'plant'],
    photo_slots:          2,
    photos:               [],
    stickers:             [],
    custom_sticker_slots: 0,
    custom_stickers:      [],
    room_size_level:      0,
  }
}

type Props = {
  user: SupabaseUser
  onBack: () => void
}

export function RoomPage({ user, onBack }: Props) {
  const [viewing, setViewing]           = useState<'own' | 'other'>('own')
  const [ownRoom, setOwnRoom]           = useState<RoomData>(defaultRoom(user.id))
  const [otherRoom, setOtherRoom]       = useState<RoomData | null>(null)
  const [coins, setCoins]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [shopOpen, setShopOpen]         = useState(false)

  useEffect(() => {
    async function load() {
      const [roomsRes, coinsRes] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('couple_settings').select('coins').eq('id', 1).maybeSingle(),
      ])
      if (roomsRes.data) {
        const own   = roomsRes.data.find((r: RoomData) => r.user_id === user.id)
        const other = roomsRes.data.find((r: RoomData) => r.user_id !== user.id)
        if (own)   setOwnRoom({ ...defaultRoom(user.id), ...own })
        if (other) setOtherRoom({ ...defaultRoom(other.user_id), ...other })
      }
      if (coinsRes.data) setCoins(coinsRes.data.coins ?? 0)
      setLoading(false)
    }
    load()

    // Realtime rooms
    const roomChannel = supabase
      .channel('rooms-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, ({ new: row }) => {
        const r = row as RoomData
        if (r.user_id === user.id) {
          setOwnRoom(prev => ({ ...prev, ...r }))
        } else {
          setOtherRoom(prev => prev ? { ...prev, ...r } : { ...defaultRoom(r.user_id), ...r })
        }
      })
      .subscribe()

    // Realtime coins
    const coinChannel = supabase
      .channel('coins-rt-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couple_settings' }, ({ new: row }) => {
        setCoins((row as { coins: number }).coins ?? 0)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(coinChannel)
    }
  }, [user.id])

  async function saveRoom(updates: Partial<RoomData>) {
    const updated = { ...ownRoom, ...updates }
    setOwnRoom(updated)
    await supabase.from('rooms').upsert({
      ...updated,
      user_id:    user.id,
      updated_at: new Date().toISOString(),
    })
  }

  async function purchaseItem(item: ShopItem): Promise<{ success: boolean; reason?: string }> {
    const buyerName = user.user_metadata?.first_name ?? ''
    const { data, error } = await supabase.rpc('purchase_room_upgrade', {
      p_buyer_id:   user.id,
      p_buyer_name: buyerName,
      p_item_id:    item.id,
      p_item_label: item.label,
      p_cost:       item.cost,
    })
    if (error || !data?.success) {
      return { success: false, reason: data?.reason ?? 'error' }
    }

    // Mise à jour locale du solde
    setCoins(data.new_coins)

    // Mise à jour de la chambre selon le type d'achat
    const updates: Partial<RoomData> = {}

    if (item.id === 'room_size_1') {
      updates.room_size_level = 1
    } else if (item.id === 'room_size_2') {
      updates.room_size_level = 2
    } else if (item.id.startsWith('object_')) {
      const objectId = item.id.replace('object_', '')
      updates.unlocked_objects = [...ownRoom.unlocked_objects, objectId]
      updates.objects          = [...ownRoom.objects, objectId]
    } else if (item.id === 'frame_3') {
      updates.photo_slots = 3
    } else if (item.id === 'frame_4') {
      updates.photo_slots = 4
    } else if (item.id === 'sticker_slot_1') {
      updates.custom_sticker_slots = 1
    } else if (item.id === 'sticker_slot_2') {
      updates.custom_sticker_slots = 2
    }

    await saveRoom(updates)
    return { success: true }
  }

  function isOwnedInShop(item: ShopItem): boolean {
    if (item.id === 'room_size_1')     return ownRoom.room_size_level >= 1
    if (item.id === 'room_size_2')     return ownRoom.room_size_level >= 2
    if (item.id.startsWith('object_')) return ownRoom.unlocked_objects.includes(item.id.replace('object_', ''))
    if (item.id === 'frame_3')         return ownRoom.photo_slots >= 3
    if (item.id === 'frame_4')         return ownRoom.photo_slots >= 4
    if (item.id === 'sticker_slot_1')  return ownRoom.custom_sticker_slots >= 1
    if (item.id === 'sticker_slot_2')  return ownRoom.custom_sticker_slots >= 2
    return false
  }

  const hasAffordableItem = SHOP_ITEMS.some(item => !isOwnedInShop(item) && coins >= item.cost)

  const currentRoom = viewing === 'own' ? ownRoom : (otherRoom ?? ownRoom)
  const isOwnRoom   = viewing === 'own'
  const hasOther    = otherRoom !== null

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-pink-200/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-200/15 rounded-full blur-3xl animate-blob-delayed" />
      </div>

      {/* Navbar */}
      <nav className="shrink-0 z-50 px-4 pt-4 pb-2">
        <div className="max-w-5xl mx-auto glass-card rounded-2xl px-5 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} aria-hidden />
            <span className="text-sm font-medium">Accueil</span>
          </button>

          {/* Toggle */}
          <div className="flex items-center gap-1 bg-pink-50/80 rounded-xl p-1">
            <button
              onClick={() => setViewing('own')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewing === 'own' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400 hover:text-pink-600'
              }`}
            >
              <Home size={12} aria-hidden />
              Ma chambre
            </button>
            <button
              onClick={() => setViewing('other')}
              disabled={!hasOther}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                viewing === 'other' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400 hover:text-pink-600'
              }`}
            >
              <User size={12} aria-hidden />
              Sa chambre
            </button>
          </div>

          {/* Actions (ma chambre uniquement) */}
          {isOwnRoom ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShopOpen(true); setCustomizerOpen(false) }}
                className="relative flex items-center gap-1.5 text-amber-500 hover:text-amber-600 transition-colors cursor-pointer text-sm font-medium"
                aria-label="Boutique"
              >
                <ShoppingBag size={15} aria-hidden />
                <span className="hidden sm:block">Boutique</span>
                {hasAffordableItem && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" aria-hidden />
                )}
              </button>
              <button
                onClick={() => { setCustomizerOpen(true); setShopOpen(false) }}
                className="flex items-center gap-1.5 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer text-sm font-medium"
                aria-label="Décorer"
              >
                <Pencil size={15} aria-hidden />
                <span className="hidden sm:block">Décorer</span>
              </button>
            </div>
          ) : (
            <div className="w-24" aria-hidden />
          )}
        </div>
      </nav>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-pink-400 animate-spin mx-auto mb-2" />
              <p className="text-pink-400 text-sm">Préparation de la chambre…</p>
            </div>
          </div>
        ) : (
          <Canvas camera={{ position: [12, 10, 12], fov: 35 }} shadows style={{ width: '100%', height: '100%' }}>
            <Suspense fallback={null}>
              <RoomScene room={currentRoom} userId={user.id} onSavePhoto={saveRoom} />
            </Suspense>
          </Canvas>
        )}

        {/* Label flottant */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div className="glass-card rounded-xl px-4 py-2">
              <span className="text-pink-600 font-medium text-sm" style={{ fontFamily: '"Varela Round", sans-serif' }}>
                {isOwnRoom ? '🏠 Ma chambre' : '💝 Sa chambre'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Hint boutique premier achat possible */}
        {!loading && isOwnRoom && hasAffordableItem && !shopOpen && !customizerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
          >
            <button
              onClick={() => setShopOpen(true)}
              className="glass-card rounded-2xl px-5 py-3 flex items-center gap-2 text-amber-600 hover:text-amber-700 transition-colors cursor-pointer shadow-lg"
            >
              <ShoppingBag size={15} />
              <span className="text-sm font-medium">Tu peux acheter une amélioration ! 🪙</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Panneau Décorer */}
      {customizerOpen && (
        <RoomCustomizer
          room={ownRoom}
          onSave={saveRoom}
          onClose={() => setCustomizerOpen(false)}
          onOpenShop={() => { setCustomizerOpen(false); setShopOpen(true) }}
          userId={user.id}
        />
      )}

      {/* Boutique */}
      {shopOpen && (
        <RoomShop
          room={ownRoom}
          coins={coins}
          onPurchase={purchaseItem}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  )
}
