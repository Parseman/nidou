import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type TripRow = {
  user_id: string
  user_name: string | null
  departure_date: string
  arrival_date: string
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayStr(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function progressPct(departure: string, arrival: string): number {
  const dep = parseDate(departure).getTime()
  const arr = parseDate(arrival).getTime()
  const t = parseDate(todayStr()).getTime()
  const total = arr - dep
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((t - dep) / total) * 100))
}

function initialOf(name: string | null | undefined): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase()
}

export function TripProgress({ user }: { user: User }) {
  const [rows, setRows] = useState<TripRow[]>([])

  useEffect(() => {
    supabase
      .from('user_trips')
      .select('user_id, user_name, departure_date, arrival_date')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          console.error('user_trips fetch:', fetchError)
          return
        }
        setRows(data ?? [])
      })

    const channel = supabase
      .channel(`user-trips-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_trips' },
        (payload) => {
          const newRow = payload.new as TripRow | null
          const oldRow = payload.old as TripRow | null
          const uid = newRow?.user_id ?? oldRow?.user_id
          setRows((prev) => {
            const filtered = prev.filter((r) => r.user_id !== uid)
            return payload.eventType === 'DELETE' || !newRow ? filtered : [...filtered, newRow]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  const mine = rows.find((r) => r.user_id === user.id)
  const partner = rows.find((r) => r.user_id !== user.id)

  const myPct = mine ? progressPct(mine.departure_date, mine.arrival_date) : null
  const partnerPct = partner ? progressPct(partner.departure_date, partner.arrival_date) : null

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 mx-3">
      <div className="relative flex-1 min-w-[40px] h-5">
        <div className="absolute left-[9px] right-[9px] top-1/2 -translate-y-1/2 h-1.5 bg-pink-100 dark:bg-pink-900/40 rounded-full" />
        <div className="absolute left-[9px] right-[9px] top-0 bottom-0">
          {partnerPct !== null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              style={{ left: `${partnerPct}%` }}
              title={`${partner?.user_name ?? 'Partenaire'} : ${Math.round(partnerPct)}%`}
            >
              {initialOf(partner?.user_name)}
            </div>
          )}
          {myPct !== null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              style={{ left: `${myPct}%` }}
              title={`Toi : ${Math.round(myPct)}%`}
            >
              {initialOf(user.user_metadata?.first_name)}
            </div>
          )}
        </div>
      </div>

      {myPct !== null && (
        <span className="text-xs font-bold text-pink-500 dark:text-pink-300 tabular-nums shrink-0">
          {Math.round(myPct)}%
        </span>
      )}
    </div>
  )
}
