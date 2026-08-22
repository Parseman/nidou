import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { todayISODate } from './dates'

export function useStreak(user: User): number | null {
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    async function update() {
      const today = todayISODate()

      const { data } = await supabase
        .from('user_streaks')
        .select('streak, last_login_date')
        .eq('user_id', user.id)
        .maybeSingle()

      let newStreak: number

      if (!data) {
        newStreak = 1
      } else {
        const lastDate = new Date(data.last_login_date + 'T00:00:00')
        const todayDate = new Date(today + 'T00:00:00')
        const diffDays = Math.round(
          (todayDate.getTime() - lastDate.getTime()) / 86_400_000
        )

        if (diffDays === 0) {
          // Déjà connecté aujourd'hui — on ne touche pas à la base
          setStreak(data.streak)
          return
        } else if (diffDays === 1) {
          newStreak = data.streak + 1
        } else {
          // Jour(s) sauté(s) — streak cassé
          newStreak = 1
        }
      }

      await supabase.from('user_streaks').upsert({
        user_id: user.id,
        streak: newStreak,
        last_login_date: today,
      })

      setStreak(newStreak)
    }

    update()
  }, [user.id])

  return streak
}
