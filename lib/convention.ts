import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { emetteur } from '@/lib/requetes/ventes'
import { equipe } from '@/lib/equipe'

/**
 * La convention d'associés, gardée dans le back-office.
 *
 * Chaque modification du texte crée une nouvelle version : une approbation
 * vaut pour un texte précis, jamais pour un texte modifié après coup. Chaque
 * associé approuve pour lui-même, depuis son propre compte. Une fois signée
 * chez le notaire ou l'avocat, le PDF signé se joint à la version.
 *
 * Le texte est simple : « # » titre, « ## » article, « - » énumération. Les
 * chiffres entre [crochets] sont des propositions à discuter.
 */

export type Version = {
  id: string
  version: number
  texte: string
  pdf_signe: string | null
  cree_le: string
  cree_par: string | null
}

export type Approbation = { associe_id: string; nom: string; approuve_le: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const CROCHETS = /\[[^\]\n]{1,80}\]/g

export async function versions(): Promise<(Omit<Version, 'texte'> & { approbations: number })[]> {
  return requete(
    `select c.id, c.version, c.pdf_signe, c.cree_le, u.nom as cree_par,
            (select count(*)::int from conventions_approbations a where a.convention_id = c.id) as approbations
       from conventions c left join utilisateurs u on u.id = c.cree_par
      order by c.version desc`,
  )
}

/** Une version (la plus récente si aucun numéro), avec l'approbation de chaque associé. */
export async function lireConvention(numero?: number): Promise<{ v: Version; approbations: Approbation[]; courante: boolean } | null> {
  const v = await requeteUne<Version>(
    `select c.id, c.version, c.texte, c.pdf_signe, c.cree_le, u.nom as cree_par
       from conventions c left join utilisateurs u on u.id = c.cree_par
      where ${numero ? 'c.version = $1' : 'c.version = (select max(version) from conventions)'}`,
    numero ? [numero] : [],
  )
  if (!v) return null
  const [approbations, max] = await Promise.all([
    requete<Approbation>(
      `select a.id as associe_id, a.nom, ca.approuve_le
         from associes a left join conventions_approbations ca on ca.associe_id = a.id and ca.convention_id = $1::uuid
        where a.actif order by a.ordre`,
      [v.id],
    ),
    requeteUne<{ n: number }>(`select max(version)::int as n from conventions`),
  ])
  return { v, approbations, courante: v.version === max?.n }
}

/** Nouvelle version si le texte a changé ; sinon rien. Renvoie le numéro de la version courante. */
export async function enregistrerTexte(texte: string, utilisateurId: string): Promise<number> {
  const propre = texte.replace(/\r\n/g, '\n').trim()
  const courante = await requeteUne<{ version: number; texte: string }>(
    `select version, texte from conventions order by version desc limit 1`,
  )
  if (courante && courante.texte === propre) return courante.version
  const l = await requeteUne<{ version: number }>(
    `insert into conventions (version, texte, cree_par)
     values ((select coalesce(max(version), 0) + 1 from conventions), $1, $2::uuid) returning version`,
    [propre, utilisateurId],
  )
  return l!.version
}

/** Approuver (ou retirer) pour SON associé, seulement la version courante. */
export async function approuver(conventionId: string, associeId: string, oui: boolean): Promise<boolean> {
  if (!UUID.test(conventionId) || !UUID.test(associeId)) return false
  const courante = await requeteUne<{ id: string }>(`select id from conventions order by version desc limit 1`)
  if (courante?.id !== conventionId) return false
  await requete(
    oui
      ? `insert into conventions_approbations (convention_id, associe_id) values ($1::uuid, $2::uuid) on conflict do nothing`
      : `delete from conventions_approbations where convention_id = $1::uuid and associe_id = $2::uuid`,
    [conventionId, associeId],
  )
  return true
}

export async function joindrePdf(conventionId: string, chemin: string | null): Promise<void> {
  if (!UUID.test(conventionId)) return
  await requete(`update conventions set pdf_signe = $2 where id = $1::uuid`, [conventionId, chemin])
}

// ---------------------------------------------------------------------------
// L'ébauche de départ, remplie avec les vrais noms, parts et rôles.
// ---------------------------------------------------------------------------
export async function ebauche(): Promise<string> {
  const [societe, membres, parts] = await Promise.all([
    emetteur(),
    equipe(),
    requete<{ nom: string; part: string }>(`select nom, part from associes where actif order by ordre`),
  ])
  const noms = membres.map((m) => m.nom)
  const liste = (n: string[]) => (n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]}`)
  const pct = (p: string) => String(Math.round(Number(p) * 1000) / 10).replace('.', ',')
  // Minuscule en milieu de phrase, sauf les noms propres (« LinkedIn » garde la sienne).
  const bas = (t: string) => (/^\p{Lu}[^\s]*\p{Lu}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
  const roles = membres
    .map((m) => `- ${m.nom} : ${bas(m.titre ?? '[rôle]')}${m.responsabilites.length ? ` (${m.responsabilites.map((r) => bas(r.libelle)).join(', ')})` : ''} ;`)
    .join('\n')
    .replace(/ ;$/, '.')
  const partage = parts.map((p) => `- ${p.nom} : [${pct(p.part)}] % ;`).join('\n').replace(/ ;$/, '.')
  const ville = societe.ville?.trim() || 'ville'
  const neq = societe.neq ? `, immatriculée au Québec sous le NEQ ${societe.neq}` : ''

  return `# Convention d’associés — ${societe.nom_entreprise}

Entre ${liste(noms)} (les « associés »), seuls associés de ${societe.nom_entreprise}, société en nom collectif${neq} (la « société »).

## 1. Objet de la société

La société conçoit et vend des cartes NFC et des codes QR qui aident les commerces à obtenir des avis Google, ainsi que les services qui les accompagnent : page de statistiques, rapports, notifications.

## 2. Apports

Les apports de chaque associé sont inscrits à son compte de capital, tenu dans le back-office de la société (écran Associés). Un apport en argent ou en biens n’est reconnu que s’il y est inscrit.

Le travail fourni par un associé n’est pas un apport en capital : il est reconnu par le partage des bénéfices (articles 4 et 5).

## 3. Rôles et engagement de temps

À la signature, les rôles sont les suivants :
${roles}

Les rôles peuvent être ajustés d’un commun accord ; l’écran « Qui fait quoi » du back-office en tient la version à jour, avec les objectifs de chaque semaine.

Chaque associé s’engage à consacrer au moins [15] heures par semaine aux affaires de la société. Les associés font le point ensemble chaque lundi.

## 4. Partage des bénéfices et des pertes

Les bénéfices et les pertes sont partagés ainsi :
${partage}

Sans convention, le Code civil du Québec prévoit un partage égal (art. 2202).

## 5. Révision du partage

Le partage de l’article 4 est revu [six mois] après la signature, puis chaque année, à la lumière des objectifs atteints et du temps consacré par chacun.

Une révision ne peut déplacer plus de [10] points de pourcentage à la fois. Elle se décide à l’unanimité ; à défaut d’entente, les associés recourent à la médiation (article 13).

## 6. Prélèvements

Les prélèvements se font en proportion du partage des bénéfices, et seulement si la trésorerie le permet une fois payées les dépenses courantes et mises de côté les taxes à remettre.

Un prélèvement de plus de [500] $ par mois par associé exige l’accord des deux associés.

Les avances d’un associé à la société sont inscrites à son compte courant et lui sont remboursées avant tout prélèvement.

## 7. Décisions

Chaque associé décide seul, dans son rôle, des dépenses courantes jusqu’à [250] $.

Exigent l’accord des deux associés, inscrit au registre des décisions du back-office :
- une dépense ou un engagement de plus de [250] $ ;
- un emprunt, une garantie, ou un contrat de plus de [6] mois ;
- l’arrivée d’un nouvel associé ou d’un investisseur ;
- un changement du prix des cartes ;
- toute modification de la présente convention.

## 8. Propriété intellectuelle

Le logiciel (back-office, site web, services en ligne), la marque Tapora, le logo, les visuels, les textes, la liste des clients et les données créés pour la société lui appartiennent, quel que soit l’associé qui les a créés. Chaque associé cède à la société les droits qu’il pourrait détenir sur ces créations et renonce à exercer ses droits moraux à leur égard, dans la mesure permise par la loi.

Leur valeur est prise en compte dans le prix de rachat des parts (article 10).

## 9. Confidentialité et non-concurrence

Chaque associé garde confidentiels les renseignements de la société et de ses clients, pendant qu’il est associé et après son départ.

Pendant qu’il est associé et [12] mois après son départ, un associé ne peut exploiter, au Québec, une entreprise de cartes ou de solutions d’avis en ligne qui fait concurrence à la société, ni en solliciter les clients.

## 10. Départ d’un associé

Un associé qui veut se retirer en avise l’autre par écrit [90] jours à l’avance.

L’associé qui reste peut racheter les parts de celui qui part, au prix suivant :
- départ dans les [12] premiers mois suivant la signature : le solde de son compte de capital, sans plus ;
- départ après : le solde de son compte de capital, plus sa part de la juste valeur de la société, établie d’un commun accord ou, à défaut, par un évaluateur choisi par les deux associés.

Le prix est payable en [12] versements mensuels égaux, sans intérêt.

Un associé qui manque de façon répétée à ses engagements de l’article 3, malgré un avis écrit resté sans effet pendant [30] jours, peut être exclu ; le rachat de ses parts se fait alors comme pour un départ dans les [12] premiers mois.

## 11. Décès ou invalidité

Au décès d’un associé, ou s’il ne peut plus travailler pendant plus de [6] mois, l’autre associé rachète ses parts au prix prévu pour un départ après [12] mois. Les associés envisagent une assurance vie croisée pour financer ce rachat.

## 12. Responsabilité

Dans une société en nom collectif, chaque associé répond des dettes de la société. Aucun associé n’engage la société en dehors de son rôle et des limites de l’article 7.

## 13. Différends

Les associés tentent d’abord de régler un différend entre eux. À défaut, ils recourent à un médiateur accrédité choisi ensemble, avant toute poursuite.

## 14. Durée et dissolution

La convention dure aussi longtemps que la société. En cas de dissolution, les dettes sont payées, les comptes courants remboursés, puis le reste est partagé selon les comptes de capital et le partage de l’article 4.

## 15. Signatures

Signé à [${ville}], le [date], en deux exemplaires.

${noms.map((n) => `${n} : ______________________________`).join('\n\n')}
`
}
