export type ShopCategory = 'room' | 'object' | 'frame' | 'sticker'

export type ShopItem = {
  id: string
  category: ShopCategory
  label: string
  description: string
  emoji: string
  cost: number
  requiresItemId?: string  // doit posséder cet item avant d'acheter celui-ci
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── Agrandissement ─────────────────────────────────────────────────────────
  {
    id: 'room_size_1',
    category: 'room',
    label: 'Grande Chambre',
    description: 'Double la superficie — plus de place, plus de souvenirs',
    emoji: '🏠',
    cost: 20000,
  },
  {
    id: 'room_size_2',
    category: 'room',
    label: 'Suite Royale',
    description: 'Encore ×1.5 plus grande. La chambre de vos rêves.',
    emoji: '🏰',
    cost: 35000,
    requiresItemId: 'room_size_1',
  },
  // ── Mobilier ───────────────────────────────────────────────────────────────
  {
    id: 'object_desk',
    category: 'object',
    label: 'Bureau',
    description: 'Un bureau cosy pour les sessions en duo',
    emoji: '🖥️',
    cost: 4500,
  },
  {
    id: 'object_bookshelf',
    category: 'object',
    label: 'Bibliothèque',
    description: 'Des étagères remplies de vos livres préférés',
    emoji: '📚',
    cost: 6000,
  },
  {
    id: 'object_rug',
    category: 'object',
    label: 'Tapis',
    description: 'Un tapis douillet pour réchauffer la pièce',
    emoji: '🟣',
    cost: 2500,
  },
  {
    id: 'object_lamp',
    category: 'object',
    label: 'Lampe',
    description: 'Une lumière tamisée pour les soirées romantiques',
    emoji: '💡',
    cost: 3500,
  },
  // ── Cadres photos ──────────────────────────────────────────────────────────
  {
    id: 'frame_3',
    category: 'frame',
    label: '3ème cadre photo',
    description: 'Un cadre supplémentaire pour vos plus beaux souvenirs',
    emoji: '🖼️',
    cost: 9000,
  },
  {
    id: 'frame_4',
    category: 'frame',
    label: '4ème cadre photo',
    description: 'Encore un ! Pour ne jamais manquer de place',
    emoji: '🖼️',
    cost: 14000,
    requiresItemId: 'frame_3',
  },
  // ── Stickers perso ─────────────────────────────────────────────────────────
  {
    id: 'sticker_slot_1',
    category: 'sticker',
    label: 'Sticker Perso ①',
    description: 'Dessine ton propre sticker et accroche-le au mur',
    emoji: '🎨',
    cost: 5000,
  },
  {
    id: 'sticker_slot_2',
    category: 'sticker',
    label: 'Sticker Perso ②',
    description: 'Un deuxième emplacement pour un autre sticker dessiné',
    emoji: '🎨',
    cost: 8000,
    requiresItemId: 'sticker_slot_1',
  },
]

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  room:    '🏠 Chambre',
  object:  '🛋️ Mobilier',
  frame:   '🖼️ Cadres',
  sticker: '🎨 Stickers',
}
