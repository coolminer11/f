# Marque Tapora

**Logo : le sceau soleil.** Une étoile douce (l'avis 5 ★) qui se lève dans un
arc-en-ondes (les ondes NFC, en arc rétro), dans un sceau « Tapora Cards ·
Un tap, un avis · Québec ».

**Emblème des cartes : la carte arc-en-ciel.** La carte qui émet ses ondes.
On l'utilise pour parler du produit (bloc « Commander », visuels), pas comme logo.

## Fichiers

| Fichier | Usage |
|---|---|
| `sceau-fr.svg` / `sceau-en.svg` | Le logo complet (autocollant, carte, réseaux, impression) |
| `icone.svg` | Le sceau sans texte, pour les petites tailles (moins de 64 px) |
| `logo-fr-clair.svg`, `logo-en-clair.svg` | Logo horizontal sur fond clair |
| `logo-fr-sombre.svg`, `logo-en-sombre.svg` | Logo horizontal sur fond foncé |
| `carte-arc-en-ciel.svg` (+ `-sans-fond`) | Emblème des cartes |
| `png/` | Les mêmes en PNG, fond transparent (1024 px) |

Les SVG n'ont besoin d'aucune police : le texte est vectorisé.

## Couleurs

| Nom | Code |
|---|---|
| Terre cuite | `#c2552f` |
| Miel | `#e4a53a` |
| Rose | `#f2d3c4` |
| Crème | `#fffaf2` |
| Papier | `#f7f1e7` |
| Encre | `#2a211a` |
| Sapin | `#2f5c47` |

Polices : Fraunces (titres, « Tapora ») et Inter (texte, « CARDS »).

## Règles

- Sous 64 px, utiliser `icone.svg` (le texte du sceau devient illisible).
- Laisser autour du logo un espace d'au moins un quart de sa hauteur.
- Ne pas changer les couleurs, étirer, ni ajouter d'ombre au sceau.

## Régénérer

```
node marque/generer.mjs      # les SVG
node marque/exporter.mjs     # les PNG, les icônes du site et de l'app
```
