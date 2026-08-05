// Calendrier fixe du Photo Duel : chaque tour démarre le jeudi à minuit
// (heure de Paris) et se termine (deadline upload/vote) le mardi suivant
// à 23h59. Le thème suivant ne démarre jamais avant le jeudi 00h00 suivant
// (mercredi = jour mort, actions verrouillées).

const TZ = 'Europe/Paris'

function getOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return (asUTC - date.getTime()) / 60_000
}

function zonedTimeToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, timeZone: string): number {
  const initialGuess = Date.UTC(y, m - 1, d, h, mi, s)
  let utc = initialGuess - getOffsetMinutes(new Date(initialGuess), timeZone) * 60_000
  utc = initialGuess - getOffsetMinutes(new Date(utc), timeZone) * 60_000
  return utc
}

function parisDateParts(date: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

export type RoundBoundaries = {
  roundStart: number     // jeudi 00:00 Paris (ms epoch) du tour en cours
  deadline: number       // mardi 23:59:59 Paris (ms epoch) — dernier moment pour upload/vote
  nextRoundStart: number // jeudi 00:00 Paris (ms epoch) suivant — prochain thème
}

export function getRoundBoundaries(now: Date = new Date()): RoundBoundaries {
  const { year, month, day } = parisDateParts(now)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0=dim..4=jeu..6=sam
  const daysSinceThursday = (dow - 4 + 7) % 7
  const roundStartCal = new Date(Date.UTC(year, month - 1, day) - daysSinceThursday * 86_400_000)
  const rY = roundStartCal.getUTCFullYear()
  const rM = roundStartCal.getUTCMonth() + 1
  const rD = roundStartCal.getUTCDate()

  const roundStart = zonedTimeToUtc(rY, rM, rD, 0, 0, 0, TZ)

  const deadlineCal = new Date(Date.UTC(rY, rM - 1, rD) + 5 * 86_400_000)
  const deadline = zonedTimeToUtc(
    deadlineCal.getUTCFullYear(), deadlineCal.getUTCMonth() + 1, deadlineCal.getUTCDate(),
    23, 59, 59, TZ,
  )

  const nextCal = new Date(Date.UTC(rY, rM - 1, rD) + 7 * 86_400_000)
  const nextRoundStart = zonedTimeToUtc(
    nextCal.getUTCFullYear(), nextCal.getUTCMonth() + 1, nextCal.getUTCDate(),
    0, 0, 0, TZ,
  )

  return { roundStart, deadline, nextRoundStart }
}
