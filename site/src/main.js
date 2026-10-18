// Animations du site. Sans ce script (ou sans GSAP), tout est déjà visible et
// lisible ; il ajoute seulement du mouvement — doux. Et rien du tout si le
// visiteur a demandé de réduire les animations.
;(() => {
  const annee = document.getElementById('annee')
  if (annee) annee.textContent = String(new Date().getFullYear())

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fmt = new Intl.NumberFormat('fr-CA')

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

  // ------------------------------------------------------------------ GSAP
  const demarrer = () => {
    const { gsap, ScrollTrigger } = window
    if (!gsap || !ScrollTrigger || reduit) return
    gsap.registerPlugin(ScrollTrigger)

    // Titre : deux lignes qui se posent, puis le trait jaune se dessine.
    gsap.from('.titre-ligne', { y: 26, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.14, delay: 0.1 })
    gsap.utils.toArray('.souligne .trait').forEach((trait, i) => {
      const l = trait.getTotalLength()
      gsap.fromTo(
        trait,
        { strokeDasharray: l, strokeDashoffset: l },
        { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', delay: i === 0 ? 0.9 : 0, scrollTrigger: i === 0 ? undefined : { trigger: trait, start: 'top 85%', once: true } },
      )
    })

    // Apparitions au défilement, par lots. Cachées par le script, pas par la
    // feuille de style : sans script, rien ne reste invisible.
    gsap.set('[data-apparait]', { opacity: 0, y: 22 })
    ScrollTrigger.batch('[data-apparait]', {
      start: 'top 90%',
      once: true,
      onEnter: (lot) => gsap.to(lot, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.09, overwrite: true }),
    })

    // Le carnet : barres qui poussent, cases qui se colorent, courbe tracée.
    if (barres) {
      gsap.from('.barre', { scaleY: 0, duration: 1, ease: 'power3.out', stagger: 0.02, scrollTrigger: { trigger: barres, start: 'top 85%', once: true } })
    }
    if (chaleur) {
      gsap.from('#chaleur .case', { opacity: 0, duration: 0.6, ease: 'power1.out', stagger: { each: 0.003 }, scrollTrigger: { trigger: chaleur, start: 'top 90%', once: true } })
    }
    const ligne = document.getElementById('ligne-avis')
    if (ligne) {
      const l = ligne.getTotalLength()
      gsap.fromTo(ligne, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', scrollTrigger: { trigger: ligne, start: 'top 85%', once: true } })
      gsap.from('#aire-avis', { opacity: 0, duration: 1.2, delay: 0.8, scrollTrigger: { trigger: ligne, start: 'top 85%', once: true } })
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

    // Le comptoir : le téléphone s'approche de la carte, la page d'avis
    // s'ouvre, cinq étoiles, un petit mot, et le tap est compté. En boucle.
    const carte = document.getElementById('carte')
    const telephone = document.getElementById('telephone')
    if (carte && telephone) {
      const etoiles = gsap.utils.toArray('#etoiles .etoile')
      const texte = document.getElementById('texte-avis')
      const phrase = 'Super accueil et le meilleur latte du quartier !'
      const ecrit = { n: 0 }
      gsap.to(carte, { y: -6, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 1.4 })
      tl.to(telephone, { x: -70, y: 70, rotate: -4, duration: 1.1, ease: 'power2.inOut' })
        .to('#ecran-attente', { opacity: 0, duration: 0.2 }, '-=0.15')
        .to('#ecran-avis', { opacity: 1, duration: 0.3 }, '<')
        .to(telephone, { x: 0, y: 0, rotate: 6, duration: 1.1, ease: 'power2.inOut' }, '+=0.2')
        .to(etoiles, { color: '#e4a53a', scale: 1.2, duration: 0.18, stagger: 0.13, yoyo: true, repeat: 1 }, '<')
        .set(etoiles, { color: '#e4a53a' })
        .to(ecrit, { n: phrase.length, duration: 1.5, ease: 'none', onUpdate: () => texte && (texte.textContent = phrase.slice(0, Math.round(ecrit.n))) })
        .fromTo('#notif', { opacity: 0, y: 12, rotate: -2 }, { opacity: 1, y: 0, rotate: -2, duration: 0.6, ease: 'back.out(1.6)' }, '-=0.6')
        .to({}, { duration: 1.8 })
        .to(['#ecran-avis', '#notif'], { opacity: 0, duration: 0.45 })
        .to('#ecran-attente', { opacity: 1, duration: 0.3 }, '<')
        .add(() => {
          gsap.set(etoiles, { color: '' })
          if (texte) texte.textContent = ''
          ecrit.n = 0
        })
    }
  }

  if (document.readyState === 'complete') demarrer()
  else window.addEventListener('load', demarrer)
})()
