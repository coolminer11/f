import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Les statistiques d'un établissement, pour son portail et pour le
 * back-office : la période choisie, comparée à la période d'avant.
 */
export type StatsService = {
  jours: number
  ouvertures: number
  ouverturesPrec: number
  vuesMenu: number
  demandes: number
  demandesPrec: number
  parType: { cle: string; libelle: string; icone: string | null; n: number }[]
  reponseMediane: number | null
  reponseMoyenne: number | null
  pctRapides: number | null
  note: number | null
  nbRetours: number
  repartition: number[]
  googleClics: number
  wifi: number
  pdf: number
  topPlats: { id: string; nom: string; vues: number }[]
  topRubriques: { id: string; titre: string; vues: number }[]
  langues: { langue: string; n: number }[]
  parJour: { jour: string; ouvertures: number; demandes: number }[]
  parHeure: { heure: number; ouvertures: number; demandes: number }[]
  grille: { jour: number; heure: number; n: number }[]
  parEmplacement: { id: string; libelle: string; groupe: string | null; ouvertures: number; demandes: number; note: number | null }[]
  commentaires: { note: number; commentaire: string | null; emplacement: string | null; google: boolean; cree_le: string }[]
}

export async function statsService(etabId: string, jours: number, fuseau = 'America/Toronto', langueDefaut = 'fr'): Promise<StatsService> {
  const p = [etabId, jours, fuseau]
  const periode = `cree_le >= now() - make_interval(days => $2::int)`
  const avant = `cree_le >= now() - make_interval(days => 2 * $2::int) and cree_le < now() - make_interval(days => $2::int)`
  const [totaux, types, reponses, retours, plats, rubs, langues, parJour, parHeure, grille, lieux, commentaires] = await Promise.all([
    requeteUne<{ ouvertures: number; ouvertures_prec: number; menu: number; demandes: number; demandes_prec: number; google: number; wifi: number; pdf: number }>(
      `select (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'ouverture' and ${periode})::int as ouvertures,
              (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'ouverture' and ${avant})::int as ouvertures_prec,
              (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'menu' and ${periode})::int as menu,
              (select count(*) from demandes_service where etablissement_id = $1::uuid and statut <> 'annulee' and ${periode})::int as demandes,
              (select count(*) from demandes_service where etablissement_id = $1::uuid and statut <> 'annulee' and ${avant})::int as demandes_prec,
              (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'avis_google' and ${periode})::int as google,
              (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'wifi' and ${periode})::int as wifi,
              (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'pdf' and ${periode})::int as pdf`,
      p.slice(0, 2),
    ),
    requete<{ cle: string; libelle: string; icone: string | null; n: number }>(
      `select d.cle, max(d.libelle) as libelle, max(t.icone) as icone, count(*)::int as n
         from demandes_service d left join types_demandes t on t.id = d.type_id
        where d.etablissement_id = $1::uuid and d.statut <> 'annulee' and d.${periode}
        group by d.cle order by n desc`,
      p.slice(0, 2),
    ),
    requeteUne<{ mediane: number | null; moyenne: number | null; rapides: number | null }>(
      `select percentile_cont(0.5) within group (order by extract(epoch from prise_le - cree_le))::float8 as mediane,
              avg(extract(epoch from prise_le - cree_le))::float8 as moyenne,
              (100.0 * count(*) filter (where prise_le - cree_le <= interval '2 minutes') / nullif(count(*), 0))::float8 as rapides
         from demandes_service where etablissement_id = $1::uuid and prise_le is not null and ${periode}`,
      p.slice(0, 2),
    ),
    requeteUne<{ note: number | null; n: number; r: number[] }>(
      `select round(avg(note)::numeric, 2)::float8 as note, count(*)::int as n,
              array[count(*) filter (where note = 1), count(*) filter (where note = 2), count(*) filter (where note = 3),
                    count(*) filter (where note = 4), count(*) filter (where note = 5)]::int[] as r
         from retours_service where etablissement_id = $1::uuid and ${periode}`,
      p.slice(0, 2),
    ),
    requete<{ id: string; nom: string; vues: number }>(
      `select i.id, coalesce(i.nom ->> $3, i.nom ->> 'fr', '') as nom, count(*)::int as vues
         from evenements_service v join menu_items i on i.id::text = v.cible
              join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id and m.etablissement_id = $1::uuid
        where v.etablissement_id = $1::uuid and v.type = 'plat' and v.${periode}
        group by i.id order by vues desc limit 10`,
      [etabId, jours, langueDefaut],
    ),
    requete<{ id: string; titre: string; vues: number }>(
      `select r.id, coalesce(r.titre ->> $3, r.titre ->> 'fr', '') as titre, count(*)::int as vues
         from evenements_service v join rubriques_concierge r on r.id::text = v.cible and r.etablissement_id = $1::uuid
        where v.etablissement_id = $1::uuid and v.type = 'rubrique' and v.${periode}
        group by r.id order by vues desc limit 8`,
      [etabId, jours, langueDefaut],
    ),
    requete<{ langue: string; n: number }>(
      `select langue, count(*)::int as n from evenements_service
        where etablissement_id = $1::uuid and type = 'ouverture' and langue is not null and ${periode}
        group by langue order by n desc`,
      p.slice(0, 2),
    ),
    requete<{ jour: string; ouvertures: number; demandes: number }>(
      `with cal as (select generate_series((now() at time zone $3)::date - ($2::int - 1), (now() at time zone $3)::date, interval '1 day')::date as jour)
       select to_char(c.jour, 'YYYY-MM-DD') as jour,
              (select count(*) from evenements_service v where v.etablissement_id = $1::uuid and v.type = 'ouverture' and (v.cree_le at time zone $3)::date = c.jour)::int as ouvertures,
              (select count(*) from demandes_service d where d.etablissement_id = $1::uuid and d.statut <> 'annulee' and (d.cree_le at time zone $3)::date = c.jour)::int as demandes
         from cal c order by c.jour`,
      p,
    ),
    requete<{ heure: number; ouvertures: number; demandes: number }>(
      `with h as (select generate_series(0, 23) as heure)
       select h.heure,
              (select count(*) from evenements_service v where v.etablissement_id = $1::uuid and v.type = 'ouverture' and v.${periode}
                  and extract(hour from v.cree_le at time zone $3) = h.heure)::int as ouvertures,
              (select count(*) from demandes_service d where d.etablissement_id = $1::uuid and d.statut <> 'annulee' and d.${periode}
                  and extract(hour from d.cree_le at time zone $3) = h.heure)::int as demandes
         from h order by h.heure`,
      p,
    ),
    requete<{ jour: number; heure: number; n: number }>(
      `select extract(isodow from cree_le at time zone $3)::int as jour, extract(hour from cree_le at time zone $3)::int as heure, count(*)::int as n
         from evenements_service where etablissement_id = $1::uuid and type = 'ouverture' and ${periode}
        group by 1, 2`,
      p,
    ),
    requete<{ id: string; libelle: string; groupe: string | null; ouvertures: number; demandes: number; note: number | null }>(
      `select e.id, e.libelle, e.groupe,
              (select count(*) from evenements_service v where v.emplacement_id = e.id and v.type = 'ouverture' and v.${periode})::int as ouvertures,
              (select count(*) from demandes_service d where d.emplacement_id = e.id and d.statut <> 'annulee' and d.${periode})::int as demandes,
              (select round(avg(r.note)::numeric, 1)::float8 from retours_service r where r.emplacement_id = e.id and r.${periode}) as note
         from emplacements e where e.etablissement_id = $1::uuid and e.actif
        order by ouvertures desc, demandes desc, e.ordre`,
      p.slice(0, 2),
    ),
    requete<{ note: number; commentaire: string | null; emplacement: string | null; google: boolean; cree_le: string }>(
      `select r.note, r.commentaire, e.libelle as emplacement, r.google, r.cree_le
         from retours_service r left join emplacements e on e.id = r.emplacement_id
        where r.etablissement_id = $1::uuid and r.${periode} order by r.cree_le desc limit 25`,
      p.slice(0, 2),
    ),
  ])
  return {
    jours,
    ouvertures: totaux?.ouvertures ?? 0,
    ouverturesPrec: totaux?.ouvertures_prec ?? 0,
    vuesMenu: totaux?.menu ?? 0,
    demandes: totaux?.demandes ?? 0,
    demandesPrec: totaux?.demandes_prec ?? 0,
    parType: types,
    reponseMediane: reponses?.mediane ?? null,
    reponseMoyenne: reponses?.moyenne ?? null,
    pctRapides: reponses?.rapides ?? null,
    note: retours?.note ?? null,
    nbRetours: retours?.n ?? 0,
    repartition: retours?.r ?? [0, 0, 0, 0, 0],
    googleClics: totaux?.google ?? 0,
    wifi: totaux?.wifi ?? 0,
    pdf: totaux?.pdf ?? 0,
    topPlats: plats,
    topRubriques: rubs,
    langues,
    parJour,
    parHeure,
    grille,
    parEmplacement: lieux,
    commentaires,
  }
}

/** Le « en ce moment » du portail : demandes ouvertes, temps d'attente du plus ancien, visites de la dernière heure. */
export async function pouls(etabId: string): Promise<{ ouvertes: number; plusAncienneSec: number | null; visitesHeure: number; demandesAujourdhui: number }> {
  const l = await requeteUne<{ ouvertes: number; plus_ancienne: number | null; visites: number; aujourdhui: number }>(
    `select (select count(*) from demandes_service where etablissement_id = $1::uuid and statut in ('nouvelle', 'prise'))::int as ouvertes,
            (select extract(epoch from now() - min(cree_le))::float8 from demandes_service where etablissement_id = $1::uuid and statut = 'nouvelle') as plus_ancienne,
            (select count(*) from evenements_service where etablissement_id = $1::uuid and type = 'ouverture' and cree_le > now() - interval '1 hour')::int as visites,
            (select count(*) from demandes_service where etablissement_id = $1::uuid and statut <> 'annulee' and cree_le > date_trunc('day', now()))::int as aujourdhui`,
    [etabId],
  )
  return { ouvertes: l?.ouvertes ?? 0, plusAncienneSec: l?.plus_ancienne ?? null, visitesHeure: l?.visites ?? 0, demandesAujourdhui: l?.aujourdhui ?? 0 }
}
