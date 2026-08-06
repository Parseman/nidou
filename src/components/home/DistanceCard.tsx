import { useState, useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type LocationRow = {
  user_id: string
  lat: number
  lng: number
  updated_at: string
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${Math.round(km).toLocaleString('fr-FR')} km`
}

function fmtAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

type Status = 'loading' | 'ok' | 'no-partner' | 'denied' | 'unavailable'

export function DistanceCard({ user }: { user: User }) {
  const [distance, setDistance] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [myAge, setMyAge] = useState<string | null>(null)
  const [partnerAge, setPartnerAge] = useState<string | null>(null)

  // Stocke la dernière position connue pour pouvoir recalculer via Realtime
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAndCompute(pos: GeolocationPosition | null) {
      if (cancelled) return

      if (pos) {
        await supabase.from('user_locations').upsert({
          user_id: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date().toISOString(),
        })
      }

      if (cancelled) return

      const { data } = await supabase.from('user_locations').select('*')
      if (cancelled) return

      const rows = (data ?? []) as LocationRow[]
      const mine = rows.find((r) => r.user_id === user.id)
      const partner = rows.find((r) => r.user_id !== user.id)

      const myLat = pos?.coords.latitude ?? mine?.lat
      const myLng = pos?.coords.longitude ?? mine?.lng

      if (myLat == null || myLng == null) {
        setStatus('denied')
        return
      }

      myPosRef.current = { lat: myLat, lng: myLng }

      if (!partner) {
        setStatus('no-partner')
        setMyAge(pos ? "à l'instant" : mine ? fmtAge(mine.updated_at) : null)
        return
      }

      setDistance(haversineKm(myLat, myLng, partner.lat, partner.lng))
      setMyAge(pos ? "à l'instant" : mine ? fmtAge(mine.updated_at) : null)
      setPartnerAge(fmtAge(partner.updated_at))
      setStatus('ok')
    }

    // Abonnement Realtime : se déclenche dès que le partenaire sauvegarde sa position
    const channel = supabase
      .channel('user-locations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        (payload) => {
          const row = payload.new as LocationRow
          if (!row || row.user_id === user.id) return
          // Position du partenaire reçue
          const myPos = myPosRef.current
          if (!myPos) return
          setDistance(haversineKm(myPos.lat, myPos.lng, row.lat, row.lng))
          setPartnerAge(fmtAge(row.updated_at))
          setStatus('ok')
        }
      )
      .subscribe()

    if (!('geolocation' in navigator)) {
      fetchAndCompute(null)
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAndCompute(pos),
        () => fetchAndCompute(null),
        { timeout: 10_000, maximumAge: 60_000 },
      )
    }

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user.id])

  return (
    <div className="glass-card rounded-3xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-2 md:mb-4">
        <MapPin className="text-pink-400" size={18} strokeWidth={1.8} />
        <h2
          className="font-bold text-pink-700 dark:text-pink-200 text-sm"
          style={{ fontFamily: '"Varela Round", sans-serif' }}
        >
          Distance physique 🌍
        </h2>
      </div>

      {status === 'loading' && (
        <div className="py-2 md:py-5 text-center">
          <p className="text-pink-300 text-sm">Localisation…</p>
        </div>
      )}

      {status === 'ok' && distance !== null && (
        <div className="text-center">
          <p
            className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent tabular-nums"
            style={{ fontFamily: '"Varela Round", sans-serif' }}
          >
            {fmtDistance(distance)}
          </p>
          <p className="text-pink-400 dark:text-pink-300 text-xs mt-2 md:mt-4 leading-relaxed">
            {myAge && <>Toi : {myAge}</>}
            {myAge && partnerAge && <> · </>}
            {partnerAge && <>Partenaire : {partnerAge}</>}
          </p>
        </div>
      )}

      {status === 'no-partner' && (
        <div className="py-2 md:py-4 text-center">
          <p className="text-2xl mb-2">📍</p>
          <p className="text-pink-500 dark:text-pink-300 text-sm font-medium">En attente</p>
          <p className="text-pink-400 dark:text-pink-300 text-xs mt-1 leading-relaxed">
            Dès que ton partenaire ouvre l'app, la distance s'affiche automatiquement.
          </p>
          {myAge && (
            <p className="text-pink-300 text-xs mt-2">Ta position : {myAge}</p>
          )}
        </div>
      )}

      {status === 'denied' && (
        <div className="py-2 md:py-4 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-pink-500 dark:text-pink-300 text-sm font-medium">Localisation refusée</p>
          <p className="text-pink-400 dark:text-pink-300 text-xs mt-1 leading-relaxed">
            Autorise la localisation dans ton navigateur pour voir la distance.
          </p>
        </div>
      )}

      {status === 'unavailable' && (
        <div className="py-2 md:py-4 text-center">
          <p className="text-pink-400 text-sm">Distance indisponible.</p>
        </div>
      )}
    </div>
  )
}
