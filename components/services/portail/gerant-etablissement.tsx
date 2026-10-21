'use client'

import { useRef, useState } from 'react'
import { texte, type Texte } from '@/lib/services/langues'
import { toast } from '@/components/effets/toasts'
import { vibrer } from '@/components/effets/desintegration'
import { imageGerantAction, infosGerantAction } from '@/app/service/[jeton]/actions-gerant'
import { Accueil, EnTete } from '@/components/services/portail/controles'
import { useRelire } from '@/components/services/portail/gerant-commun'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

export type InfosEtablissement = {
  nom: string
  couleur: string
  accueil: Texte
  logo: string | null
  couverture: string | null
  telephone: string | null
  avis_url: string | null
  wifi_nom: string | null
  wifi_mdp: string | null
}

/**
 * L'établissement, tenu par le gérant : l'image de couverture et le logo
 * (avec l'aperçu de ce que voit le client), le message d'accueil, le Wi-Fi,
 * le téléphone et le lien d'avis Google.
 */
export default function GerantEtablissement({ jeton, l, langues, infos }: { jeton: string; l: LanguePortail; langues: string[]; infos: InfosEtablissement }) {
  const T = TEXTES_PORTAIL[l].gerant
  const [logo, setLogo] = useState(infos.logo)
  const [couverture, setCouverture] = useState(infos.couverture)
  const accueil = texte(infos.accueil, langues[0], langues[0])

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="cascade space-y-5">
        <section className="pt-carte fond-maillage reflet-premium p-5 sm:p-6">
          <EnTete emoji="🏛️" titre={T.infosTitre} sous={T.infosSous} />
          {/* Ce que voit le client en tapant la carte. */}
          <div className="mx-auto mt-5 max-w-sm overflow-hidden rounded-[1.6rem] border border-[var(--p-ligne-forte)] bg-[var(--p-surface)] shadow-[var(--p-ombre-haute)]" aria-label={T.apercuClient}>
            <div
              className="relative h-36 bg-cover bg-center"
              style={couverture ? { backgroundImage: `url(${couverture})` } : { background: 'linear-gradient(140deg, color-mix(in oklab, var(--accent) 75%, #fff), var(--accent))' }}
            >
              <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgb(0_0_0/0.35))]" aria-hidden />
              <span className="absolute bottom-3 left-4 flex items-center gap-2.5">
                {logo ? (
                  <img src={logo} alt="" className="size-11 rounded-xl bg-white object-cover ring-2 ring-white/80" />
                ) : (
                  <span className="titre-portail grid size-11 place-items-center rounded-xl bg-white/90 text-lg text-[var(--p-encre)]">{infos.nom.trim().charAt(0).toUpperCase()}</span>
                )}
              </span>
            </div>
            <div className="px-4 pb-5 pt-3">
              <p className="titre-portail text-xl font-medium leading-tight">{infos.nom}</p>
              {accueil && <p className="mt-1 line-clamp-3 text-sm text-[var(--p-doux)]">{accueil}</p>}
            </div>
          </div>
        </section>

        <section className="pt-carte p-5 sm:p-6">
          <EnTete emoji="🖼️" titre={T.images} sous={T.imagesSous} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ChampImage jeton={jeton} l={l} quoi="couverture" libelle={T.couverture} aide={T.couvertureAide} valeur={couverture} changer={setCouverture} />
            <ChampImage jeton={jeton} l={l} quoi="logo" libelle={T.logo} aide={T.logoAide} valeur={logo} changer={setLogo} />
          </div>
        </section>
      </div>

      <div className="cascade space-y-5">
        <Accueil jeton={jeton} l={l} langues={langues} accueil={infos.accueil} />
        <FormulaireInfos jeton={jeton} l={l} infos={infos} />
      </div>
    </div>
  )
}

function ChampImage({
  jeton,
  l,
  quoi,
  libelle,
  aide,
  valeur,
  changer,
}: {
  jeton: string
  l: LanguePortail
  quoi: 'logo' | 'couverture'
  libelle: string
  aide: string
  valeur: string | null
  changer: (v: string | null) => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const [relire] = useRelire()
  const [envoi, setEnvoi] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  async function envoyer(retirer: boolean) {
    const d = new FormData()
    d.set('jeton', jeton)
    d.set('quoi', quoi)
    const f = fichier.current?.files?.[0]
    if (retirer) d.set('retirer', '1')
    else if (f) d.set('fichier', f)
    else return
    setEnvoi(true)
    const r = await imageGerantAction(d).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoi(false)
    if (fichier.current) fichier.current.value = ''
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    vibrer(12)
    changer(r.image)
    toast(r.image ? T.imageOk : T.imageRetiree, { ton: 'succes', duree: 2400 })
    relire()
  }

  return (
    <div className="rounded-2xl border border-[var(--p-ligne)] p-4">
      <p className="pt-etiquette">{libelle}</p>
      <div className={`grid place-items-center overflow-hidden rounded-xl bg-[var(--p-surface-2)] ring-1 ring-[var(--p-ligne)] ${quoi === 'logo' ? 'mx-auto size-24' : 'h-24 w-full'}`}>
        {valeur ? <img src={valeur} alt="" className="size-full object-cover" /> : <span className="text-2xl" aria-hidden>{quoi === 'logo' ? '◎' : '🏞️'}</span>}
      </div>
      <p className="mt-2 text-xs text-[var(--p-faible)]">{aide}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className={`pt-bouton-doux cursor-pointer !py-2 text-sm ${envoi ? 'pointer-events-none opacity-60' : ''}`}>
          {envoi ? T.envoiImage : valeur ? T.changer : T.ajouterImage}
          <input ref={fichier} type="file" name={quoi} accept="image/*" className="sr-only" aria-label={`${libelle} · ${valeur ? T.changer : T.ajouterImage}`} disabled={envoi} onChange={() => void envoyer(false)} />
        </label>
        {valeur && (
          <button type="button" className="pt-bouton-fantome !py-2 text-sm" disabled={envoi} onClick={() => void envoyer(true)}>
            {T.retirerImage}
          </button>
        )}
      </div>
    </div>
  )
}

function FormulaireInfos({ jeton, l, infos }: { jeton: string; l: LanguePortail; infos: InfosEtablissement }) {
  const T = TEXTES_PORTAIL[l].gerant
  const [relire] = useRelire()
  const [s, setS] = useState({
    wifi_nom: infos.wifi_nom ?? '',
    wifi_mdp: infos.wifi_mdp ?? '',
    telephone: infos.telephone ?? '',
    avis_url: infos.avis_url ?? '',
  })
  const [envoi, setEnvoi] = useState(false)
  const maj = (c: Partial<typeof s>) => setS((x) => ({ ...x, ...c }))
  const avisInvalide = s.avis_url.trim() !== '' && !/^https:\/\/[^\s/]+\.[^\s]+/i.test(s.avis_url.trim())

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (avisInvalide) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: T.avisGoogleAide })
      return
    }
    setEnvoi(true)
    const r = await infosGerantAction(jeton, s).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoi(false)
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    vibrer(14)
    toast(T.infosEnregistrees, { ton: 'succes' })
    relire()
  }

  return (
    <form onSubmit={envoyer} className="pt-carte space-y-6 p-5 sm:p-6">
      <div>
        <EnTete emoji="📶" titre={T.wifiTitre} sous={T.wifiSous} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="pt-etiquette" htmlFor="infos-wifi-nom">
              {T.wifiNom}
            </label>
            <input id="infos-wifi-nom" name="wifi_nom" maxLength={64} autoComplete="off" spellCheck={false} value={s.wifi_nom} onChange={(e) => maj({ wifi_nom: e.target.value })} className="pt-champ font-mono text-sm" />
          </div>
          <div>
            <label className="pt-etiquette" htmlFor="infos-wifi-mdp">
              {T.wifiMdp}
            </label>
            <input id="infos-wifi-mdp" name="wifi_mdp" maxLength={64} autoComplete="off" spellCheck={false} value={s.wifi_mdp} onChange={(e) => maj({ wifi_mdp: e.target.value })} className="pt-champ font-mono text-sm" />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--p-ligne)] pt-6">
        <EnTete emoji="⭐" titre={T.coordonnees} sous={T.coordonneesSous} />
        <div className="mt-4 grid gap-4">
          <div>
            <label className="pt-etiquette" htmlFor="infos-telephone">
              {T.telephone}
            </label>
            <input id="infos-telephone" name="telephone" type="tel" maxLength={40} value={s.telephone} onChange={(e) => maj({ telephone: e.target.value })} placeholder={T.telephoneEx} className="pt-champ" />
          </div>
          <div>
            <label className="pt-etiquette" htmlFor="infos-avis">
              {T.avisGoogle}
            </label>
            <input
              id="infos-avis"
              name="avis_url"
              type="url"
              inputMode="url"
              maxLength={600}
              value={s.avis_url}
              onChange={(e) => maj({ avis_url: e.target.value })}
              placeholder={T.avisGoogleEx}
              aria-invalid={avisInvalide || undefined}
              className={`pt-champ font-mono text-sm ${avisInvalide ? '!border-[var(--p-rouge)]' : ''}`}
            />
            <p className={`mt-1 text-xs ${avisInvalide ? 'font-medium text-[var(--p-rouge)]' : 'text-[var(--p-faible)]'}`}>{T.avisGoogleAide}</p>
          </div>
        </div>
      </div>

      <button disabled={envoi} className="pt-bouton">
        {envoi ? TEXTES_PORTAIL[l].enregistrement : TEXTES_PORTAIL[l].enregistrer}
      </button>
    </form>
  )
}
