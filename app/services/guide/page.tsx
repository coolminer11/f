import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerProprietaire } from '@/lib/services/proprietaire'

export const metadata: Metadata = { title: 'Lancer un établissement — Tapora Services' }

/**
 * Le guide de lancement de Tapora Services : de la démo chez le client
 * jusqu'au premier rapport mensuel, dans l'ordre où on le fait vraiment.
 */
type Etape = { titre: string; temps: string; points: React.ReactNode[] }

const ETAPES: Etape[] = [
  {
    titre: 'Montrer la démo',
    temps: '5 min, chez le client',
    points: [
      <>Créez une démo (restaurant ou hôtel) depuis <Link href="/services" className="font-semibold text-[var(--color-accent)] hover:underline">Tapora Services</Link> : menu traduit, demandes et un mois de statistiques, en dix secondes.</>,
      <>Sur votre téléphone, ouvrez « Vue client » ; sur un deuxième, le « Portail du personnel ». Touchez « Appeler le serveur » : la demande apparaît en direct, le client voit « J’arrive ».</>,
      <>Finissez sur l’Aperçu : visites, temps de réponse, avis, plats les plus regardés. C’est ce que le gérant recevra chaque mois.</>,
    ],
  },
  {
    titre: 'Créer l’établissement',
    temps: '10 min',
    points: [
      <>« + Nouvel établissement » : le type, le nom et les langues (le français d’abord).</>,
      <>Réglages : le logo, la photo de couverture et la couleur de la marque (l’aperçu du téléphone montre le résultat). Le message d’accueil, le Wi-Fi, le téléphone et le lien des avis Google.</>,
      <>Réglages → Abonnement : l’essai (date de fin) et le prix mensuel. Le courriel du contact sert au rapport mensuel.</>,
    ],
  },
  {
    titre: 'Le menu',
    temps: '20 à 40 min',
    points: [
      <>Menu → « ⇪ Importer » : collez le menu, une ligne « ## Entrées » par section puis une ligne par plat (« Soupe du jour | Selon l’humeur du chef | 7 »). Les sections et les plats se créent d’un coup.</>,
      <>Complétez chaque plat : description, formats (8 ailes / 16 ailes), allergènes, étiquettes (végé, épicé, local), photo.</>,
      <>Traductions : le filtre « à traduire » montre ce qui manque dans chaque langue. Les heures de service et les jours de chaque menu (brunch la fin de semaine, etc.).</>,
    ],
  },
  {
    titre: 'Les demandes et l’avis',
    temps: '5 min',
    points: [
      <>Demandes : gardez « Appeler le serveur » et « L’addition » ; à l’hôtel, serviettes, ménage, oreillers… Ajoutez celles de l’établissement.</>,
      <>« Avis juste après » : l’avis est demandé au client juste après sa demande. Le lien Google est offert à tous, quelle que soit la note — jamais de filtrage des avis.</>,
      <>Réglages → Options : la commande depuis la table ou le service aux chambres, si l’établissement le veut.</>,
    ],
  },
  {
    titre: 'Les tables et les chambres',
    temps: '5 min',
    points: [
      <>Emplacements → « Créer en série » : « Table 1 à 24 » dans le groupe Salle, « Terrasse 1 à 8 »… Chaque emplacement a son adresse : la demande arrive avec le bon numéro.</>,
      <>Les groupes servent au personnel : un serveur peut ne recevoir que la terrasse.</>,
    ],
  },
  {
    titre: 'Imprimer et programmer les cartes',
    temps: '30 min',
    points: [
      <>Aperçu → Liens et accès : « Chevalets » (deux par feuille, à plier en deux) ou la planche de codes QR. Papier épais 80 lb ou plus ; coupez sur le pointillé vertical, pliez sur « pli ».</>,
      <>Les cartes NFC (NTAG213 ou NTAG215) : avec l’app gratuite NFC Tools, « Écrire » → « Ajouter un enregistrement » → « URL » → collez l’adresse de l’emplacement (bouton « Copier » dans Emplacements) → « Écrire » et touchez la carte.</>,
      <>Testez chaque carte avec un téléphone avant de la coller. Le verrouillage de la carte est définitif : ne le faites qu’une fois tout vérifié.</>,
    ],
  },
  {
    titre: 'Le portail du personnel',
    temps: '10 min, avec l’équipe',
    points: [
      <>Aperçu → Liens et accès : protégez le portail par un mot de passe, puis donnez le lien et le mot de passe à l’équipe.</>,
      <>Sur la tablette ou le téléphone du service : ouvrir le lien, « Ajouter à l’écran d’accueil », activer les notifications et le son. Chacun écrit son prénom : le client voit « Marie arrive ».</>,
      <>Le mot de passe du gérant ouvre le mode gérant : il modifie lui-même ses plats, ses prix, ses annonces et son Wi-Fi, sans vous appeler.</>,
    ],
  },
  {
    titre: 'Lancer, puis suivre',
    temps: 'chaque mois',
    points: [
      <>La liste « Prêt à lancer » de l’Aperçu doit être toute cochée.</>,
      <>Facturation : « Facturer le mois » crée les factures dans la comptabilité de la société ; les paiements se notent comme pour les cartes.</>,
      <>Le 1er du mois, le rapport mensuel part au contact de l’établissement. Un coup d’œil à l’Aperçu : temps de réponse, note, commentaires privés à transmettre au gérant.</>,
    ],
  },
]

export default async function GuideServices() {
  await exigerProprietaire()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/services" className="text-sm text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">
          ← Tapora Services
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Lancer un établissement</h1>
        <p className="mt-1 text-[var(--color-encre-doux)]">De la démo chez le client au premier rapport mensuel : environ deux heures en tout, dans cet ordre.</p>
      </div>
      <ol className="cascade space-y-4">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="carte relative overflow-hidden p-5 pl-16">
            <span
              className="absolute left-5 top-5 grid size-8 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-bold text-white"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{e.titre}</h2>
              <span className="text-xs text-[var(--color-encre-doux)]">{e.temps}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {e.points.map((p, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-encre-doux)]/50" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
