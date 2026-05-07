import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Même logique de dégradation que le client ────────────────────────────────

const DECAY_PER_HOUR = { hunger: 3, hygiene: 2, happiness: 1.5 }
const ALERT_THRESHOLD = 30   // stat en dessous de laquelle on notifie
const NOTIF_COOLDOWN_H = 4   // heures minimum entre deux notifications

type PetRow = {
  hunger:          number
  hygiene:         number
  happiness:       number
  last_fed_at:     string
  last_washed_at:  string
  last_pet_at:     string
  last_notified_at: string | null
}

function calcStats(row: PetRow) {
  const now = Date.now()
  const hrs = (ts: string) => (now - new Date(ts).getTime()) / 3_600_000
  return {
    hunger:    Math.max(0, Math.min(100, row.hunger    - DECAY_PER_HOUR.hunger    * hrs(row.last_fed_at))),
    hygiene:   Math.max(0, Math.min(100, row.hygiene   - DECAY_PER_HOUR.hygiene   * hrs(row.last_washed_at))),
    happiness: Math.max(0, Math.min(100, row.happiness - DECAY_PER_HOUR.happiness * hrs(row.last_pet_at))),
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')!

  // Lecture du pet
  const { data: row, error } = await supabase
    .from('pet')
    .select('hunger, hygiene, happiness, last_fed_at, last_washed_at, last_pet_at, last_notified_at')
    .eq('id', 1)
    .single()

  if (error || !row) {
    return new Response('Pet introuvable', { status: 404 })
  }

  const pet    = row as PetRow
  const stats  = calcStats(pet)
  const overall = (stats.hunger + stats.hygiene + stats.happiness) / 3

  // Anti-spam : pas de notif si on a déjà notifié il y a moins de NOTIF_COOLDOWN_H heures
  if (pet.last_notified_at) {
    const hoursSinceNotif = (Date.now() - new Date(pet.last_notified_at).getTime()) / 3_600_000
    if (hoursSinceNotif < NOTIF_COOLDOWN_H) {
      return new Response(`Notif en cooldown (${hoursSinceNotif.toFixed(1)}h)`, { status: 200 })
    }
  }

  // Construction des alertes
  const alerts: { name: string; value: string; inline: boolean }[] = []
  if (stats.hunger    < ALERT_THRESHOLD) alerts.push({ name: '🍣 Faim',    value: `${Math.round(stats.hunger)}/100`,    inline: true })
  if (stats.hygiene   < ALERT_THRESHOLD) alerts.push({ name: '🛁 Hygiène', value: `${Math.round(stats.hygiene)}/100`,   inline: true })
  if (stats.happiness < ALERT_THRESHOLD) alerts.push({ name: '🫶 Bonheur', value: `${Math.round(stats.happiness)}/100`, inline: true })

  if (alerts.length === 0) {
    return new Response('Nidou va bien 😸', { status: 200 })
  }

  // Couleur selon la gravité
  const isCritical = overall < 15
  const color      = isCritical ? 0xef4444 : 0xf97316
  const title      = isCritical ? '😿 Nidou est en détresse !' : '😾 Nidou a besoin de vous !'

  // Envoi du webhook Discord
  const discordRes = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title,
        description: '**Vite, venez prendre soin de lui sur Nidou !**',
        color,
        fields: alerts,
        footer: { text: `Bien-être global : ${Math.round(overall)}/100` },
        timestamp: new Date().toISOString(),
      }],
    }),
  })

  if (!discordRes.ok) {
    return new Response('Erreur Discord', { status: 500 })
  }

  // Enregistrement du timestamp de notification pour l'anti-spam
  await supabase
    .from('pet')
    .update({ last_notified_at: new Date().toISOString() })
    .eq('id', 1)

  return new Response('Notification envoyée ✅', { status: 200 })
})
