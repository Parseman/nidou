/**
 * Parse une date au format 'YYYY-MM-DD' en objet Date local (minuit, sans
 * décalage de fuseau horaire — contrairement à `new Date('YYYY-MM-DD')` qui
 * interprète la chaîne en UTC).
 */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Aujourd'hui à minuit (heure locale), pour comparer des dates sans l'heure. */
export function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Date du jour au format 'YYYY-MM-DD' (heure locale). */
export function todayISODate(): string {
  return new Date().toLocaleDateString('sv-SE')
}

/** Ex: "15 janv." */
export function formatDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Ex: "15 janvier 2026" */
export function formatDateLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Ex: "jeudi 15 janvier 2026" */
export function formatDateWeekdayLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Ex: "15 janvier, 14:30" */
export function formatDateTimeLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

/** Heure seule, ex: "14:30" */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Variantes prenant directement une chaîne ISO (timestamptz complet) ──────
// À utiliser quand la source est un `created_at`/`completed_at` etc. (pas un
// simple 'YYYY-MM-DD' texte, qui doit passer par parseDate() pour éviter le
// décalage de fuseau horaire).

export function fmtDateShort(iso: string): string {
  return formatDateShort(new Date(iso))
}

export function fmtDateLong(iso: string): string {
  return formatDateLong(new Date(iso))
}

export function fmtDateTimeLong(iso: string): string {
  return formatDateTimeLong(new Date(iso))
}

/**
 * Affichage relatif pour les messages : heure si aujourd'hui, "Hier" si hier,
 * sinon date courte ("15 janv.").
 */
export function fmtRelativeOrShort(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return formatTime(d)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'

  return formatDateShort(d)
}
