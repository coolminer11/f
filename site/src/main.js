// Animations du site.
//
// Trois règles : sans ce script, tout est visible et lisible ; si le visiteur
// a demandé de réduire les animations, il n'y en a aucune ; et chaque
// mouvement sert à guider l'œil — jamais à en mettre plein la vue.
;(() => {
  const annee = document.getElementById('annee')
  if (annee) annee.textContent = String(new Date().getFullYear())

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fmt = new Intl.NumberFormat('fr-CA')
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
  // Carte Québec : 35 $ la carte, à l'unité. Dès 25 cartes, l'offre
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
      detailEl.textContent = fr ? `${argent.format(PRIX_QC)} la carte · Carte Québec` : `${argent.format(PRIX_QC)} per card · Québec Card`
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
        ? `Bonjour,\n\nNom du commerce : \nVille : \nNombre de cartes Québec : ${n} (${argent.format(total)})\n\nMerci !`
        : `Hi,\n\nBusiness name: \nCity: \nNumber of Québec Cards: ${n} (${argent.format(total)})\n\nThanks!`
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

  // FAQ : sans animation, le comportement natif de <details> suffit.
  const faq = [...document.querySelectorAll('#faq details')]

  // ------------------------------------------------------------------ GSAP
  const montrer = () => document.documentElement.classList.remove('attente')
  const demarrer = () => {
    const { gsap, ScrollTrigger, Lenis } = window
    if (!gsap || !ScrollTrigger || reduit) return montrer()
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

    // Les polices peuvent arriver après : on recalcule les positions.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
  }

  // Les scripts sont chargés en « defer », dans l'ordre : GSAP, ScrollTrigger
  // et Lenis sont déjà là. Inutile d'attendre les images.
  demarrer()
})()
