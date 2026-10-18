/** L'heure et la date au Québec, quel que soit le fuseau du serveur. */
export function maintenantQuebec(): { jour: string; heure: number; jourIso: number; mois: number; annee: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  const jourIso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour), jourIso, mois: Number(p.month), annee: Number(p.year) }
}
