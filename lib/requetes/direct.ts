import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type EtatDirect = {
  taps_60s: number
  taps_5min: number
  taps_15min: number
  p50_ms: number | null
  p95_ms: number | null
  max_ms: number | null
  dernier_tap: string | null
  par_minute: { minute: string; taps: number }[]
}

/**
 * Ce qui se passe maintenant : taps de la dernière minute, des cinq et des
 * quinze dernières, temps de redirection (médiane, 95e centile, pire), et
 * taps minute par minute sur l'heure écoulée — minutes vides comprises.
 */
export async function etatDirect(): Promise<EtatDirect> {
  const [chiffres, parMinute] = await Promise.all([
    requeteUne<Omit<EtatDirect, 'par_minute'>>(
      `select count(*) filter (where tape_le >= now() - interval '60 seconds')::int as taps_60s,
              count(*) filter (where tape_le >= now() - interval '5 minutes')::int  as taps_5min,
              count(*)::int                                                         as taps_15min,
              round(percentile_cont(0.5)  within group (order by duree_ms))::int    as p50_ms,
              round(percentile_cont(0.95) within group (order by duree_ms))::int    as p95_ms,
              max(duree_ms)                                                         as max_ms,
              (select max(tape_le) from taps)                                       as dernier_tap
         from taps where tape_le >= now() - interval '15 minutes'`,
    ),
    requete<{ minute: string; taps: number }>(
      `with cal as (
         select generate_series(date_trunc('minute', now()) - interval '59 minutes',
                                date_trunc('minute', now()), interval '1 minute') as minute
       )
       select to_char(cal.minute at time zone 'America/Toronto', 'HH24:MI') as minute,
              count(t.id)::int as taps
         from cal left join taps t
           on t.tape_le >= cal.minute and t.tape_le < cal.minute + interval '1 minute'
        group by cal.minute order by cal.minute`,
    ),
  ])
  return {
    taps_60s: chiffres?.taps_60s ?? 0,
    taps_5min: chiffres?.taps_5min ?? 0,
    taps_15min: chiffres?.taps_15min ?? 0,
    p50_ms: chiffres?.p50_ms ?? null,
    p95_ms: chiffres?.p95_ms ?? null,
    max_ms: chiffres?.max_ms ?? null,
    dernier_tap: chiffres?.dernier_tap ?? null,
    par_minute: parMinute,
  }
}
