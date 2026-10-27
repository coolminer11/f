import { contexteRequete } from '@/lib/securite'
import { enregistrerDemandeEntreprise } from '@/lib/portail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le formulaire « offre Entreprise » de taporacards.com. Le site l'envoie
 * en fetch (corps urlencoded : requête « simple », sans pré-vol) ; la
 * demande arrive dans le back-office (Messages) et par courriel.
 *
 * Seul le site peut l'appeler (Origin vérifiée). Contre les robots : un
 * champ piège (`site`), un délai minimal entre l'affichage et l'envoi, et
 * des plafonds (5 par heure et par adresse, 40 par jour). Un robot reçoit
 * « ok » sans que rien soit enregistré : il n'apprend rien.
 */
const ORIGINES = new Set(['https://taporacards.com', 'https://www.taporacards.com', ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:4321'])])
const COURRIEL = /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i

const ERREURS = {
  fr: {
    champs: 'Il manque votre nom, celui de l’entreprise ou un courriel valide.',
    minimum: 'L’offre Entreprise commence à 25 cartes.',
    minimumDeux: 'Pour les deux versions (Québec et hors Québec), il faut au moins 50 cartes : 25 par design.',
    trop: 'Beaucoup de demandes en peu de temps : réessayez dans une heure, ou écrivez à contact@taporacards.com.',
  },
  en: {
    champs: 'Your name, the business name or a valid email is missing.',
    minimum: 'The Business offer starts at 25 cards.',
    minimumDeux: 'For both versions (Québec and outside Québec), you need at least 50 cards: 25 per design.',
    trop: 'Too many requests in a short time: try again in an hour, or email contact@taporacards.com.',
  },
}

function entetes(origine: string | null): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origine && ORIGINES.has(origine) ? { 'access-control-allow-origin': origine, vary: 'Origin' } : {}),
  }
}

const repondre = (corps: object, status: number, origine: string | null) => new Response(JSON.stringify(corps), { status, headers: entetes(origine) })

export function OPTIONS(requete: Request) {
  const origine = requete.headers.get('origin')
  return new Response(null, {
    status: 204,
    headers: { ...entetes(origine), 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' },
  })
}

export async function POST(requete: Request) {
  const origine = requete.headers.get('origin')
  if (!origine || !ORIGINES.has(origine)) return repondre({ ok: false, erreur: 'Origine refusée.' }, 403, origine)
  if (Number(requete.headers.get('content-length') ?? 0) > 20_000) return repondre({ ok: false, erreur: 'Trop long.' }, 413, origine)

  let f: FormData
  try {
    f = await requete.formData()
  } catch {
    return repondre({ ok: false, erreur: 'Formulaire illisible.' }, 400, origine)
  }
  const champ = (nom: string, max: number) => String(f.get(nom) ?? '').trim().slice(0, max)
  const langue = champ('langue', 2) === 'en' ? 'en' : 'fr'
  const E = ERREURS[langue]

  // Robots : le piège rempli, ou un envoi moins de 3 s après l'affichage.
  const affiche = Number(champ('t', 20))
  if (champ('site', 200) || (Number.isFinite(affiche) && affiche > 0 && Date.now() - affiche < 3000)) return repondre({ ok: true }, 200, origine)

  const contact = champ('nom', 120)
  const entreprise = champ('entreprise', 200)
  const courriel = champ('courriel', 254).toLowerCase()
  if (!contact || !entreprise || !COURRIEL.test(courriel)) return repondre({ ok: false, erreur: E.champs }, 400, origine)
  const brut = champ('lieu', 8)
  const lieu = brut === 'HORS_QC' || brut === 'LES_DEUX' ? brut : 'QC'
  // 25 cartes minimum par design : « les deux » versions, c'est deux designs.
  const minimum = lieu === 'LES_DEUX' ? 50 : 25
  const quantite = Number(champ('quantite', 7))
  if (!Number.isInteger(quantite) || quantite < minimum || quantite > 100000) return repondre({ ok: false, erreur: lieu === 'LES_DEUX' ? E.minimumDeux : E.minimum }, 400, origine)

  const r = await enregistrerDemandeEntreprise(
    {
      contact_nom: contact,
      entreprise,
      courriel,
      telephone: champ('telephone', 40) || null,
      quantite,
      lieu,
      langue,
      message: champ('message', 3000) || null,
    },
    await contexteRequete(),
  )
  if (r === 'trop') return repondre({ ok: false, erreur: E.trop }, 429, origine)
  return repondre({ ok: true }, 200, origine)
}
