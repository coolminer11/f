// La page Partenaires : la liste vient du serveur des cartes (cache Cloudflare),
// et se construit ici, sans innerHTML pour les données — un nom de commerce
// n'est jamais interprété comme du HTML.
;(() => {
  const racine = document.getElementById('partenaires')
  if (!racine) return
  const fr = racine.dataset.langue !== 'en'
  const T = fr
    ? { ambassadeur: 'Ambassadeur', visiter: 'Visiter le site', avis: 'Voir les avis', vide: 'Les premiers partenaires arrivent bientôt.', erreur: 'La liste revient dans un instant. Rechargez la page.' }
    : { ambassadeur: 'Ambassador', visiter: 'Visit website', avis: 'See reviews', vide: 'Our first partners are coming soon.', erreur: 'The list will be back in a moment. Reload the page.' }

  const el = (balise, classe, texte) => {
    const n = document.createElement(balise)
    if (classe) n.className = classe
    if (texte) n.textContent = texte
    return n
  }
  const sur = (u) => typeof u === 'string' && /^https:\/\/[^\s<>"']+$/i.test(u)
  const web = (u) => typeof u === 'string' && /^https?:\/\/[^\s<>"']+$/i.test(u)
  const message = (texte) => {
    racine.replaceChildren(el('p', 'col-span-full rounded-3xl border border-ligne bg-creme/70 px-6 py-10 text-center text-encre-doux', texte))
  }

  fetch(racine.dataset.source, { mode: 'cors', credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(({ partenaires }) => {
      if (!Array.isArray(partenaires) || !partenaires.length) return message(T.vide)
      const cartes = partenaires.slice(0, 200).map((p, i) => {
        const carte = el('article', 'partenaire flex flex-col rounded-3xl border border-ligne bg-creme p-6 shadow-[0_18px_40px_-28px_rgba(60,40,20,.55)]')
        carte.style.animationDelay = `${Math.min(i, 12) * 60}ms`
        const haut = el('div', 'flex items-start justify-between gap-3')
        haut.append(el('h2', 'titre text-2xl font-semibold leading-tight', String(p.nom ?? '')))
        if (p.ambassadeur) haut.append(el('span', 'pastille-ambassadeur shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-[#5a3b05]', `🏅 ${T.ambassadeur}`))
        carte.append(haut)
        if (sur(p.badge)) {
          const lien = el('a', 'mt-5 block self-start transition hover:-translate-y-0.5')
          if (sur(p.avis)) {
            lien.href = p.avis
            lien.target = '_blank'
            lien.rel = 'noopener'
            lien.title = T.avis
          }
          const img = el('img', 'block h-auto max-w-full')
          img.src = p.badge
          img.alt = ''
          img.width = 264
          img.height = 76
          img.loading = 'lazy'
          lien.append(img)
          carte.append(lien)
        }
        if (web(p.site)) {
          const a = el('a', 'mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brique hover:text-brique-fonce', `${T.visiter} ↗`)
          a.href = p.site
          a.target = '_blank'
          a.rel = 'noopener'
          carte.append(a)
        }
        return carte
      })
      racine.replaceChildren(...cartes)
      racine.setAttribute('aria-busy', 'false')
    })
    .catch(() => message(T.erreur))
})()
