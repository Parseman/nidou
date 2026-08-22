import { useState, useEffect, useCallback, useId } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { awardCoins } from './wallet'
import { callNotifyFunction } from './notifyEdge'
import {
  resolveAttack,
  type BattleStateRow,
  type InventoryItem,
  type SpawnRow,
} from './battleGame'

const SWORD_ATTACK_REWARD = 10

async function sendNotif(type: string, payload: Record<string, unknown>) {
  await callNotifyFunction('notify-battle', { type, ...payload })
}

/**
 * Encapsule l'état et toute la logique métier du mini-jeu Battle : chargement
 * des états/inventaire/spawn, temps réel, et les actions (attaquer, se
 * soigner, activer un bouclier, forger). Le composant BattleGame ne garde que
 * le rendu et son propre état d'affichage (panneaux ouverts/fermés).
 */
export function useBattleGame(user: User) {
  const [myState, setMyState] = useState<BattleStateRow | null>(null)
  const [partnerState, setPartnerState] = useState<BattleStateRow | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [spawn, setSpawn] = useState<SpawnRow | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [acting, setActing] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const instanceId = useId()

  const myLevel = Math.floor((myState?.xp ?? 0) / 100) + 1
  const partnerLevel = Math.floor((partnerState?.xp ?? 0) / 100) + 1
  const myHp = myState?.hp ?? 10

  const swordCount = inventory.filter(i => i.item_type === 'sword').length
  const shieldCount = inventory.filter(i => i.item_type === 'shield').length
  const canForge = swordCount >= 3 || shieldCount >= 3

  const loadStates = useCallback(async () => {
    const { data } = await supabase.from('battle_state').select('*')
    if (!data) return
    setMyState(data.find(r => r.user_id === user.id) as BattleStateRow ?? null)
    setPartnerState(data.find(r => r.user_id !== user.id) as BattleStateRow ?? null)
  }, [user.id])

  const loadInventory = useCallback(async () => {
    const { data } = await supabase.from('battle_inventory').select('*').eq('user_id', user.id).order('created_at')
    if (data) setInventory(data as InventoryItem[])
  }, [user.id])

  const loadSpawn = useCallback(async () => {
    const { data } = await supabase.from('battle_spawn').select('*').eq('id', 1).single()
    if (!data) return
    const s = data as SpawnRow
    setSpawn(s)
    if (!s.claimed_by) setShowItemModal(true)
  }, [])

  useEffect(() => {
    // Init my row if not exists
    supabase.from('battle_state').upsert(
      { user_id: user.id, hp: 10, xp: 0, shield_type: null, shield_charges: 0, updated_at: new Date().toISOString() },
      { onConflict: 'user_id', ignoreDuplicates: true }
    ).then(() => {
      loadStates()
      loadInventory()
      loadSpawn()
    })

    const ch1 = supabase
      .channel(`battle-state-rt-${instanceId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_state' }, () => loadStates())
      .subscribe()

    const ch2 = supabase
      .channel(`battle-spawn-rt-${instanceId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_spawn' }, (p) => {
        const s = p.new as SpawnRow
        setSpawn(s)
        if (!s.claimed_by) setShowItemModal(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [user.id, loadStates, loadInventory, loadSpawn, instanceId])

  function flash(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3500)
  }

  async function claimItem() {
    if (!spawn || spawn.claimed_by || claiming) return
    setClaiming(true)
    try {
      const { error } = await supabase.from('battle_spawn')
        .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
        .eq('id', 1)
        .is('claimed_by', null)
      if (error) { setShowItemModal(false); return }
      await supabase.from('battle_inventory').insert({ user_id: user.id, item_type: spawn.item_type })
      await loadInventory()
      setShowItemModal(false)
      await sendNotif('item_claimed', {
        actor_name: user.user_metadata?.first_name ?? 'Ton partenaire',
        item_type: spawn.item_type,
      })
    } finally {
      setClaiming(false)
    }
  }

  async function handleUseSword(sword: InventoryItem) {
    if (!myState || acting) return
    setActing(true)
    try {
      // Récupère l'adversaire (peut ne pas avoir de ligne encore)
      const { data: states } = await supabase.from('battle_state').select('*')
      const partner = (states ?? []).find(r => r.user_id !== user.id) as BattleStateRow | undefined
      const effective = partner ?? { user_id: '', hp: 10, xp: 0, shield_type: null, shield_charges: 0, updated_at: '' }

      // Si pas encore de ligne partenaire, on ne peut pas attaquer
      if (!partner) { flash('⏳ Ton partenaire n\'a pas encore rejoint le jeu !'); return }

      const sType = sword.item_type as 'sword' | 'enhanced_sword'
      const res = resolveAttack(sType, effective.shield_type, effective.shield_charges)
      // utilise effective au lieu de partnerState dans la suite
      const targetState = effective

      await supabase.from('battle_inventory').delete().eq('id', sword.id)
      await supabase.from('battle_state').update({
        hp: Math.max(0, targetState.hp - res.damageToDefender),
        shield_type: res.newShieldType,
        shield_charges: res.newShieldCharges,
        xp: targetState.xp + res.defenderXp,
        updated_at: new Date().toISOString(),
      }).eq('user_id', targetState.user_id)
      await supabase.from('battle_state').update({
        xp: myState.xp + 20,
        hp: Math.max(0, myState.hp - res.damageToAttacker),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      awardCoins(user.id, SWORD_ATTACK_REWARD)

      flash(res.message)
      await sendNotif('battle_action', {
        actor_name: user.user_metadata?.first_name ?? 'Ton partenaire',
        action: 'attack',
        damage: res.damageToDefender,
        target_id: targetState.user_id,
      })
    } finally {
      setActing(false)
      await loadInventory()
      await loadStates()
    }
  }

  async function handleUseHeart(heart: InventoryItem) {
    if (!myState || acting || myState.hp >= 10) return
    setActing(true)
    try {
      await supabase.from('battle_inventory').delete().eq('id', heart.id)
      await supabase.from('battle_state').update({
        hp: Math.min(10, myState.hp + 1),
        xp: myState.xp + 5,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
      flash('💛 +1 PV récupéré !')
      await sendNotif('battle_action', {
        actor_name: user.user_metadata?.first_name ?? 'Ton partenaire',
        action: 'heal',
        target_id: partnerState?.user_id ?? null,
      })
    } finally {
      setActing(false)
      await loadInventory()
      await loadStates()
    }
  }

  async function handleActivateShield(shield: InventoryItem) {
    if (!myState || acting || myState.shield_type) return
    setActing(true)
    try {
      const isEnhanced = shield.item_type === 'enhanced_shield'
      await supabase.from('battle_inventory').delete().eq('id', shield.id)
      await supabase.from('battle_state').update({
        shield_type: isEnhanced ? 'enhanced' : 'normal',
        shield_charges: isEnhanced ? 3 : 1,
        xp: myState.xp + 10,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
      flash(isEnhanced ? '🛡️✨ Bouclier amélioré activé (3 charges) !' : '🛡️ Bouclier activé !')
      await sendNotif('battle_action', {
        actor_name: user.user_metadata?.first_name ?? 'Ton partenaire',
        action: 'shield',
        target_id: partnerState?.user_id ?? null,
      })
    } finally {
      setActing(false)
      await loadInventory()
      await loadStates()
    }
  }

  /** Retourne true si la forge a bien eu lieu (le composant peut alors basculer ses panneaux). */
  async function handleForge(base: 'sword' | 'shield'): Promise<boolean> {
    if (acting) return false
    const items = inventory.filter(i => i.item_type === base).slice(0, 3)
    if (items.length < 3) return false
    setActing(true)
    try {
      for (const item of items) {
        await supabase.from('battle_inventory').delete().eq('id', item.id)
      }
      const enhanced = base === 'sword' ? 'enhanced_sword' : 'enhanced_shield'
      await supabase.from('battle_inventory').insert({ user_id: user.id, item_type: enhanced })
      flash(base === 'sword' ? '🔥 Épée ×3 forgée à l\'enclume !' : '⚡ Bouclier ×3 forgé !')
      return true
    } finally {
      setActing(false)
      await loadInventory()
    }
  }

  return {
    myState, partnerState, inventory, spawn,
    showItemModal, setShowItemModal,
    claiming, acting, actionMsg,
    myLevel, partnerLevel, myHp,
    swordCount, shieldCount, canForge,
    claimItem, handleUseSword, handleUseHeart, handleActivateShield, handleForge,
  }
}
