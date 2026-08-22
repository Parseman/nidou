// Types, constantes d'affichage et résolution de combat pour le mini-jeu
// "Battle" (BattleGame.tsx + useBattleGame.ts). Séparé du composant pour
// pouvoir être testé/réutilisé indépendamment du rendu React.

export type ItemType = 'sword' | 'enhanced_sword' | 'heart' | 'shield' | 'enhanced_shield'
export type BaseItem = 'sword' | 'heart' | 'shield'
export type ShieldType = 'normal' | 'enhanced' | null

export interface BattleStateRow {
  user_id: string
  hp: number
  xp: number
  shield_type: ShieldType
  shield_charges: number
  updated_at: string
}

export interface InventoryItem {
  id: string
  user_id: string
  item_type: ItemType
  created_at: string
}

export interface SpawnRow {
  id: number
  item_type: BaseItem
  spawned_at: string
  claimed_by: string | null
  claimed_at: string | null
  next_spawn_at: string
}

export const ITEM_EMOJI: Record<ItemType, string> = {
  sword: '⚔️', enhanced_sword: '🗡️', heart: '💛', shield: '🛡️', enhanced_shield: '🛡️✨',
}
export const ITEM_LABEL: Record<ItemType, string> = {
  sword: 'Épée', enhanced_sword: 'Épée ×3 (Améliorée)', heart: 'Cœur', shield: 'Bouclier', enhanced_shield: 'Bouclier ×3 (Amélioré)',
}
export const ITEM_DESC: Record<BaseItem, string> = {
  sword: 'Attaque pour -1 PV',
  heart: 'Récupère +1 PV',
  shield: 'Bloque 1 attaque',
}

/** Résout une attaque à l'épée contre un défenseur (avec ou sans bouclier). */
export function resolveAttack(
  swordType: 'sword' | 'enhanced_sword',
  shieldType: ShieldType,
  shieldCharges: number,
) {
  const enh = swordType === 'enhanced_sword'

  if (!shieldType) {
    return {
      damageToDefender: enh ? 5 : 1,
      damageToAttacker: 0,
      defenderXp: 0,
      newShieldType: null as ShieldType,
      newShieldCharges: 0,
      message: enh ? '💥 Coup puissant ! -5 PV !' : '⚔️ Touché ! -1 PV !',
    }
  }

  if (shieldType === 'normal') {
    if (enh) {
      return {
        damageToDefender: 4,
        damageToAttacker: 0,
        defenderXp: 0,
        newShieldType: null as ShieldType,
        newShieldCharges: 0,
        message: '💥 Épée puissante brise le bouclier ! -4 PV !',
      }
    }
    return {
      damageToDefender: 0,
      damageToAttacker: 0,
      defenderXp: 10,
      newShieldType: null as ShieldType,
      newShieldCharges: 0,
      message: '🛡️ Attaque bloquée ! Bouclier détruit.',
    }
  }

  // Enhanced shield
  if (enh) {
    return {
      damageToDefender: 0,
      damageToAttacker: 0,
      defenderXp: 10,
      newShieldType: null as ShieldType,
      newShieldCharges: 0,
      message: '⚡ Choc épique ! Épée et bouclier s\'annulent !',
    }
  }
  const newCharges = shieldCharges - 1
  return {
    damageToDefender: 0,
    damageToAttacker: 1,
    defenderXp: 10,
    newShieldType: (newCharges > 0 ? 'enhanced' : null) as ShieldType,
    newShieldCharges: newCharges,
    message: `🛡️✨ Riposte du bouclier amélioré ! -1 PV en retour ! (${newCharges} charge${newCharges !== 1 ? 's' : ''})`,
  }
}
