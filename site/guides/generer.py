#!/usr/bin/env python3
"""
Génère les guides (src/guides/*.html et src/en/guides/*.html) à partir de
guides/contenu_fr.py et guides/contenu_en.py.

    python3 guides/generer.py      (depuis le dossier site/)

Les pages produites sont du HTML statique, comme le reste du site : même
entête, même pied de page, mêmes animations (data-mots, data-apparait). Chaque
guide porte ses données structurées (Article, fil d'Ariane, FAQ) et ses liens
hreflang vers l'autre langue.
"""
import html
import json
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import contenu_en  # noqa: E402
import contenu_fr  # noqa: E402

SITE = 'https://taporacards.com'
DATE = '2026-10-20'
ORG = {'@type': 'Organization', '@id': f'{SITE}/#organisation', 'name': 'Tapora Cards', 'url': f'{SITE}/', 'logo': f'{SITE}/logo.png'}

TX = {
    'fr': dict(
        lang='fr-CA', og='fr_CA', base='/guides', accueil='/', autre='/en/guides',
        accueil_txt='Accueil', guides_txt='Guides', lecture='min de lecture', maj='Mis à jour le 20 octobre 2026',
        sommaire='Dans ce guide', faq='Questions fréquentes', autres='Les autres guides', lire='Lire le guide',
        nav=[('/#fonctionnement', 'Comment ça marche'), ('/#statistiques', 'Les stats'), ('/#prix', 'Prix'), ('/#entreprise', 'Entreprises'), ('/guides/', 'Guides')],
        commander='Commander', commander_lien='/#commander', autre_txt='EN', autre_titre='English version',
        cta_titre='Une carte, un tap, un avis.',
        cta_texte='Tapora : des cartes NFC qui ouvrent votre page d’avis Google en un tap, avec vos statistiques en direct. 35 $ la carte, tout inclus, sans abonnement — et 30 $ la carte en Entreprise, dès 25 cartes, avec un design sur mesure.',
        cta_btn='Voir les prix', cta_btn_lien='/#prix', cta_btn2='Écrire pour commander',
        cta_mail='mailto:contact@taporacards.com?subject=Commande%20de%20cartes%20Tapora',
        pied='entreprise québécoise', conf=('/confidentialite', 'Confidentialité'), cond=('/conditions', 'Conditions'),
        langue_pied=('/en/', 'English', 'en'), sauter='Aller au contenu', ariane='Fil d’Ariane', principale='Principale', pied_aria='Pied de page',
    ),
    'en': dict(
        lang='en-CA', og='en_CA', base='/en/guides', accueil='/en/', autre='/guides',
        accueil_txt='Home', guides_txt='Guides', lecture='min read', maj='Updated October 20, 2026',
        sommaire='In this guide', faq='Frequently asked questions', autres='More guides', lire='Read the guide',
        nav=[('/en/#fonctionnement', 'How it works'), ('/en/#statistiques', 'The stats'), ('/en/#prix', 'Pricing'), ('/en/#entreprise', 'Businesses'), ('/en/guides/', 'Guides')],
        commander='Order', commander_lien='/en/#commander', autre_txt='FR', autre_titre='Version française',
        cta_titre='One card, one tap, one review.',
        cta_texte='Tapora: NFC cards that open your Google review page in one tap, with live stats. $35 per card, everything included, no subscription — and $30 per card for Business orders from 25 cards, with a custom design.',
        cta_btn='See pricing', cta_btn_lien='/en/#prix', cta_btn2='Email us to order',
        cta_mail='mailto:contact@taporacards.com?subject=Tapora%20card%20order',
        pied='a Québec business', conf=('/en/privacy', 'Privacy'), cond=('/en/terms', 'Terms'),
        langue_pied=('/', 'Français', 'fr'), sauter='Skip to content', ariane='Breadcrumb', principale='Main', pied_aria='Footer',
    ),
}


def ancre(t):
    t = html.unescape(re.sub('<[^>]+>', '', t)).lower()
    t = re.sub(r'[’\']', '-', t)
    for a, b in [('àâä', 'a'), ('éèêë', 'e'), ('îï', 'i'), ('ôö', 'o'), ('ùûü', 'u'), ('ç', 'c')]:
        for c in a:
            t = t.replace(c, b)
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:60]


def texte(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', h))).strip()


def page(l, titre, desc, canon, alt_fr, alt_en, jsonld, corps):
    t = TX[l]
    nav = '\n'.join(f'        <a href="{h}" class="lien-nav transition hover:text-encre">{x}</a>' for h, x in t['nav'])
    autre_lien = alt_en if l == 'fr' else alt_fr
    return f'''<!doctype html>
<html lang="{t['lang']}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(titre)} | Tapora Cards</title>
  <meta name="description" content="{html.escape(desc)}">
  <link rel="canonical" href="{SITE}{canon}">
  <link rel="alternate" hreflang="fr-CA" href="{SITE}{alt_fr}">
  <link rel="alternate" hreflang="en-CA" href="{SITE}{alt_en}">
  <meta name="theme-color" content="#f7f1e7">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/fraunces-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script src="/js/pret.js"></script>

  <meta property="og:type" content="article">
  <meta property="og:locale" content="{t['og']}">
  <meta property="og:site_name" content="Tapora Cards">
  <meta property="og:url" content="{SITE}{canon}">
  <meta property="og:title" content="{html.escape(titre)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="{SITE}/{'og.png' if l == 'fr' else 'og-en.png'}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">

  <script type="application/ld+json">
{json.dumps(jsonld, ensure_ascii=False, indent=2)}
  </script>
</head>
<body class="papier overflow-x-hidden">
  <div id="progression" class="fixed inset-x-0 top-0 z-50 h-[3px] origin-left scale-x-0 bg-brique" aria-hidden="true"></div>
  <a href="#contenu" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-encre focus:px-4 focus:py-2 focus:text-creme">{t['sauter']}</a>

  <header id="entete" class="fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="{t['principale']}">
      <a href="{t['accueil']}" class="flex items-center gap-2.5" aria-label="Tapora Cards">
        <img src="/favicon.svg" alt="" width="30" height="30" class="size-[30px]">
        <span class="titre text-xl font-semibold">Tapora</span>
      </a>
      <div class="hidden items-center gap-7 text-[15px] text-encre-doux lg:flex">
{nav}
      </div>
      <div class="flex items-center gap-4">
        <a href="{autre_lien}" hreflang="{'en' if l == 'fr' else 'fr'}" class="lien-nav text-sm font-medium text-encre-doux transition hover:text-encre" title="{t['autre_titre']}">{t['autre_txt']}</a>
        <a href="{t['commander_lien']}" class="rounded-full bg-encre px-5 py-2.5 text-sm font-medium text-creme transition hover:bg-brique">{t['commander']}</a>
      </div>
    </nav>
  </header>

  <main id="contenu">
{corps}
  </main>

  <footer class="border-t border-ligne">
    <div class="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 text-sm text-encre-doux sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2.5">
        <img src="/marque/sceau-{l}.svg" alt="" width="56" height="56" class="sceau-pied size-14">
        <span><strong class="font-semibold text-encre">Tapora S.E.N.C.</strong> · NEQ 3382462367 · {t['pied']}</span>
      </div>
      <nav class="flex flex-wrap gap-6" aria-label="{t['pied_aria']}">
        <a href="{t['base']}/" class="hover:text-encre">{t['guides_txt']}</a>
        <a href="{t['conf'][0]}" class="hover:text-encre">{t['conf'][1]}</a>
        <a href="{t['cond'][0]}" class="hover:text-encre">{t['cond'][1]}</a>
        <a href="{t['langue_pied'][0]}" hreflang="{t['langue_pied'][2]}" lang="{t['langue_pied'][2]}" class="hover:text-encre">{t['langue_pied'][1]}</a>
        <a href="mailto:contact@taporacards.com" class="hover:text-encre">Contact</a>
        <span>© <span id="annee">2026</span> Tapora</span>
      </nav>
    </div>
  </footer>

  <script src="/js/gsap.min.js" defer></script>
  <script src="/js/ScrollTrigger.min.js" defer></script>
  <script src="/js/lenis.min.js" defer></script>
  <script src="/js/main.js" defer></script>
</body>
</html>
'''


def ariane(l, items):
    t = TX[l]
    lis = []
    for i, (lien, nom) in enumerate(items):
        sep = '' if i == 0 else '<span aria-hidden="true" class="text-ligne">/</span>'
        if lien:
            lis.append(f'{sep}<a href="{lien}" class="hover:text-brique">{html.escape(nom)}</a>')
        else:
            lis.append(f'{sep}<span aria-current="page" class="truncate text-encre">{html.escape(nom)}</span>')
    return f'<nav aria-label="{t["ariane"]}" class="flex min-w-0 flex-wrap items-center gap-2 text-sm text-encre-doux" data-apparait>{"".join(lis)}</nav>'


def cta(l):
    t = TX[l]
    return f'''      <section class="mx-auto mt-20 max-w-6xl px-5">
        <div class="relative overflow-hidden rounded-[2.5rem] bg-sapin px-6 py-14 text-creme sm:px-14" data-apparait>
          <svg viewBox="0 0 400 400" class="pointer-events-none absolute -right-24 -top-24 size-96 text-creme/[0.07]" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round"><path d="M150 120a110 110 0 0 1 0 160"/><path d="M210 80a170 170 0 0 1 0 240"/><path d="M270 40a230 230 0 0 1 0 320"/></g></svg>
          <div class="relative max-w-2xl">
            <h2 data-mots class="titre text-4xl font-medium leading-tight sm:text-5xl">{t['cta_titre']}</h2>
            <p class="mt-4 text-lg leading-relaxed text-creme/80">{t['cta_texte']}</p>
            <div class="mt-8 flex flex-wrap gap-3">
              <a href="{t['cta_btn_lien']}" class="rounded-full bg-creme px-7 py-4 text-[15px] font-semibold text-sapin transition hover:-translate-y-0.5 hover:bg-white">{t['cta_btn']}</a>
              <a href="{t['cta_mail']}" class="rounded-full border border-creme/30 px-7 py-4 text-[15px] font-medium transition hover:bg-creme/10">{t['cta_btn2']}</a>
            </div>
          </div>
        </div>
      </section>'''


def carte_guide(l, g, base):
    t = TX[l]
    return f'''          <a href="{base}/{g['slug']}" class="soulevable carte-papier group flex flex-col rounded-3xl p-6" data-apparait>
            <span class="text-xs font-semibold uppercase tracking-[0.18em] text-brique">{g['lecture']} {t['lecture']}</span>
            <span class="titre mt-3 text-2xl font-medium leading-snug">{html.escape(g['court'])}</span>
            <span class="mt-2 flex-1 text-[15px] leading-relaxed text-encre-doux">{html.escape(g['desc'])}</span>
            <span class="bouton-fleche mt-5 text-sm font-semibold text-encre">{t['lire']} <span class="fleche">→</span></span>
          </a>'''


def generer(l, guides, index, paires):
    t = TX[l]
    dossier = os.path.join(ICI, '..', 'src', 'guides' if l == 'fr' else os.path.join('en', 'guides'))
    os.makedirs(dossier, exist_ok=True)
    base = t['base']
    for g in guides:
        canon = f"{base}/{g['slug']}"
        fr_slug, en_slug = paires[g['slug']]
        alt_fr, alt_en = f'/guides/{fr_slug}', f'/en/guides/{en_slug}'
        toc = '\n'.join(f'''              <li><a href="#{ancre(h)}" class="transition hover:text-brique">{h}</a></li>''' for h, _ in g['sections'])
        sections = '\n'.join(f'''          <h2 id="{ancre(h)}">{h}</h2>
{c.strip()}''' for h, c in g['sections'])
        faq = ''
        if g.get('faq'):
            items = '\n'.join(f'''          <details class="group py-5" data-apparait>
            <summary class="flex items-center justify-between gap-6 text-lg font-medium">{html.escape(q)}<span class="plus titre text-3xl text-brique transition">+</span></summary>
            <div class="reponse"><p class="pt-3 leading-relaxed text-encre-doux">{html.escape(r)}</p></div>
          </details>''' for q, r in g['faq'])
            faq = f'''
      <section id="faq" class="mx-auto mt-16 max-w-3xl px-5">
        <h2 data-mots class="titre text-3xl font-medium sm:text-4xl">{t['faq']}</h2>
        <div class="mt-6 divide-y divide-dashed divide-ligne border-y border-dashed border-ligne">
{items}
        </div>
      </section>'''
        autres = '\n'.join(carte_guide(l, x, base) for x in guides if x['slug'] != g['slug'])[:]
        corps = f'''      <article class="mx-auto max-w-3xl px-5 pt-32 sm:pt-36">
        {ariane(l, [(t['accueil'], t['accueil_txt']), (base + '/', t['guides_txt']), (None, g['court'])])}
        <p class="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{g['lecture']} {t['lecture']} · {t['maj']}</p>
        <h1 data-mots class="titre mt-3 text-4xl font-medium leading-[1.1] sm:text-5xl">{html.escape(g['titre'])}</h1>
        <p class="mt-6 text-xl leading-relaxed text-encre-doux" data-apparait>{html.escape(g['intro'])}</p>

        <nav class="carte-papier mt-10 rounded-3xl p-6" aria-label="{t['sommaire']}" data-apparait>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-encre-doux">{t['sommaire']}</p>
          <ol class="mt-3 space-y-1.5 text-[15px] [counter-reset:s] [&>li]:[counter-increment:s] [&>li]:before:mr-2 [&>li]:before:font-semibold [&>li]:before:text-brique [&>li]:before:content-[counter(s)]">
{toc}
          </ol>
        </nav>

        <div class="article mt-4" data-apparait>
{sections}
        </div>
      </article>
{faq}
{cta(l)}

      <section class="mx-auto mt-20 max-w-6xl px-5 pb-24">
        <h2 data-mots class="titre text-3xl font-medium sm:text-4xl">{t['autres']}</h2>
        <div class="mt-8 grid gap-5 md:grid-cols-2">
{autres}
        </div>
      </section>'''
        jsonld = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Article',
                    'headline': g['titre'],
                    'description': g['desc'],
                    'inLanguage': t['lang'],
                    'datePublished': DATE,
                    'dateModified': DATE,
                    'author': ORG,
                    'publisher': ORG,
                    'mainEntityOfPage': f'{SITE}{canon}',
                    'image': f"{SITE}/{'og.png' if l == 'fr' else 'og-en.png'}",
                },
                {
                    '@type': 'BreadcrumbList',
                    'itemListElement': [
                        {'@type': 'ListItem', 'position': 1, 'name': t['accueil_txt'], 'item': f"{SITE}{t['accueil']}"},
                        {'@type': 'ListItem', 'position': 2, 'name': t['guides_txt'], 'item': f'{SITE}{base}/'},
                        {'@type': 'ListItem', 'position': 3, 'name': g['court'], 'item': f'{SITE}{canon}'},
                    ],
                },
            ]
            + (
                [{'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': r}} for q, r in g['faq']]}]
                if g.get('faq')
                else []
            ),
        }
        with open(os.path.join(dossier, g['slug'] + '.html'), 'w') as f:
            f.write(page(l, g['titre'], g['desc'], canon, alt_fr, alt_en, jsonld, corps))

    # ---- La page d'index des guides.
    cartes = '\n'.join(carte_guide(l, g, base) for g in guides)
    corps = f'''      <section class="mx-auto max-w-6xl px-5 pb-8 pt-32 sm:pt-40">
        {ariane(l, [(t['accueil'], t['accueil_txt']), (None, t['guides_txt'])])}
        <h1 data-mots class="titre mt-8 max-w-3xl text-5xl font-medium leading-[1.05] sm:text-6xl">{html.escape(index['h1'])}</h1>
        <p class="mt-6 max-w-2xl text-xl leading-relaxed text-encre-doux" data-apparait>{html.escape(index['intro'])}</p>
        <div class="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
{cartes}
        </div>
      </section>
{cta(l)}
      <div class="pb-24"></div>'''
    jsonld = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                'name': index['titre'],
                'description': index['desc'],
                'inLanguage': t['lang'],
                'url': f'{SITE}{base}/',
                'publisher': ORG,
                'hasPart': [{'@type': 'Article', 'headline': g['titre'], 'url': f"{SITE}{base}/{g['slug']}"} for g in guides],
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': t['accueil_txt'], 'item': f"{SITE}{t['accueil']}"},
                    {'@type': 'ListItem', 'position': 2, 'name': t['guides_txt'], 'item': f'{SITE}{base}/'},
                ],
            },
        ],
    }
    with open(os.path.join(dossier, 'index.html'), 'w') as f:
        f.write(page(l, index['titre'], index['desc'], base + '/', '/guides/', '/en/guides/', jsonld, corps))


def insecables(v):
    """Typographie française : pas de « : », « ? », « ! » ou « » » seuls en début de ligne."""
    if isinstance(v, str):
        v = re.sub(r' ([:;?!»])', '\u00a0\\1', v)
        return re.sub(r'« ', '«\u00a0', v)
    if isinstance(v, list):
        return [insecables(x) for x in v]
    if isinstance(v, tuple):
        return tuple(insecables(x) for x in v)
    if isinstance(v, dict):
        return {k: (x if k == 'slug' else insecables(x)) for k, x in v.items()}
    return v


contenu_fr.GUIDES = insecables(contenu_fr.GUIDES)
contenu_fr.INDEX = insecables(contenu_fr.INDEX)

paires = {}
for g in contenu_en.GUIDES:
    paires[g['slug']] = (g['fr'], g['slug'])
    paires[g['fr']] = (g['fr'], g['slug'])
generer('fr', contenu_fr.GUIDES, contenu_fr.INDEX, paires)
generer('en', contenu_en.GUIDES, contenu_en.INDEX, paires)
print('Guides générés :', len(contenu_fr.GUIDES), 'FR,', len(contenu_en.GUIDES), 'EN')


# ---------------------------------------------------------------------------
# Le sitemap : chaque page avec son équivalent dans l'autre langue.
# ---------------------------------------------------------------------------
PAIRES_PAGES = [
    ('/', '/en/', 'weekly', '1.0'),
    ('/guides/', '/en/guides/', 'weekly', '0.8'),
] + [(f"/guides/{g['fr']}", f"/en/guides/{g['slug']}", 'monthly', '0.7') for g in contenu_en.GUIDES] + [
    ('/partenaires', '/en/partners', 'weekly', '0.6'),
    ('/conditions', '/en/terms', 'yearly', '0.3'),
    ('/confidentialite', '/en/privacy', 'yearly', '0.3'),
]
lignes = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for fr, en, freq, prio in PAIRES_PAGES:
    for loc in (fr, en):
        lignes += [
            '  <url>',
            f'    <loc>{SITE}{loc}</loc>',
            f'    <lastmod>{DATE}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority>',
            f'    <xhtml:link rel="alternate" hreflang="fr-CA" href="{SITE}{fr}"/>',
            f'    <xhtml:link rel="alternate" hreflang="en-CA" href="{SITE}{en}"/>',
        ]
        if fr == '/':
            lignes.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/"/>')
        lignes.append('  </url>')
lignes.append('</urlset>')
with open(os.path.join(ICI, '..', 'public', 'sitemap.xml'), 'w') as f:
    f.write('\n'.join(lignes) + '\n')
print('Sitemap :', len(PAIRES_PAGES) * 2, 'adresses')
