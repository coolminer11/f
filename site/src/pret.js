// Chargé en tête, avant l'affichage : masque ce qui va s'animer, pour
// éviter un éclair « visible → caché → animé ». Filet de sécurité : si
// l'animation ne démarre pas (script bloqué, réseau lent), tout réapparaît
// au bout de 2,5 s.
;(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const racine = document.documentElement
  racine.classList.add('attente')
  setTimeout(() => racine.classList.remove('attente'), 2500)
})()
