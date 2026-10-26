// Animations du site.
//
// Trois règles : sans ce script, tout est visible et lisible ; si le visiteur
// a demandé de réduire les animations, il n'y en a aucune ; et chaque
// mouvement sert à guider l'œil — jamais à en mettre plein la vue.
;(() => {
  const annee = document.getElementById('annee')
  if (annee) annee.textContent = String(new Date().getFullYear())

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fmt = new Intl.NumberFormat(document.documentElement.lang.startsWith('en') ? 'en-CA' : 'fr-CA')
  const ENTETE = 72

  // ---------------------------------------------------------------- entête
  const entete = document.getElementById('entete')
  const majEntete = () => {
    const bas = window.scrollY > 24
    for (const c of ['bg-papier/85', 'backdrop-blur-md', 'shadow-[0_1px_0_#e2d6c3]']) entete.classList.toggle(c, bas)
  }
  majEntete()
  window.addEventListener('scroll', majEntete, { passive: true })

  // ------------------------------------------- démo : barres et carte de chaleur
  // Chiffres inventés, affichés comme tels sur la page.
  const barres = document.getElementById('barres')
  const valeurs = Array.from({ length: 30 }, (_, i) => {
    const jour = (i + 2) % 7
    const base = jour >= 5 ? 78 : jour === 4 ? 62 : 34
    return Math.round(base + 14 * Math.sin(i * 1.7) + i * 0.6)
  })
  const max = Math.max(...valeurs)
  if (barres) {
    for (const v of valeurs) {
      const b = document.createElement('div')
      b.className = 'barre flex-1 origin-bottom rounded-t-[4px] bg-brique'
      b.style.height = `${(v / max) * 100}%`
      barres.appendChild(b)
    }
  }
  const chaleur = document.getElementById('chaleur')
  // Une seule teinte, du sable (calme) à la terre cuite foncée (rush).
  const RAMPE = ['#ece2d2', '#f0d2bd', '#e8b394', '#dc8f66', '#c96c41', '#a9512c', '#7e3a1d']
  if (chaleur) {
    for (let j = 0; j < 7; j++) {
      for (let h = 0; h < 24; h++) {
        const ouvert = h >= 7 && h <= 21
        const midi = Math.exp(-((h - 12.5) ** 2) / 4)
        const soir = Math.exp(-((h - 18) ** 2) / 3) * 0.8
        const matin = Math.exp(-((h - 8.5) ** 2) / 2) * 0.6
        const fds = j >= 4 ? 1.35 : 1
        const n = ouvert ? Math.min(6, Math.round((midi + soir + matin) * 4 * fds + 0.5)) : 0
        const c = document.createElement('div')
        c.className = 'case'
        c.style.background = RAMPE[n]
        chaleur.appendChild(c)
      }
    }
  }

  // ------------------------------------------------- calculette des prix
  // À l'unité : 35 $ la carte. Dès 25 cartes, l'offre
  // Entreprise (30 $ la carte, design sur mesure) est proposée à côté.
  const PRIX_QC = 35
  const PRIX_ENTREPRISE = 30
  const MIN_ENTREPRISE = 25
  const calculette = document.getElementById('calculette')
  if (calculette) {
    const fr = calculette.dataset.langue !== 'en'
    // « 35 $ » plutôt que « 35,00 $ » : pas de ,00 inutile.
    const argent = { format: (v) => new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v) }
    const nbEl = document.getElementById('nb-cartes')
    const totalEl = document.getElementById('total-cartes')
    const detailEl = document.getElementById('detail-cartes')
    const lien = document.getElementById('commander-calcul')
    const conseil = document.getElementById('conseil-entreprise')
    const conseilTexte = document.getElementById('conseil-texte')
    const puces = [...calculette.querySelectorAll('[data-nb]')]
    let n = 3
    const majPrix = (anime) => {
      const total = n * PRIX_QC
      nbEl.textContent = String(n)
      totalEl.textContent = argent.format(total)
      detailEl.textContent = fr ? `${argent.format(PRIX_QC)} la carte · à l’unité` : `${argent.format(PRIX_QC)} per card · individual cards`
      for (const p of puces) p.setAttribute('aria-pressed', String(Number(p.dataset.nb) === n))
      if (conseil && conseilTexte) {
        const entreprise = n >= MIN_ENTREPRISE
        conseil.hidden = !entreprise
        if (entreprise) {
          const t = n * PRIX_ENTREPRISE
          conseilTexte.textContent = fr
            ? `En Entreprise : ${argent.format(PRIX_ENTREPRISE)} la carte, design sur mesure → ${argent.format(t)} (${argent.format(total - t)} d’économie).`
            : `As a Business order: ${argent.format(PRIX_ENTREPRISE)} per card, custom design → ${argent.format(t)} (save ${argent.format(total - t)}).`
        }
      }
      const sujet = calculette.dataset.sujet
      const corps = fr
        ? `Bonjour,\n\nNom du commerce : \nVille et province (ou pays) : \nNombre de cartes à l’unité : ${n} (${argent.format(total)})\n\nMerci !`
        : `Hi,\n\nBusiness name: \nCity and province (or country): \nNumber of individual cards: ${n} (${argent.format(total)})\n\nThanks!`
      lien.href = `mailto:contact@taporacards.com?subject=${sujet}&body=${encodeURIComponent(corps)}`
      lien.textContent = fr ? `Commander ${n} carte${n > 1 ? 's' : ''}` : `Order ${n} card${n > 1 ? 's' : ''}`
      if (anime && !reduit) totalEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.4)' })
    }
    calculette.querySelector('[data-moins]').addEventListener('click', () => { if (n > 1) { n--; majPrix(true) } })
    calculette.querySelector('[data-plus]').addEventListener('click', () => { if (n < 500) { n++; majPrix(true) } })
    for (const p of puces) p.addEventListener('click', () => { n = Number(p.dataset.nb); majPrix(true) })
    majPrix(false)
  }

  // ------------------------------------------- demande Entreprise (formulaire)
  // Envoyée au back-office (go.taporacards.com) : un envoi « simple »
  // (urlencoded, sans témoin), donc sans requête préalable. Si le serveur ne
  // répond pas, la demande part par courriel, déjà rédigée.
  const formE = document.getElementById('form-entreprise')
  if (formE) {
    const fr = formE.dataset.langue !== 'en'
    const T = fr
      ? {
          nom: 'Indiquez votre nom.',
          entreprise: 'Indiquez le nom de l’entreprise.',
          courriel: 'Indiquez un courriel valide.',
          quantite: 'L’offre Entreprise commence à 25 cartes.',
          envoi: 'Envoi…',
          patience: 'Encore un instant…',
          erreur: 'Envoi impossible pour le moment.',
          corps: (d) => `Bonjour,\n\nNom : ${d.nom}\nEntreprise : ${d.entreprise}\nCourriel : ${d.courriel}\nTéléphone : ${d.telephone || '—'}\nNombre de cartes : ${d.quantite}\nLieu : ${d.lieu === 'QC' ? 'Au Québec' : 'Hors Québec'}\n\n${d.message || ''}\n\nMerci !`,
        }
      : {
          nom: 'Please enter your name.',
          entreprise: 'Please enter your business name.',
          courriel: 'Please enter a valid email.',
          quantite: 'Business orders start at 25 cards.',
          envoi: 'Sending…',
          patience: 'Almost there…',
          erreur: 'Can’t send right now.',
          corps: (d) => `Hi,\n\nName: ${d.nom}\nBusiness: ${d.entreprise}\nEmail: ${d.courriel}\nPhone: ${d.telephone || '—'}\nNumber of cards: ${d.quantite}\nLocation: ${d.lieu === 'QC' ? 'In Québec' : 'Outside Québec'}\n\n${d.message || ''}\n\nThanks!`,
        }
    const champT = formE.querySelector('[name=t]')
    if (champT) champT.value = String(Date.now())
    const etat = document.getElementById('etat-entreprise')
    const bouton = document.getElementById('envoyer-entreprise')
    const libelle = bouton.querySelector('[data-libelle]')
    const libelleBase = libelle.textContent
    const secours = document.getElementById('secours-entreprise')
    const secoursLien = document.getElementById('secours-lien')
    const merci = document.getElementById('merci-entreprise')
    const aideLieu = document.getElementById('e-lieu-aide')
    formE.querySelectorAll('[name=lieu]').forEach((r) =>
      r.addEventListener('change', () => { if (aideLieu) aideLieu.textContent = r.value === 'QC' ? aideLieu.dataset.qc : aideLieu.dataset.hqc }),
    )
    const COURRIEL = /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i
    const marquer = (champ, faux) => (faux ? champ.setAttribute('aria-invalid', 'true') : champ.removeAttribute('aria-invalid'))
    formE.querySelectorAll('.champ-site').forEach((c) => c.addEventListener('input', () => marquer(c, false)))

    const valider = (d) => {
      const verifs = [
        ['nom', d.nom.trim().length > 0, T.nom],
        ['entreprise', d.entreprise.trim().length > 0, T.entreprise],
        ['courriel', COURRIEL.test(d.courriel.trim()), T.courriel],
        ['quantite', /^\d+$/.test(d.quantite.trim()) && Number(d.quantite) >= 25 && Number(d.quantite) <= 5000, T.quantite],
      ]
      let premier = null
      for (const [nom, ok, message] of verifs) {
        const champ = formE.querySelector(`[name=${nom}]`)
        marquer(champ, !ok)
        if (!ok && !premier) premier = { champ, message }
      }
      return premier
    }

    formE.addEventListener('submit', async (e) => {
      e.preventDefault()
      const d = Object.fromEntries(new FormData(formE))
      etat.textContent = ''
      secours.hidden = true
      const faute = valider(d)
      if (faute) {
        etat.textContent = faute.message
        faute.champ.focus()
        return
      }
      bouton.disabled = true
      libelle.textContent = T.envoi
      const patience = setTimeout(() => (libelle.textContent = T.patience), 6000)
      // Le serveur gratuit peut dormir : on lui laisse le temps de se réveiller.
      const arret = new AbortController()
      const delai = setTimeout(() => arret.abort(), 45000)
      let reponse = null
      try {
        const r = await fetch('https://go.taporacards.com/api/demande-entreprise', {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          body: new URLSearchParams(d),
          signal: arret.signal,
        })
        reponse = await r.json().catch(() => null)
      } catch {
        reponse = null
      }
      clearTimeout(patience)
      clearTimeout(delai)
      bouton.disabled = false
      libelle.textContent = libelleBase
      if (reponse && reponse.ok === true) {
        formE.hidden = true
        merci.hidden = false
        merci.focus({ preventScroll: true })
        if (!reduit) merci.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' })
        return
      }
      if (reponse && typeof reponse.erreur === 'string' && reponse.erreur) {
        etat.textContent = reponse.erreur
        return
      }
      // Pas de réponse lisible : la demande part par courriel, déjà rédigée.
      etat.textContent = T.erreur
      secoursLien.href = `mailto:contact@taporacards.com?subject=${formE.dataset.sujet}&body=${encodeURIComponent(T.corps(d))}`
      secours.hidden = false
    })
  }

  // ------------------------------------------------------ Tapora Entreprise
  // Catalogue filtré, onglets des secteurs, exemples de commande, calculette,
  // démo « une carte, plusieurs actions ». Tout fonctionne sans animation
  // (anime = false : réduire les animations, ou GSAP absent) ; avec, chaque
  // geste a son mouvement. Rien ne tourne hors de /entreprise et /en/business.
  const pageEntreprise = (anime, arrivee) => {
    if (!document.getElementById('scene-entreprise')) return
    const { gsap, ScrollTrigger } = window
    const en = document.documentElement.lang.startsWith('en')
    const NB = ' '
    const nombre = (v) => new Intl.NumberFormat(en ? 'en-CA' : 'fr-CA').format(v)
    const argent = (v) => (en ? `$${nombre(v)}` : `${nombre(v)}${NB}$`)
    const finePointe = window.matchMedia('(pointer: fine)').matches

    // ---- Le catalogue : les totaux suivent les attributs data-etat.
    const liste = document.getElementById('ep-fonctions')
    let lotsCatalogue = []
    if (liste) {
      const items = [...liste.children]
      const compte = (etat) => items.filter((i) => etat === 'tous' || i.dataset.etat === etat).length
      document.getElementById('ep-total-disponible').textContent = String(compte('disponible'))
      document.getElementById('ep-total-bientot').textContent = String(compte('bientot'))
      document.querySelectorAll('[data-nombre-etat]').forEach((el) => (el.textContent = String(compte(el.dataset.nombreEtat))))
      const vide = document.getElementById('ep-vide')
      const puces = [...document.querySelectorAll('[data-filtre-etat], [data-filtre-cat]')]
      const filtre = { etat: 'tous', cat: 'tous' }
      let jeton = 0
      let touche = false
      const correspond = (el) => (filtre.etat === 'tous' || el.dataset.etat === filtre.etat) && (filtre.cat === 'tous' || el.dataset.cat === filtre.cat)
      const appliquer = () => {
        const n = ++jeton
        vide.classList.toggle('hidden', items.some(correspond))
        if (!anime) {
          items.forEach((el) => (el.hidden = !correspond(el)))
          return
        }
        // La première fois, tout ce qui attendait d'apparaître au défilement est montré.
        if (!touche) {
          touche = true
          lotsCatalogue.forEach((t) => t.kill())
          gsap.set(items, { opacity: 1, y: 0 })
        }
        gsap.killTweensOf(items)
        const sortants = items.filter((el) => !el.hidden && !correspond(el))
        const restants = items.filter((el) => !el.hidden && correspond(el))
        const entrants = items.filter((el) => el.hidden && correspond(el))
        const fin = () => {
          if (n !== jeton) return
          const avant = new Map(restants.map((el) => [el, el.getBoundingClientRect()]))
          gsap.set(restants, { x: 0, y: 0 })
          sortants.forEach((el) => {
            el.hidden = true
            gsap.set(el, { clearProps: 'opacity,scale,transform' })
          })
          entrants.forEach((el) => (el.hidden = false))
          // FLIP : chaque fonction qui reste glisse de son ancienne place à la nouvelle.
          restants.forEach((el) => {
            const a = avant.get(el)
            const b = el.getBoundingClientRect()
            gsap.fromTo(el, { x: a.left - b.left, y: a.top - b.top, opacity: 1, scale: 1 }, { x: 0, y: 0, duration: 0.65, ease: 'power3.out' })
          })
          gsap.fromTo(entrants, { opacity: 0, scale: 0.92, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: Math.min(0.03, 0.6 / Math.max(1, entrants.length)), delay: 0.08 })
          ScrollTrigger?.refresh()
        }
        if (sortants.length) gsap.to(sortants, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in', onComplete: fin })
        else fin()
      }
      puces.forEach((p) =>
        p.addEventListener('click', () => {
          const cle = p.dataset.filtreEtat !== undefined ? 'etat' : 'cat'
          filtre[cle] = cle === 'etat' ? p.dataset.filtreEtat : p.dataset.filtreCat
          puces.filter((q) => (cle === 'etat' ? q.dataset.filtreEtat !== undefined : q.dataset.filtreCat !== undefined)).forEach((q) => q.setAttribute('aria-pressed', String(q === p)))
          appliquer()
        }),
      )
      if (anime) {
        gsap.set(items, { opacity: 0, y: 18 })
        lotsCatalogue = ScrollTrigger.batch(items, {
          start: 'top 92%',
          once: true,
          onEnter: (lot) => gsap.to(lot, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.05, overwrite: true }),
        })
      }
    }

    // ---- Les secteurs : des onglets, une pastille qui glisse sous le choisi.
    const tablist = document.querySelector('#secteurs [role=tablist]')
    if (tablist) {
      const onglets = [...tablist.querySelectorAll('[role=tab]')]
      const panneaux = onglets.map((o) => document.getElementById(o.getAttribute('aria-controls')))
      const pastille = document.getElementById('ep-indicateur')
      tablist.classList.add('ep-avec-indicateur')
      let courant = Math.max(0, onglets.findIndex((o) => o.getAttribute('aria-selected') === 'true'))
      const placer = (glisse) => {
        const o = onglets[courant]
        const cible = { x: o.offsetLeft - 6, width: o.offsetWidth }
        if (glisse && anime) gsap.to(pastille, { ...cible, duration: 0.55, ease: 'power3.out' })
        else if (anime) gsap.set(pastille, cible)
        else {
          pastille.style.width = `${cible.width}px`
          pastille.style.transform = `translateX(${cible.x}px)`
        }
      }
      const choisir = (i, focus) => {
        if (i === courant && !focus) return
        const ancien = panneaux[courant]
        courant = i
        onglets.forEach((o, k) => {
          o.setAttribute('aria-selected', String(k === i))
          o.tabIndex = k === i ? 0 : -1
        })
        panneaux.forEach((p, k) => (p.hidden = k !== i))
        if (focus) onglets[i].focus()
        onglets[i].scrollIntoView({ block: 'nearest', inline: 'nearest' })
        placer(true)
        if (anime && ancien !== panneaux[i]) {
          const fond = panneaux[i].querySelector('.ep-panneau-fond')
          gsap.fromTo(fond, { opacity: 0, y: 22, rotateX: -6, transformPerspective: 900 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.6, ease: 'power3.out' })
          gsap.fromTo(panneaux[i].querySelectorAll('.ep-ligne, .ep-emplacements li'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.035, delay: 0.1 })
        }
      }
      panneaux.forEach((p, k) => (p.hidden = k !== courant))
      onglets.forEach((o, i) => o.addEventListener('click', () => choisir(i, false)))
      tablist.addEventListener('keydown', (e) => {
        const dernier = onglets.length - 1
        const i = { ArrowRight: courant + 1, ArrowLeft: courant - 1, Home: 0, End: dernier }[e.key]
        if (i === undefined) return
        e.preventDefault()
        choisir(i < 0 ? dernier : i > dernier ? 0 : i, true)
      })
      placer(false)
      window.addEventListener('resize', () => placer(false))
      document.fonts?.ready.then(() => placer(false))
    }

    // ---- Les exemples de commande : une barre empilée par zone.
    const repartition = document.getElementById('ep-repartition')
    if (repartition) {
      const scenarios = JSON.parse(repartition.dataset.scenarios)
      const boutons = [...repartition.querySelectorAll('[data-scenario]')]
      const barre = document.getElementById('ep-barre')
      const legende = document.getElementById('ep-legende')
      const cartesEl = document.getElementById('ep-repartition-cartes')
      const totalEl = document.getElementById('ep-repartition-total')
      const compteurs = { cartes: Number(cartesEl.textContent) || 0 }
      const rendre = (s, glisse) => {
        const total = s.seg.reduce((t, x) => t + x.n, 0)
        barre.replaceChildren(
          ...s.seg.map((x) => {
            const b = document.createElement('span')
            b.className = 'ep-segment'
            b.style.flexGrow = String(x.n)
            b.style.background = x.couleur
            return b
          }),
        )
        legende.replaceChildren(
          ...s.seg.map((x) => {
            const li = document.createElement('li')
            li.className = 'flex items-center justify-between gap-3'
            const gauche = document.createElement('span')
            gauche.className = 'flex min-w-0 items-center gap-2.5'
            const point = document.createElement('span')
            point.className = 'size-3 shrink-0 rounded-full'
            point.style.background = x.couleur
            const nom = document.createElement('span')
            nom.textContent = `${x.nom} `
            const dest = document.createElement('span')
            dest.className = 'text-encre-doux'
            dest.textContent = `· ${x.dest}`
            nom.appendChild(dest)
            gauche.append(point, nom)
            const n = document.createElement('strong')
            n.textContent = String(x.n)
            li.append(gauche, n)
            return li
          }),
        )
        if (glisse && anime) {
          gsap.fromTo(barre.children, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08 })
          gsap.fromTo(legende.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 })
          gsap.to(compteurs, { cartes: total, duration: 0.9, ease: 'power2.out', onUpdate: () => {
            const v = Math.round(compteurs.cartes)
            cartesEl.textContent = String(v)
            totalEl.textContent = argent(v * 30)
          } })
        } else {
          compteurs.cartes = total
          cartesEl.textContent = String(total)
          totalEl.textContent = argent(total * 30)
        }
      }
      boutons.forEach((b) =>
        b.addEventListener('click', () => {
          boutons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
          rendre(scenarios.find((s) => s.id === b.dataset.scenario), true)
        }),
      )
      if (anime) {
        gsap.from(barre.children, { scaleX: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: barre, start: 'top 85%', once: true } })
      }
    }

    // ---- La calculette : 30 $ la carte, et jamais moins de 25.
    const champ = document.getElementById('ep-nb')
    if (champ) {
      const detail = document.getElementById('ep-detail')
      const total = document.getElementById('ep-total')
      const resultat = document.getElementById('ep-resultat')
      const minimum = document.getElementById('ep-minimum')
      const puces = [...document.querySelectorAll('[data-ep-nb]')]
      const maj = (pop) => {
        let n = Math.round(Number(champ.value))
        if (!Number.isFinite(n) || n < 0) n = 0
        const ok = n >= 25
        minimum.classList.toggle('hidden', ok)
        resultat.classList.toggle('hidden', !ok)
        puces.forEach((p) => p.setAttribute('aria-pressed', String(Number(p.dataset.epNb) === n)))
        if (!ok) return
        detail.textContent = en ? `${nombre(n)} cards × $30` : `${nombre(n)} cartes × 30${NB}$`
        total.textContent = argent(n * 30)
        if (pop && anime) gsap.fromTo(total, { scale: 1.12 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' })
      }
      const fixer = (n) => {
        champ.value = String(Math.min(5000, Math.max(1, n)))
        maj(true)
      }
      champ.addEventListener('input', () => maj(true))
      document.querySelector('[data-ep-moins]').addEventListener('click', () => fixer((Number(champ.value) || 0) - 1))
      document.querySelector('[data-ep-plus]').addEventListener('click', () => fixer((Number(champ.value) || 0) + 1))
      puces.forEach((p) => p.addEventListener('click', () => fixer(Number(p.dataset.epNb))))
      maj(false)
    }

    // ---- La démo « une carte, plusieurs actions » : une option, son explication.
    const options = [...document.querySelectorAll('[data-option]')]
    if (options.length) {
      const zone = document.getElementById('ep-option-detail')
      const panneaux = [...zone.querySelectorAll('[data-option-panneau]')]
      zone.classList.add('ep-avec-choix')
      let auto = null
      const choisir = (cle, glisse) => {
        options.forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.option === cle)))
        panneaux.forEach((p) => (p.hidden = p.dataset.optionPanneau !== cle))
        const p = panneaux.find((x) => x.dataset.optionPanneau === cle)
        if (glisse && anime) {
          gsap.fromTo(p, { opacity: 0, y: 14, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' })
          const o = options.find((x) => x.dataset.option === cle)
          gsap.fromTo(o, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' })
        }
      }
      options.forEach((o) =>
        o.addEventListener('click', () => {
          clearInterval(auto)
          auto = 'fini'
          choisir(o.dataset.option, true)
        }),
      )
      choisir(options[0].dataset.option, false)
      // Tant que personne n'a touché, la démo se présente toute seule.
      if (anime) {
        let i = 0
        ScrollTrigger.create({
          trigger: '#demo',
          start: 'top 70%',
          end: 'bottom 30%',
          onToggle: (st) => {
            if (auto === 'fini') return
            clearInterval(auto)
            auto = st.isActive
              ? setInterval(() => {
                  i = (i + 1) % options.length
                  choisir(options[i].dataset.option, true)
                }, 3200)
              : null
          },
        })
      }
    }

    if (!anime) {
      document.querySelector('.ep-jalon[data-jalon="0"]')?.classList.add('actif')
      return
    }

    // ================================================================= animé
    // ---- Arrivée : la carte de l'hôtel, puis le téléphone.
    if (arrivee) {
      arrivee
        .from('#ep-plan', { scale: 0.92, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.25)
        .from('#ep-carte', { y: 70, rotation: -16, opacity: 0, duration: 1.1, ease: 'back.out(1.5)' }, 0.5)
        .from('#ep-telephone', { x: 70, y: 30, rotation: 18, opacity: 0, duration: 1.1, ease: 'back.out(1.3)' }, 0.7)
        .from('.ep-destination', { y: -14, opacity: 0, duration: 0.7, ease: 'back.out(1.8)' }, 1)
        .from('#ep-note', { opacity: 0, y: 10, duration: 0.8 }, 1.3)
    }
    const scene = document.getElementById('scene-entreprise')
    gsap.to('#ep-plan', { y: 30, ease: 'none', scrollTrigger: { trigger: scene, start: 'top 20%', end: 'bottom top', scrub: 0.6 } })

    // ---- Le tap, en boucle : le téléphone touche la carte, les ondes partent,
    // l'écran change de destination. Hors de l'écran, la scène se repose.
    const telephone = document.getElementById('ep-telephone')
    const ecrans = gsap.utils.toArray('#ep-telephone .ep-ecran')
    const libelle = document.getElementById('ep-destination')
    gsap.set(ecrans, { opacity: 0 })
    gsap.set(ecrans[0], { opacity: 1 })
    gsap.to('#ep-carte', { y: -6, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.8 })
    const tap = gsap.timeline({ repeat: -1, delay: 2.4 })
    ecrans.forEach((ecran, k) => {
      const suivant = ecrans[(k + 1) % ecrans.length]
      tap
        .to(telephone, { x: () => -scene.clientWidth * 0.16, y: () => -scene.clientHeight * 0.16, rotation: -9, duration: 0.9, ease: 'power2.inOut' })
        .fromTo('.ep-onde', { scale: 0.5, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 1.1, ease: 'power2.out', stagger: 0.16 }, '-=0.12')
        .to('#ep-lueur', { opacity: 1, duration: 0.14, yoyo: true, repeat: 1 }, '<')
        .to(ecran, { opacity: 0, duration: 0.25 }, '<0.1')
        .to(suivant, { opacity: 1, duration: 0.35 }, '<')
        .add(() => {
          libelle.textContent = suivant.dataset.libelle
          gsap.fromTo(libelle, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' })
        }, '<')
        .to(telephone, { x: 0, y: 0, rotation: 0, duration: 0.95, ease: 'power2.inOut' }, '+=0.15')
        .to({}, { duration: 1.5 })
    })
    ScrollTrigger.create({ trigger: scene, start: 'top bottom', end: 'bottom top', onToggle: (st) => (st.isActive ? tap.play() : tap.pause()) })

    // ---- L'inclinaison 3D avec reflet, et les boutons aimantés.
    if (finePointe) {
      document.querySelectorAll('[data-incline]').forEach((el) => {
        gsap.set(el, { transformPerspective: 1000 })
        const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' })
        const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
        const reflet = el.querySelector(':scope > .ep-reflet')
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          rx(-py * 9)
          ry(px * 11)
          if (reflet) gsap.to(reflet, { opacity: 1, x: px * r.width * 0.7, y: py * r.height * 0.7, duration: 0.4, overwrite: true })
        })
        el.addEventListener('pointerleave', () => {
          rx(0)
          ry(0)
          if (reflet) gsap.to(reflet, { opacity: 0, duration: 0.6, overwrite: true })
        })
      })
      document.querySelectorAll('[data-aimant]').forEach((el) => {
        const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
        const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect()
          x((e.clientX - r.left - r.width / 2) * 0.28)
          y((e.clientY - r.top - r.height / 2) * 0.35)
        })
        el.addEventListener('pointerleave', () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', overwrite: true })
        })
      })
    }

    // ---- Les trois niveaux se posent comme des cartes lancées sur la table.
    gsap.from('.ep-niveau', { y: 80, rotation: (i) => [-6, 4, -4][i] ?? 0, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.13, scrollTrigger: { trigger: '#niveaux .ep-niveau', start: 'top 88%', once: true } })
    gsap.from('#ep-portail', { y: 60, rotation: 4, opacity: 0, duration: 1.1, ease: 'back.out(1.3)', scrollTrigger: { trigger: '#ep-portail', start: 'top 85%', once: true } })
    gsap.fromTo('#ep-portail .ep-option', { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: '#ep-portail', start: 'top 80%', once: true } })

    // ---- La plateforme : le tableau se remplit, les fonctions arrivent par lots.
    gsap.from('.ep-jauge', { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '#ep-tableau', start: 'top 80%', once: true } })
    gsap.set('.ep-plateforme', { opacity: 0, y: 20 })
    ScrollTrigger.batch('.ep-plateforme', { start: 'top 92%', once: true, onEnter: (lot) => gsap.to(lot, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, overwrite: true }) })

    // ---- La frise : septembre, le menu ; décembre, les fêtes ; janvier, retour.
    const frise = document.getElementById('ep-frise')
    if (frise) {
      frise.classList.add('ep-frise-anime')
      const jalons = [...frise.querySelectorAll('.ep-jalon')]
      const etapes = [...frise.querySelectorAll('.ep-etape-frise')]
      const ecransF = [...frise.querySelectorAll('.ep-frise-ecran')]
      const cible = document.getElementById('ep-frise-cible')
      const activer = (i) => {
        jalons.forEach((j, k) => j.classList.toggle('actif', k === i))
        etapes.forEach((e, k) => e.classList.toggle('actif', k === i))
        const ecran = i === 1 ? ecransF[1] : ecransF[0]
        gsap.to(ecransF, { opacity: (k) => (ecransF[k] === ecran ? 1 : 0), duration: 0.45 })
        cible.textContent = ecran.dataset.cible
        gsap.fromTo(cible, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
      }
      activer(0)
      const plein = document.getElementById('ep-frise-plein')
      const boucle = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true })
      boucle
        .set(plein, { width: '0%' })
        .add(() => activer(0))
        .to({}, { duration: 1.4 })
        .to(plein, { width: 'calc(50% - 8px)', duration: 1.1, ease: 'power2.inOut' })
        .add(() => activer(1))
        .to({}, { duration: 1.8 })
        .to(plein, { width: 'calc(100% - 16px)', duration: 1.1, ease: 'power2.inOut' })
        .add(() => activer(2))
        .to({}, { duration: 1.6 })
      ScrollTrigger.create({ trigger: frise, start: 'top 85%', end: 'bottom 10%', onToggle: (st) => (st.isActive ? boucle.play() : boucle.pause()) })
    }

    // ---- La comparaison, ligne par ligne ; la colonne Entreprise se lève.
    gsap.from('#ep-lignes-comparaison tr', { x: -16, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, scrollTrigger: { trigger: '#ep-lignes-comparaison', start: 'top 85%', once: true } })

    // ---- La phrase de la vision s'allume mot à mot, au rythme du défilement.
    const vision = document.getElementById('ep-vision')
    if (vision) {
      const mots = vision.textContent.trim().split(/\s+/)
      vision.textContent = ''
      const spans = mots.map((m, i) => {
        const s = document.createElement('span')
        s.textContent = m
        vision.append(s)
        if (i < mots.length - 1) vision.append(' ')
        return s
      })
      gsap.fromTo(spans, { opacity: 0.14 }, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: vision, start: 'top 80%', end: 'bottom 45%', scrub: 0.5 } })
      gsap.to(spans.slice(-2), { color: '#c2552f', stagger: 0.1, scrollTrigger: { trigger: vision, start: 'bottom 60%', once: true } })
    }

    // ---- La citation se pose ; la feuille de route se dessine.
    gsap.from('#ep-citation', { y: 40, rotation: -2, opacity: 0, duration: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#ep-citation', start: 'top 85%', once: true } })
    gsap.fromTo('#ep-route-ligne', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#ep-route', start: 'top 75%', end: 'bottom 60%', scrub: 0.5 } })
    gsap.utils.toArray('.ep-phase').forEach((phase) => {
      gsap
        .timeline({ scrollTrigger: { trigger: phase, start: 'top 82%', once: true } })
        .from(phase.querySelector('.ep-phase-point'), { scale: 0, duration: 0.5, ease: 'back.out(2.4)' })
        .from(phase.querySelectorAll(':scope > :not(.ep-phase-point)'), { x: -18, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.07 }, '-=0.25')
    })

    // ---- Le bloc final : la carte se pose, puis ses ondes s'étendent.
    gsap
      .timeline({ scrollTrigger: { trigger: '#contact', start: 'top 80%', once: true } })
      .from('#ep-ondes .ep-carte-cta', { y: 40, rotation: -12, opacity: 0, svgOrigin: '34 46', duration: 1, ease: 'back.out(1.6)' })
      .from('#ep-ondes .ep-arc', { scale: 0.3, opacity: 0, svgOrigin: '60 41', duration: 0.8, ease: 'power3.out', stagger: 0.14 }, '-=0.45')
  }

  // FAQ : sans animation, le comportement natif de <details> suffit.
  const faq = [...document.querySelectorAll('#faq details')]

  // ------------------------------------------------------------------ GSAP
  const montrer = () => document.documentElement.classList.remove('attente')
  const demarrer = () => {
    const { gsap, ScrollTrigger, Lenis } = window
    if (!gsap || !ScrollTrigger || reduit) {
      pageEntreprise(false, null)
      return montrer()
    }
    gsap.registerPlugin(ScrollTrigger)
    // Les guides n'ont pas le décor de l'accueil : pas d'avertissement pour les cibles absentes.
    gsap.config({ nullTargetWarn: false })

    // ---- Défilement fluide, synchronisé avec les animations.
    let lenis = null
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.25 })
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add((t) => lenis.raf(t * 1000))
      gsap.ticker.lagSmoothing(0)
    }
    // Les liens d'ancre glissent jusqu'à la section, sous l'entête.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href')
        const cible = id && id.length > 1 ? document.querySelector(id) : null
        if (!cible) return
        e.preventDefault()
        // Lenis tient déjà compte du scroll-margin des sections (80 px) : on n'en
        // garde qu'un peu, l'entête se range de toute façon en descendant.
        if (lenis) lenis.scrollTo(cible, { offset: ENTETE - 56, duration: 1.4, easing: (x) => 1 - Math.pow(1 - x, 4) })
        else cible.scrollIntoView({ behavior: 'smooth' })
        history.replaceState(null, '', id)
      })
    })

    // ---- Barre de progression, en haut.
    gsap.to('#progression', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } })

    // ---- L'entête se range quand on descend, revient quand on remonte.
    const cacher = gsap.to(entete, { yPercent: -110, duration: 0.45, ease: 'power3.inOut', paused: true })
    ScrollTrigger.create({
      start: 'top top',
      end: 'max',
      onUpdate: (st) => (st.direction === 1 && st.scroll() > 260 ? cacher.play() : cacher.reverse()),
    })

    // ---- Le menu suit la section où l'on se trouve.
    document.querySelectorAll('.lien-nav[href^="#"]').forEach((lien) => {
      const section = document.querySelector(lien.getAttribute('href'))
      if (!section) return
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (st) => lien.classList.toggle('actif', st.isActive),
      })
    })

    // ---- Arrivée : l'entête, le titre, puis le comptoir se dresse objet par objet.
    const arrivee = gsap.timeline({ defaults: { ease: 'power3.out' } })
    arrivee
      .from(entete, { y: -24, opacity: 0, duration: 0.8 })
      .from('.titre-ligne', { y: 34, opacity: 0, duration: 1.1, stagger: 0.13 }, 0.1)
      .from('#plan', { scale: 0.92, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.25)
      .from('#tasse', { x: -50, rotation: -25, opacity: 0, duration: 1 }, 0.5)
      .from('#carte', { y: 70, rotation: -14, opacity: 0, duration: 1.1, ease: 'back.out(1.5)' }, 0.6)
      .from('#telephone', { x: 70, y: 30, rotation: 18, opacity: 0, duration: 1.1, ease: 'back.out(1.3)' }, 0.75)
      .from('#gommette', { scale: 0, rotation: -120, duration: 1, ease: 'back.out(2)' }, 1)
      .from('#note-main', { opacity: 0, y: 10, duration: 0.8 }, 1.3)

    // Tout ce qui précède a posé ses états de départ : on peut lever le voile.
    montrer()

    // Le trait jaune sous les mots soulignés se dessine.
    gsap.utils.toArray('.souligne .trait').forEach((trait, i) => {
      const l = trait.getTotalLength()
      gsap.set(trait, { strokeDasharray: l, strokeDashoffset: l })
      const dessin = { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }
      if (i === 0) arrivee.to(trait, dessin, 0.95)
      else gsap.to(trait, { ...dessin, delay: 0.5, scrollTrigger: { trigger: trait, start: 'top 85%', once: true } })
    })
    const fleche = document.querySelector('#note-main .trait')
    if (fleche) {
      const l = fleche.getTotalLength()
      arrivee.fromTo(fleche, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, 1.4)
    }

    // ---- Profondeur : en quittant le héros, chaque objet glisse à sa vitesse.
    const parallaxe = { trigger: '#scene', start: 'top 20%', end: 'bottom top', scrub: 0.6 }
    gsap.to('#tasse', { y: -40, rotation: 8, ease: 'none', scrollTrigger: parallaxe })
    gsap.to('#gommette', { y: -110, rotation: 60, ease: 'none', scrollTrigger: parallaxe })
    gsap.to('#plan', { y: 30, ease: 'none', scrollTrigger: parallaxe })

    // ---- Titres de section : mot à mot, derrière un masque.
    document.querySelectorAll('[data-mots]').forEach((titre) => {
      const mots = []
      const decouper = (noeud) => {
        for (const enfant of [...noeud.childNodes]) {
          if (enfant.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment()
            for (const m of enfant.textContent.split(/(\s+)/)) {
              if (!m) continue
              if (/^\s+$/.test(m)) {
                frag.appendChild(document.createTextNode(m))
                continue
              }
              const masque = document.createElement('span')
              masque.className = 'masque-mot'
              const mot = document.createElement('span')
              mot.className = 'mot'
              mot.textContent = m
              masque.appendChild(mot)
              frag.appendChild(masque)
              mots.push(mot)
            }
            enfant.replaceWith(frag)
          } else if (enfant.nodeType === Node.ELEMENT_NODE && enfant.classList.contains('souligne')) {
            // Un passage souligné reste d'un seul tenant : son trait le suit.
            const masque = document.createElement('span')
            masque.className = 'masque-mot'
            enfant.replaceWith(masque)
            masque.appendChild(enfant)
            enfant.classList.add('mot')
            mots.push(enfant)
          } else if (enfant.nodeType === Node.ELEMENT_NODE) {
            decouper(enfant)
          }
        }
      }
      decouper(titre)
      gsap.from(mots, {
        yPercent: 115,
        rotation: 4,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.045,
        scrollTrigger: { trigger: titre, start: 'top 85%', once: true },
      })
    })

    // ---- Apparitions au défilement, par lots. Cachées par le script, pas
    // par la feuille de style : sans script, rien ne reste invisible.
    gsap.set('[data-apparait]', { opacity: 0, y: 22 })
    ScrollTrigger.batch('[data-apparait]', {
      start: 'top 90%',
      once: true,
      onEnter: (lot) => gsap.to(lot, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.09, overwrite: true }),
    })

    // ---- Les trois étapes se posent comme des fiches lancées sur la table.
    gsap.from('.etape', {
      y: 80,
      rotation: (i) => [-7, 5, -5][i] ?? 0,
      opacity: 0,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: '.etape', start: 'top 88%', once: true },
    })

    // ---- Le carnet de statistiques s'ouvre, puis se remplit.
    const carnet = gsap.timeline({ scrollTrigger: { trigger: '#carnet', start: 'top 80%', once: true } })
    carnet
      .from('#carnet', { y: 60, scale: 0.97, opacity: 0, duration: 1, ease: 'power3.out' })
      .from('#tuiles > div', { y: 18, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' }, '-=0.5')
    if (barres) carnet.from('.barre', { scaleY: 0, duration: 0.9, ease: 'power3.out', stagger: 0.018 }, '-=0.3')
    const ligne = document.getElementById('ligne-avis')
    if (ligne) {
      const l = ligne.getTotalLength()
      carnet
        .fromTo(ligne, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, '<0.2')
        .from('#aire-avis', { opacity: 0, duration: 0.9 }, '-=0.6')
    }
    if (chaleur) {
      gsap.from('#chaleur .case', {
        opacity: 0,
        scale: 0.3,
        duration: 0.5,
        ease: 'back.out(1.8)',
        stagger: { grid: [7, 24], from: 'start', amount: 1.1 },
        scrollTrigger: { trigger: chaleur, start: 'top 88%', once: true },
      })
    }
    document.querySelectorAll('.compteur').forEach((el) => {
      const cible = Number(el.dataset.valeur)
      const etat = { v: 0 }
      gsap.to(etat, {
        v: cible,
        duration: 2,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => (el.textContent = fmt.format(Math.round(etat.v))),
      })
    })

    // ---- Entreprise : les cartes sur mesure se posent en éventail.
    if (document.getElementById('eventail')) {
      gsap.from('#eventail .carte-eventail', {
        y: 70,
        rotation: (i) => [10, -10, 6][i] ?? 0,
        opacity: 0,
        duration: 1.1,
        ease: 'back.out(1.4)',
        stagger: 0.14,
        scrollTrigger: { trigger: '#eventail', start: 'top 80%', once: true },
      })
    }

    // ---- Tableau de comparaison : ligne par ligne.
    gsap.from('#lignes-comparaison tr', {
      x: -16,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.06,
      scrollTrigger: { trigger: '#lignes-comparaison', start: 'top 85%', once: true },
    })

    // ---- Bloc final : la carte arc-en-ciel se pose, puis ses ondes s'étendent.
    gsap
      .timeline({ scrollTrigger: { trigger: '#commander', start: 'top 80%', once: true } })
      .from('#ondes-cta .carte-cta', { y: 40, rotation: -12, opacity: 0, svgOrigin: '40 62', duration: 1, ease: 'back.out(1.6)' })
      .from('#ondes-cta .arc-cta', { scale: 0.3, opacity: 0, svgOrigin: '55 39', duration: 0.8, ease: 'power3.out', stagger: 0.14 }, '-=0.45')

    // ---- Le bandeau suit le défilement : il accélère, et repart à l'envers
    // quand on remonte.
    const ruban = document.querySelector('.bandeau ul')
    if (ruban) {
      ruban.classList.remove('defile')
      const boucle = gsap.to(ruban, { xPercent: -50, duration: 45, ease: 'none', repeat: -1 })
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (st) => {
          const sens = st.direction
          const elan = Math.min(5, 1 + Math.abs(st.getVelocity()) / 400)
          gsap.timeline({ overwrite: true })
            .to(boucle, { timeScale: sens * elan, duration: 0.25 })
            .to(boucle, { timeScale: sens, duration: 1.2, ease: 'power2.out' }, '+=0.2')
        },
      })
    }

    // ---- FAQ : la réponse se déplie et se replie en douceur.
    faq.forEach((d) => {
      const resume = d.querySelector('summary')
      const reponse = d.querySelector('.reponse')
      if (!resume || !reponse) return
      resume.addEventListener('click', (e) => {
        e.preventDefault()
        if (d.open) {
          gsap.to(reponse, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => (d.open = false) })
        } else {
          d.open = true
          gsap.fromTo(reponse, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'height' })
        }
      })
    })

    // ---- Le comptoir : le téléphone s'approche de la carte, la page d'avis
    // s'ouvre, cinq étoiles, un petit mot, et le tap est compté. En boucle.
    const carte = document.getElementById('carte')
    const telephone = document.getElementById('telephone')
    if (carte && telephone) {
      const etoiles = gsap.utils.toArray('#etoiles .etoile')
      const texte = document.getElementById('texte-avis')
      const phrase = 'Super accueil et le meilleur latte du quartier !'
      const ecrit = { n: 0 }
      gsap.to(carte, { y: -6, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.7 })
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 2.6 })
      tl.to(telephone, { x: -70, y: 70, rotation: -10, duration: 1.1, ease: 'power2.inOut' })
        .to('#ecran-attente', { opacity: 0, duration: 0.2 }, '-=0.15')
        .to('#ecran-avis', { opacity: 1, duration: 0.3 }, '<')
        .to(telephone, { x: 0, y: 0, rotation: 0, duration: 1.1, ease: 'power2.inOut' }, '+=0.2')
        .to(etoiles, { color: '#e4a53a', scale: 1.2, duration: 0.18, stagger: 0.13, yoyo: true, repeat: 1 }, '<')
        .set(etoiles, { color: '#e4a53a' })
        .to(ecrit, { n: phrase.length, duration: 1.5, ease: 'none', onUpdate: () => texte && (texte.textContent = phrase.slice(0, Math.round(ecrit.n))) })
        .fromTo('#notif', { opacity: 0, y: 12, rotation: -2 }, { opacity: 1, y: 0, rotation: -2, duration: 0.6, ease: 'back.out(1.6)' }, '-=0.6')
        .to({}, { duration: 1.8 })
        .to(['#ecran-avis', '#notif'], { opacity: 0, duration: 0.45 })
        .to('#ecran-attente', { opacity: 1, duration: 0.3 }, '<')
        .add(() => {
          gsap.set(etoiles, { color: '' })
          if (texte) texte.textContent = ''
          ecrit.n = 0
        })
    }

    // ---- Tapora Services : la tablette de l'équipe et le téléphone du client.
    // Le client touche « Appeler le serveur », la demande arrive sur la
    // tablette, « J'arrive », il le voit, puis il donne son avis. En boucle.
    // Sans animation, la scène montre directement la fin de l'histoire.
    const sceneServices = document.getElementById('scene-services')
    if (sceneServices) {
      arrivee
        .from('#sv-plan', { scale: 0.92, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.25)
        .from('#sv-tablette', { x: -60, y: 20, rotation: -9, opacity: 0, duration: 1.1, ease: 'back.out(1.3)' }, 0.5)
        .from('#sv-telephone', { x: 70, y: 30, rotation: 16, opacity: 0, duration: 1.1, ease: 'back.out(1.3)' }, 0.7)
        .from('#sv-note', { opacity: 0, y: 10, duration: 0.8 }, 1.3)
      const flecheSv = document.querySelector('#sv-note .trait')
      if (flecheSv) {
        const l = flecheSv.getTotalLength()
        arrivee.fromTo(flecheSv, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, 1.4)
      }
      const parallaxeSv = { trigger: sceneServices, start: 'top 20%', end: 'bottom top', scrub: 0.6 }
      gsap.to('#sv-plan', { y: 30, ease: 'none', scrollTrigger: parallaxeSv })
      gsap.to('#sv-tablette', { y: -28, ease: 'none', scrollTrigger: parallaxeSv })

      const compte = document.getElementById('sv-compte')
      const etoilesSv = gsap.utils.toArray('#sv-avis .sv-etoile')
      gsap.set('#sv-demande', { opacity: 0, y: -14 })
      gsap.set(['#sv-suivi', '#sv-avis'], { opacity: 0, y: 8 })
      gsap.set('#sv-envoye', { opacity: 1 })
      gsap.set('#sv-arrive', { opacity: 0 })
      gsap.set('#sv-jarrive', { backgroundColor: 'rgba(255,250,242,0.1)', color: '#fffaf2' })
      gsap.set(etoilesSv, { color: '#e2d6c3' })
      if (compte) compte.textContent = '0'
      // Au recommencement, la frise revient à son début : chaque état repart de lui-même.
      const boucle = gsap.timeline({ repeat: -1, repeatDelay: 1, delay: 2.4 })
      boucle
        .add(() => compte && (compte.textContent = '0'), 0)
        .fromTo('#sv-doigt', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 0)
        .to('#sv-appel', { scale: 0.92, duration: 0.12, ease: 'power2.in' }, 0.22)
        .to('#sv-appel', { scale: 1, duration: 0.35, ease: 'back.out(3)' })
        .to('#sv-doigt', { scale: 2, opacity: 0, duration: 0.55, ease: 'power2.out' }, '<')
        .to('#sv-suivi', { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, '-=0.25')
        .to('#sv-demande', { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' }, '+=0.35')
        .add(() => compte && (compte.textContent = '1'), '<')
        .to('#sv-tablette', { x: 3, duration: 0.06, yoyo: true, repeat: 5, ease: 'none' }, '<')
        .to('#sv-jarrive', { backgroundColor: '#e4a53a', color: '#2a211a', scale: 1.1, duration: 0.22 }, '+=0.9')
        .to('#sv-jarrive', { scale: 1, duration: 0.25, ease: 'back.out(3)' })
        .to('#sv-envoye', { opacity: 0, duration: 0.25 }, '+=0.15')
        .to('#sv-arrive', { opacity: 1, duration: 0.3 }, '<')
        .to('#sv-avis', { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, '+=0.7')
        .to(etoilesSv, { color: '#e4a53a', scale: 1.3, duration: 0.16, stagger: 0.11, ease: 'power2.out' }, '+=0.25')
        .to(etoilesSv, { scale: 1, duration: 0.2, stagger: 0.11 }, '<0.16')
        .to({}, { duration: 2.4 })
        .to(['#sv-demande', '#sv-suivi', '#sv-avis'], { opacity: 0, duration: 0.45 })
      // Hors de l'écran, la scène se repose.
      ScrollTrigger.create({ trigger: sceneServices, start: 'top bottom', end: 'bottom top', onToggle: (st) => (st.isActive ? boucle.play() : boucle.pause()) })
    }

    // ---- Le menu vivant change de langue tout seul, tant qu'on le regarde.
    const menuVivant = document.getElementById('menu-vivant')
    if (menuVivant) {
      const puces = [...menuVivant.querySelectorAll('.puce-langue')]
      const ordre = puces.map((p) => p.dataset.langue)
      const textes = [...menuVivant.querySelectorAll('[data-l-fr]')]
      let i = Math.max(0, ordre.indexOf(document.documentElement.lang.slice(0, 2)))
      let minuterie = null
      const changer = () => {
        i = (i + 1) % ordre.length
        const l = ordre[i]
        const cle = `l${l[0].toUpperCase()}${l.slice(1)}`
        menuVivant.classList.add('change-langue')
        setTimeout(() => {
          for (const el of textes) if (el.dataset[cle]) el.textContent = el.dataset[cle]
          puces.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.langue === l)))
          menuVivant.classList.remove('change-langue')
        }, 260)
      }
      ScrollTrigger.create({
        trigger: menuVivant,
        start: 'top 85%',
        end: 'bottom 15%',
        onToggle: (st) => {
          clearInterval(minuterie)
          if (st.isActive) minuterie = setInterval(changer, 2600)
        },
      })
    }

    // ---- Le chevalet de table se pose ; le bloc démo, comme le bloc final de l'accueil.
    if (document.getElementById('chevalet')) {
      gsap.from('#chevalet', { y: 60, rotation: 6, opacity: 0, duration: 1.1, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#chevalet', start: 'top 85%', once: true } })
    }
    if (document.getElementById('ondes-demo')) {
      gsap
        .timeline({ scrollTrigger: { trigger: '#demo', start: 'top 80%', once: true } })
        .from('#ondes-demo .carte-cta', { y: 40, rotation: -12, opacity: 0, svgOrigin: '40 62', duration: 1, ease: 'back.out(1.6)' })
        .from('#ondes-demo .arc-cta', { scale: 0.3, opacity: 0, svgOrigin: '55 39', duration: 0.8, ease: 'power3.out', stagger: 0.14 }, '-=0.45')
    }

    // ---- Tapora Entreprise (seulement sur ses deux pages).
    pageEntreprise(true, arrivee)

    // Les polices peuvent arriver après : on recalcule les positions.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
  }

  // Les scripts sont chargés en « defer », dans l'ordre : GSAP, ScrollTrigger
  // et Lenis sont déjà là. Inutile d'attendre les images.
  demarrer()
})()
