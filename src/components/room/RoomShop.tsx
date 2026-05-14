import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Coins, Lock, CheckCircle2, ShoppingCart, AlertCircle } from 'lucide-react'
import type { RoomData } from './RoomPage'
import { SHOP_ITEMS, SHOP_CATEGORY_LABELS, type ShopCategory, type ShopItem } from './shopItems'

type Props = {
  room: RoomData
  coins: number
  onPurchase: (item: ShopItem) => Promise<{ success: boolean; reason?: string }>
  onClose: () => void
}

function isOwned(item: ShopItem, room: RoomData): boolean {
  if (item.id === 'room_size_1')    return room.room_size_level >= 1
  if (item.id === 'room_size_2')    return room.room_size_level >= 2
  if (item.id.startsWith('object_')) return room.unlocked_objects.includes(item.id.replace('object_', ''))
  if (item.id === 'frame_3')        return room.photo_slots >= 3
  if (item.id === 'frame_4')        return room.photo_slots >= 4
  if (item.id === 'sticker_slot_1') return room.custom_sticker_slots >= 1
  if (item.id === 'sticker_slot_2') return room.custom_sticker_slots >= 2
  return false
}

function isUnlocked(item: ShopItem, room: RoomData): boolean {
  if (!item.requiresItemId) return true
  const required = SHOP_ITEMS.find(i => i.id === item.requiresItemId)
  return required ? isOwned(required, room) : true
}

export function RoomShop({ room, coins, onPurchase, onClose }: Props) {
  const [tab, setTab]         = useState<ShopCategory>('room')
  const [confirming, setConfirming] = useState<ShopItem | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const items = SHOP_ITEMS.filter(i => i.category === tab)

  async function handleBuy(item: ShopItem) {
    if (confirming?.id !== item.id) {
      setConfirming(item)
      return
    }
    setPurchasing(true)
    setConfirming(null)
    const result = await onPurchase(item)
    setPurchasing(false)
    if (result.success) {
      setFeedback({ ok: true, msg: `${item.label} débloqué ! ✨` })
    } else {
      setFeedback({ ok: false, msg: result.reason === 'not_enough_coins' ? 'Pas assez de pièces 🪙' : 'Erreur lors de l\'achat' })
    }
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col overflow-hidden"
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
          <div>
            <h3
              className="font-bold text-pink-700 text-lg"
              style={{ fontFamily: '"Varela Round", sans-serif' }}
            >
              Boutique
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Coins size={14} className="text-amber-500" aria-hidden />
              <span className="text-amber-600 font-bold text-sm">{coins.toLocaleString()} pièces</span>
            </div>
          </div>
          <button onClick={onClose} className="text-pink-400 hover:text-pink-600 transition-colors cursor-pointer" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Feedback toast */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-5 mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
              feedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {feedback.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </motion.div>
        )}

        {/* Onglets catégories */}
        <div className="flex gap-1 px-5 mb-3 overflow-x-auto">
          {(Object.keys(SHOP_CATEGORY_LABELS) as ShopCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => { setTab(cat); setConfirming(null) }}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                tab === cat ? 'bg-pink-100 text-pink-600' : 'text-pink-400 hover:text-pink-500'
              }`}
            >
              {SHOP_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Liste des items */}
        <div className="overflow-y-auto flex-1 px-5 pb-10 space-y-3">
          {items.map(item => {
            const owned    = isOwned(item, room)
            const unlocked = isUnlocked(item, room)
            const canAfford = coins >= item.cost
            const active = confirming?.id === item.id

            return (
              <div
                key={item.id}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  owned    ? 'border-green-100 bg-green-50/50' :
                  !unlocked ? 'border-gray-100 bg-gray-50/50 opacity-60' :
                  active   ? 'border-violet-400 bg-violet-50' :
                  'border-pink-100 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{item.description}</p>

                    {/* Prérequis */}
                    {!unlocked && item.requiresItemId && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Lock size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-400">
                          Nécessite : {SHOP_ITEMS.find(i => i.id === item.requiresItemId)?.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prix + bouton */}
                  <div className="shrink-0 text-right">
                    {owned ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="text-xs font-medium">Possédé</span>
                      </div>
                    ) : !unlocked ? (
                      <Lock size={16} className="text-gray-400 mx-auto" />
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className={`flex items-center gap-1 ${canAfford ? 'text-amber-600' : 'text-red-400'}`}>
                          <Coins size={13} />
                          <span className="text-sm font-bold">{item.cost.toLocaleString()}</span>
                        </div>
                        {active ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirming(null)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleBuy(item)}
                              disabled={purchasing || !canAfford}
                              className="text-xs px-2.5 py-1 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {purchasing ? '…' : 'Confirmer'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={!canAfford || purchasing}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                              canAfford
                                ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:shadow-md hover:shadow-pink-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingCart size={12} />
                            Acheter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmation inline */}
                {active && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-1.5"
                  >
                    Confirmer l'achat de <strong>{item.label}</strong> pour <strong>{item.cost.toLocaleString()} pièces</strong> ?
                  </motion.p>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
