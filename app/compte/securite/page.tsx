import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import {
  empreinteSessionCourante,
  exigerSession,
  fermerAutresSessions,
  fermerUneSession,
  listerSessions,
  motDePasseCorrespond,
} from '@/lib/auth'
import { requeteUne } from '@/lib/db'
import {
  activerDoubleAuth,
  codesRestants,
  desactiverDoubleAuth,
  nouveauxCodes,
  preparerDoubleAuth,
  secretEnAttente,
  verifierCodeCompte,
} from '@/lib/double-auth'
import { lienApplication } from '@/lib/totp'
import { contexteRequete, ralentir, verrouConnexion } from '@/lib/securite'
import { echecConnexion } from '@/lib/connexion'
import { courrielDoubleAuth } from '@/lib/courriel-securite'
import { echecsRecents, etatEquipe, journalCompte } from '@/lib/requetes/securite'
import FormulaireCodes, { type EtatCodes } from '@/components/activation-2fa'
import BoutonEnvoi from '@/components/bouton-envoi'

export const dynamic = 'force-dynamic'

const dateHeure = (d: string) =>
  new Date(d).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' })

function ilYa(d: string): string {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 90) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return `il y a ${Math.round(s / 86400)} j`
}

/** Les gestes sensibles demandent un code frais (et, pour désactiver, le mot de passe). */
async function preuve(donnees: FormData, avecMotDePasse: boolean): Promise<string | null> {
  const u = await exigerSession({ sansDoubleAuth: true })
  const ctx = await contexteRequete()
  const verrou = await verrouConnexion(u.courriel, ctx)
  if (verrou.bloque) return `Trop d’essais. Réessayez dans ${verrou.minutes} min.`
  let bon = true
  if (avecMotDePasse) {
    const ligne = await requeteUne<{ empreinte: string }>(`select empreinte from utilisateurs where id = $1::uuid`, [u.id])
    bon = Boolean(ligne && (await motDePasseCorrespond(String(donnees.get('mot_de_passe') ?? ''), ligne.empreinte)))
  }
  if (bon) bon = (await verifierCodeCompte(u.id, String(donnees.get('code') ?? ''))) !== null
  if (!bon) {
    await echecConnexion({ courriel: u.courriel, compte: u, etape: 'code', ctx })
    await ralentir(u.courriel, ctx)
    return avecMotDePasse ? 'Mot de passe ou code incorrect.' : 'Code incorrect.'
  }
  return null
}

export default async function PageSecurite({ searchParams }: { searchParams: Promise<{ etape?: string; message?: string; erreur?: string }> }) {
  const moi = await exigerSession({ sansDoubleAuth: true })
  const p = await searchParams
  const [sessions, courante, journal, restants, enAttente] = await Promise.all([
    listerSessions(moi.id),
    empreinteSessionCourante(),
    journalCompte(moi.id),
    moi.totp_actif ? codesRestants(moi.id) : Promise.resolve(0),
    moi.totp_actif ? Promise.resolve(null) : secretEnAttente(moi.id),
  ])
  const equipe = moi.role === 'associe' ? await etatEquipe() : []
  const echecs = moi.role === 'associe' ? await echecsRecents() : []
  const scanner = !moi.totp_actif && p.etape === 'scanner' && enAttente
  const qr = scanner
    ? await QRCode.toString(lienApplication(enAttente, moi.courriel), { type: 'svg', margin: 1, color: { dark: '#2a211a', light: '#fffaf2' } })
    : null

  // ---- Actions ------------------------------------------------------------

  async function commencer() {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    if (!u.totp_actif) await preparerDoubleAuth(u.id)
    redirect('/compte/securite?etape=scanner#double-auth')
  }

  async function activer(_: EtatCodes, donnees: FormData): Promise<EtatCodes> {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    const codes = await activerDoubleAuth(u.id, String(donnees.get('code') ?? ''))
    if (!codes) return { ok: false, erreur: 'Ce code ne correspond pas. Vérifiez l’heure de votre téléphone et entrez le code affiché maintenant.' }
    await courrielDoubleAuth(u, await contexteRequete(), true).catch(() => null)
    // Pas de revalidation ici : la page se redessinerait sans le formulaire,
    // et les codes de secours ne s'afficheraient jamais. Le bouton
    // « J'ai mis mes codes en lieu sûr » recharge la page.
    return { ok: true, codes }
  }

  async function regenerer(_: EtatCodes, donnees: FormData): Promise<EtatCodes> {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    const erreur = await preuve(donnees, false)
    if (erreur) return { ok: false, erreur }
    return { ok: true, codes: await nouveauxCodes(u.id) }
  }

  // La double authentification est obligatoire : on ne la retire pas, on la
  // déplace. L'ancienne clé cesse de marcher, la nouvelle se scanne aussitôt.
  async function changerTelephone(_: EtatCodes, donnees: FormData): Promise<EtatCodes> {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    const erreur = await preuve(donnees, true)
    if (erreur) return { ok: false, erreur }
    await desactiverDoubleAuth(u.id)
    await courrielDoubleAuth(u, await contexteRequete(), false).catch(() => null)
    await preparerDoubleAuth(u.id)
    revalidatePath('/', 'layout')
    redirect('/compte/securite?etape=scanner#double-auth')
  }

  async function fermer(donnees: FormData) {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    await fermerUneSession(u.id, String(donnees.get('id')))
    revalidatePath('/compte/securite')
  }

  async function fermerAutres() {
    'use server'
    const u = await exigerSession({ sansDoubleAuth: true })
    await fermerAutresSessions(u.id)
    revalidatePath('/compte/securite')
    redirect(`/compte/securite?message=${encodeURIComponent('Toutes vos autres sessions sont fermées.')}`)
  }

  const secretLisible = enAttente?.match(/.{1,4}/g)?.join(' ')

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Sécurité</h1>
          <p className="mt-1 text-sm text-[var(--color-encre-doux)]">Double authentification, appareils connectés et journal des connexions.</p>
        </div>
        {moi.totp_actif ? (
          <Link href="/compte" className="bouton bouton-secondaire text-xs">Comptes et mot de passe →</Link>
        ) : (
          <form action="/connexion/sortie" method="post">
            <button className="bouton bouton-secondaire text-xs">Se déconnecter</button>
          </form>
        )}
      </div>

      {!moi.totp_actif && (
        <div className="carte flex items-start gap-4 border-[var(--color-accent)] bg-[var(--color-accent-doux)] p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <div>
            <p className="font-semibold">Double authentification obligatoire pour la sécurité</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-encre-doux)]">
              Le back-office contient les finances, les clients et les comptes de Tapora : aucun compte n’y entre sans un code de son téléphone en plus du
              mot de passe. Activez-la ci-dessous (2 minutes) : tout le reste s’ouvrira ensuite.
            </p>
          </div>
        </div>
      )}

      {p.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{p.erreur}</p>}
      {p.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{p.message}</p>}

      {/* ---- Double authentification ---- */}
      <section id="double-auth" className="carte scroll-mt-24 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${moi.totp_actif ? 'bg-[#e3efe6] text-[var(--color-positif)]' : 'bg-[var(--color-accent-doux)] text-[var(--color-accent)]'}`} aria-hidden>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
                {moi.totp_actif && <path d="M9 12l2 2 4-4" />}
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-bold">Double authentification</h2>
              <p className="mt-1 max-w-lg text-sm text-[var(--color-encre-doux)]">
                {moi.totp_actif
                  ? `Activée. Un code de votre téléphone est demandé à chaque connexion. Codes de secours restants : ${restants} sur 10.`
                  : 'Un code à 6 chiffres de votre téléphone, en plus du mot de passe. Même si quelqu’un découvre votre mot de passe, il ne peut pas entrer.'}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${moi.totp_actif ? 'bg-[#e3efe6] text-[var(--color-positif)]' : 'bg-[#fbe7da] text-[var(--color-attention)]'}`}>
            {moi.totp_actif ? '● Activée' : '● À activer'}
          </span>
        </div>

        {!moi.totp_actif && !scanner && (
          <div className="border-t border-[var(--color-ligne)] bg-[var(--color-fond)]/40 px-6 py-5">
            <form action={commencer}>
              <BoutonEnvoi>Activer la double authentification</BoutonEnvoi>
            </form>
            <p className="mt-2 text-xs text-[var(--color-encre-doux)]">Il vous faut une application gratuite : Google Authenticator, Microsoft Authenticator, 1Password ou l’app Mots de passe de l’iPhone.</p>
          </div>
        )}

        {scanner && qr && (
          <div className="grid gap-6 border-t border-[var(--color-ligne)] bg-[var(--color-fond)]/40 px-6 py-6 md:grid-cols-[220px_1fr]">
            <div>
              <div className="rounded-2xl border border-[var(--color-ligne)] bg-[#fffaf2] p-3 shadow-sm" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-2 text-center text-[11px] text-[var(--color-encre-doux)]">Ou entrez la clé à la main :</p>
              <p className="mt-1 select-all break-all text-center font-mono text-xs tracking-wider">{secretLisible}</p>
            </div>
            <div>
              <ol className="mb-4 space-y-1.5 text-sm">
                <li><strong>1.</strong> Ouvrez votre application d’authentification.</li>
                <li><strong>2.</strong> Ajoutez un compte et scannez le code QR.</li>
                <li><strong>3.</strong> Entrez le code à 6 chiffres qu’elle affiche pour « Tapora ».</li>
              </ol>
              <FormulaireCodes action={activer} libelle="Activer" autoFocus />
            </div>
          </div>
        )}

        {moi.totp_actif && (
          <div className="grid gap-6 border-t border-[var(--color-ligne)] bg-[var(--color-fond)]/40 px-6 py-5 md:grid-cols-2">
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold">Nouveaux codes de secours</summary>
              <p className="mt-1 mb-3 text-xs text-[var(--color-encre-doux)]">Les anciens codes cessent de fonctionner.</p>
              <FormulaireCodes action={regenerer} libelle="Générer de nouveaux codes" />
            </details>
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold">Changer de téléphone</summary>
              <p className="mt-1 mb-3 text-xs text-[var(--color-encre-doux)]">
                Votre mot de passe et un code de l’ancien téléphone (ou un code de secours), puis vous scannez le nouveau code QR. Un courriel vous préviendra.
              </p>
              <FormulaireCodes action={changerTelephone} libelle="Changer de téléphone" champMotDePasse />
            </details>
          </div>
        )}
      </section>

      {/* ---- Sessions ---- */}
      <section className="carte overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
          <div>
            <h2 className="text-sm font-bold">Appareils connectés</h2>
            <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Une session reste ouverte 7 jours. Fermez celles que vous ne reconnaissez pas.</p>
          </div>
          {sessions.length > 1 && (
            <form action={fermerAutres}>
              <BoutonEnvoi secondaire className="text-xs">Déconnecter partout ailleurs</BoutonEnvoi>
            </form>
          )}
        </div>
        <ul className="divide-y divide-[var(--color-ligne)] border-t border-[var(--color-ligne)]">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-fond)] text-[var(--color-encre-doux)]" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  {/iPhone|Android/.test(s.appareil ?? '') ? <rect x="7" y="3" width="10" height="18" rx="2" /> : <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></>}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {s.appareil ?? 'Appareil inconnu'}
                  {s.empreinte === courante && <span className="ml-2 rounded-full bg-[#e3efe6] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-positif)]">cette session</span>}
                </div>
                <div className="text-xs text-[var(--color-encre-doux)]">
                  {s.ip_masquee ?? 'réseau inconnu'} · ouverte le {dateHeure(s.cree_le)} · active {ilYa(s.derniere_vue)}
                </div>
              </div>
              {s.empreinte !== courante && (
                <form action={fermer}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-xs font-medium text-[var(--color-negatif)] hover:underline">Fermer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Journal ---- */}
      <section className="carte overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-sm font-bold">Mes dernières connexions</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Les adresses sont masquées (Loi 25). Gardé 180 jours.</p>
        </div>
        {journal.length === 0 ? (
          <p className="border-t border-[var(--color-ligne)] px-6 py-4 text-sm text-[var(--color-encre-doux)]">Rien encore : le journal commence à la prochaine connexion.</p>
        ) : (
          <table className="w-full border-t border-[var(--color-ligne)] text-sm">
            <tbody>
              {journal.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="whitespace-nowrap px-6 py-2.5 text-[var(--color-encre-doux)]">{dateHeure(t.cree_le)}</td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${t.reussie ? 'text-[var(--color-positif)]' : 'text-[var(--color-negatif)]'}`}>
                      <span className={`size-1.5 rounded-full ${t.reussie ? 'bg-[var(--color-positif)]' : 'bg-[var(--color-negatif)]'}`} />
                      {t.reussie ? 'Connexion réussie' : t.etape === 'code' ? 'Code refusé' : 'Mot de passe refusé'}
                    </span>
                  </td>
                  <td className="hidden px-2 py-2.5 text-[var(--color-encre-doux)] sm:table-cell">{t.appareil}</td>
                  <td className="px-6 py-2.5 text-right text-xs text-[var(--color-encre-doux)]">{t.ip_masquee ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---- Équipe (associés) ---- */}
      {moi.role === 'associe' && (
        <section className="grid items-start gap-5 lg:grid-cols-2">
          <div className="carte overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-sm font-bold">L’équipe</h2>
              <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Qui est protégé par la double authentification.</p>
            </div>
            <ul className="divide-y divide-[var(--color-ligne)] border-t border-[var(--color-ligne)]">
              {equipe.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{e.nom}{!e.actif && <span className="ml-2 text-xs text-[var(--color-encre-doux)]">(désactivé)</span>}</div>
                    <div className="truncate text-xs text-[var(--color-encre-doux)]">
                      {e.echecs_7j > 0 ? `${e.echecs_7j} échec${e.echecs_7j > 1 ? 's' : ''} en 7 jours` : 'aucun échec en 7 jours'}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${e.totp_actif ? 'bg-[#e3efe6] text-[var(--color-positif)]' : 'bg-[#fbe7da] text-[var(--color-attention)]'}`}>
                    {e.totp_actif ? '2FA activée' : 'sans 2FA'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="carte overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-sm font-bold">Essais refusés (30 jours)</h2>
              <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Tous comptes, y compris les courriels qui n’existent pas.</p>
            </div>
            {echecs.length === 0 ? (
              <p className="border-t border-[var(--color-ligne)] px-6 py-4 text-sm text-[var(--color-encre-doux)]">Aucun. Tout est calme ✓</p>
            ) : (
              <ul className="divide-y divide-[var(--color-ligne)] border-t border-[var(--color-ligne)]">
                {echecs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-6 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--color-encre)]">{t.nom ?? t.courriel}</div>
                      <div className="text-[var(--color-encre-doux)]">{t.etape === 'code' ? 'code refusé' : 'mot de passe refusé'} · {t.appareil}</div>
                    </div>
                    <div className="shrink-0 text-right text-[var(--color-encre-doux)]">
                      <div>{dateHeure(t.cree_le)}</div>
                      <div>{t.ip_masquee ?? '—'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="carte p-6 text-sm leading-relaxed text-[var(--color-encre-doux)]">
        <h2 className="text-sm font-bold text-[var(--color-encre)]">Ce qui protège le back-office</h2>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <li>✓ Essais limités : 5 échecs → pause de 15 min, puis 1 h, puis 24 h</li>
          <li>✓ Courriel d’alerte quand un compte est bloqué</li>
          <li>✓ Courriel à chaque connexion depuis un nouvel appareil</li>
          <li>✓ Lien « Ce n’était pas moi » : tout fermer en un clic</li>
          <li>✓ Mots de passe gardés en empreinte scrypt, jamais en clair</li>
          <li>✓ Sessions révocables, cookie chiffré et signé</li>
        </ul>
      </section>
    </div>
  )
}
