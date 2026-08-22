import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingBag, Check, Camera, Clock } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { awardCoins } from '../../lib/wallet'
import { MARKET_ITEMS, TIER_LABEL, type MarketItem, type MarketTier } from '../../lib/marketItems'
import { callNotifyFunction } from '../../lib/notifyEdge'
import { getFileExtension, uploadAndGetPublicUrl } from '../../lib/storage'
import { fmtDateTimeLong } from '../../lib/dates'

type PurchaseRow = {
  id: string
  item_id: string
  item_label: string
  price: number
  buyer_id: string
  buyer_name: string | null
  status: 'pending' | 'done'
  proof_url: string | null
  completed_at: string | null
  created_at: string
}

const TIERS: MarketTier[] = ['frequent', 'occasional', 'rare']

async function notifyMarket(type: 'item_purchased' | 'item_fulfilled', excludeUserId: string, actorName: string | null, itemLabel: string) {
  await callNotifyFunction('notify-market', { type, exclude_user_id: excludeUserId, actor_name: actorName, item_label: itemLabel })
}

export function Marche({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const instanceId = useId()

  const myName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? null

  const loadPurchases = useCallback(async () => {
    const { data } = await supabase
      .from('market_purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setPurchases((data ?? []) as PurchaseRow[])
  }, [])

  const loadBalance = useCallback(async () => {
    const { data } = await supabase.from('user_wallet').select('coins').eq('user_id', user.id).maybeSingle()
    setBalance(data?.coins ?? 0)
  }, [user.id])

  useEffect(() => {
    loadPurchases()
    loadBalance()
    const channel = supabase
      .channel(`market-rt-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_purchases' }, loadPurchases)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_wallet' }, (payload) => {
        const row = payload.new as Record<string, unknown>
        if (row?.user_id === user.id && typeof row.coins === 'number') setBalance(row.coins)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadPurchases, loadBalance, instanceId, user.id])

  const pendingForMe = purchases.filter((p) => p.status === 'pending' && p.buyer_id !== user.id)
  const pendingMine = purchases.filter((p) => p.status === 'pending' && p.buyer_id === user.id)
  const history = purchases.filter((p) => p.status === 'done')
  const needsAction = pendingForMe.length > 0

  async function buy(item: MarketItem) {
    if (buyingId || balance === null || balance < item.price) return
    setBuyingId(item.id)
    await supabase.from('market_purchases').insert({
      item_id: item.id,
      item_label: item.label,
      price: item.price,
      buyer_id: user.id,
      buyer_name: myName,
    })
    awardCoins(user.id, -item.price)
    notifyMarket('item_purchased', user.id, myName, item.label)
    setBuyingId(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, purchaseId: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setSelectedFile(file)
    setUploadPreview(URL.createObjectURL(file))
    setUploadFor(purchaseId)
    e.target.value = ''
  }

  function cancelUpload() {
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
    setSelectedFile(null)
    setUploadFor(null)
  }

  async function markDone(purchase: PurchaseRow) {
    if (fulfillingId) return
    setFulfillingId(purchase.id)
    let proofUrl: string | null = null
    if (selectedFile && uploadFor === purchase.id) {
      const ext = getFileExtension(selectedFile)
      const path = `${purchase.id}/${Date.now()}.${ext}`
      const { publicUrl, error } = await uploadAndGetPublicUrl('market', path, selectedFile)
      if (!error) {
        proofUrl = publicUrl
      }
    }
    await supabase.from('market_purchases').update({
      status: 'done',
      completed_at: new Date().toISOString(),
      ...(proofUrl ? { proof_url: proofUrl } : {}),
    }).eq('id', purchase.id)
    notifyMarket('item_fulfilled', user.id, myName, purchase.item_label)
    cancelUpload()
    setFulfillingId(null)
  }

  return (
    <>
      {/* ── Icône ── */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full rounded-3xl overflow-hidden cursor-pointer shadow-xl shadow-amber-200/40 dark:shadow-amber-900/20 focus:outline-none group"
        style={{ aspectRatio: '1 / 1' }}
        aria-label="Marché"
      >
        <img
          src="/marche-cover.png"
          alt="Marché"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <p className="text-white font-bold text-xs" style={{ fontFamily: '"Varela Round", sans-serif' }}>
            Marché
          </p>
        </div>
        {needsAction && (
          <div className="absolute top-1.5 right-1.5 z-20 min-w-[20px] h-5 px-1 flex items-center justify-center bg-red-500 rounded-full text-white text-[11px] font-bold leading-none shadow-md animate-pulse">
            {pendingForMe.length > 9 ? '9+' : pendingForMe.length}
          </div>
        )}
      </motion.button>

      {/* ── Modale ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-pink-950/20 backdrop-blur-sm" onClick={() => setOpen(false)} />

            <motion.div
              className="relative z-10 w-full max-w-lg flex flex-col rounded-3xl overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-2xl shadow-amber-200/40"
              style={{ height: '85vh' }}
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛍️</span>
                  <h2 className="font-bold text-pink-700 dark:text-pink-200" style={{ fontFamily: '"Varela Round", sans-serif' }}>
                    Marché
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 dark:text-amber-300 font-bold text-sm tabular-nums">
                    {balance === null ? '…' : `${balance.toLocaleString('fr-FR')} 🪙`}
                  </span>
                  <button onClick={() => setOpen(false)} className="text-pink-300 hover:text-pink-500 dark:text-pink-300 dark:hover:text-pink-100 transition-colors cursor-pointer p-1" aria-label="Fermer">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Demandes reçues ── */}
                {pendingForMe.length > 0 && (
                  <div className="px-5 py-5 border-b border-pink-50 dark:border-white/10">
                    <p className="flex items-center gap-2 text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wide mb-3">
                      🎯 Demandes reçues
                      <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 rounded-full text-white text-[10px] font-bold leading-none normal-case">
                        {pendingForMe.length}
                      </span>
                    </p>
                    <div className="space-y-3">
                      {pendingForMe.map((p) => (
                        <div key={p.id} className="rounded-2xl p-4 bg-gradient-to-br from-amber-50 to-pink-50 dark:from-amber-950/40 dark:to-pink-950/40">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-bold text-pink-800 dark:text-pink-100 text-sm">{p.item_label}</p>
                            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                              {p.price} 🪙
                            </span>
                          </div>
                          <p className="text-pink-400 dark:text-pink-300 text-xs mb-3">
                            Acheté par {p.buyer_name ?? 'ton partenaire'}
                          </p>

                          {uploadFor === p.id && uploadPreview ? (
                            <div className="space-y-2">
                              <img src={uploadPreview} alt="Aperçu" className="w-full h-36 object-cover rounded-2xl" />
                              <div className="flex gap-2">
                                <button onClick={() => markDone(p)} disabled={fulfillingId === p.id} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
                                  <Check size={14} />
                                  {fulfillingId === p.id ? 'Envoi…' : 'Envoyer et valider'}
                                </button>
                                <button onClick={cancelUpload} className="text-sm text-pink-400 hover:text-pink-600 transition-colors cursor-pointer px-3">
                                  Changer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => markDone(p)}
                                disabled={fulfillingId === p.id}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2.5 px-4 rounded-2xl transition-colors cursor-pointer disabled:opacity-60"
                              >
                                <Check size={14} /> Marquer comme fait
                              </button>
                              <button
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center justify-center gap-1.5 border-2 border-dashed border-pink-200 dark:border-pink-800 text-pink-400 hover:border-pink-400 hover:text-pink-600 dark:text-pink-300 transition-colors cursor-pointer py-2.5 px-3 rounded-2xl"
                                aria-label="Ajouter une preuve photo"
                              >
                                <Camera size={16} />
                              </button>
                            </div>
                          )}
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, p.id)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Mes achats en attente ── */}
                {pendingMine.length > 0 && (
                  <div className="px-5 py-5 border-b border-pink-50 dark:border-white/10">
                    <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wide mb-3">
                      ⏳ Mes achats en attente
                    </p>
                    <div className="space-y-2">
                      {pendingMine.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-2xl px-4 py-3 bg-pink-50 dark:bg-white/5">
                          <p className="text-pink-700 dark:text-pink-100 text-sm font-medium">{p.item_label}</p>
                          <span className="flex items-center gap-1 text-pink-300 dark:text-pink-400 text-xs shrink-0">
                            <Clock size={12} /> En attente
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Catalogue ── */}
                <div className="px-5 py-5 border-b border-pink-50 dark:border-white/10">
                  <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wide mb-3">
                    Catalogue
                  </p>
                  <div className="space-y-5">
                    {TIERS.map((tier) => (
                      <div key={tier}>
                        <p className="text-xs font-semibold text-pink-300 dark:text-pink-400 mb-2">{TIER_LABEL[tier]}</p>
                        <div className="space-y-2">
                          {MARKET_ITEMS.filter((item) => item.tier === tier).map((item) => {
                            const canAfford = balance !== null && balance >= item.price
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 bg-white/70 dark:bg-white/5">
                                <p className="text-pink-700 dark:text-pink-100 text-sm flex-1">{item.label}</p>
                                <button
                                  onClick={() => buy(item)}
                                  disabled={!canAfford || buyingId === item.id}
                                  className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                                    canAfford
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                      : 'bg-pink-50 dark:bg-white/10 text-pink-300 dark:text-pink-500'
                                  }`}
                                >
                                  <ShoppingBag size={12} />
                                  {item.price} 🪙
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Historique ── */}
                {history.length > 0 && (
                  <div className="px-5 py-5">
                    <p className="text-xs font-semibold text-pink-400 dark:text-pink-300 uppercase tracking-wide mb-4">
                      Historique ({history.length})
                    </p>
                    <div className="space-y-3">
                      {history.map((p) => (
                        <div key={p.id} className="flex gap-3 items-start">
                          {p.proof_url ? (
                            <button onClick={() => setLightbox(p.proof_url!)} className="shrink-0 focus:outline-none" aria-label="Voir la preuve">
                              <img src={p.proof_url} alt="Preuve" className="w-14 h-14 object-cover rounded-xl hover:opacity-80 transition-opacity cursor-zoom-in" />
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-pink-50 dark:bg-white/5 shrink-0 flex items-center justify-center">
                              <ShoppingBag size={18} className="text-pink-200 dark:text-pink-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="font-semibold text-pink-800 dark:text-pink-100 text-sm leading-snug">{p.item_label}</p>
                            <p className="text-pink-400 dark:text-pink-400 text-xs">
                              ✅ Acheté par {p.buyer_name ?? 'inconnu'}
                            </p>
                            {p.completed_at && <p className="text-pink-300 dark:text-pink-500 text-xs">{fmtDateTimeLong(p.completed_at)}</p>}
                          </div>
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

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 cursor-zoom-out" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)}>
            <motion.img src={lightbox} alt="Preuve" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
