# Kevsmos

**Lève ton téléphone vers le ciel. Kevsmos te raconte ce que tu vois.**

Un planétarium de poche, en français, dans le navigateur. Le ciel est calculé pour ton lieu et l'heure exacte : étoiles, constellations, planètes, Lune et Soleil, Voie lactée, et les stations spatiales qui passent au-dessus de toi.

## Ce que fait l'appli

- **Pointer mon téléphone** : la boussole et les capteurs du téléphone orientent le ciel comme une fenêtre. Sur ordinateur ou sans boussole, on explore au doigt ou à la souris (glisser, pincer ou molette pour zoomer, flèches du clavier).
- **Toucher un astre** ouvre sa fiche : son histoire (mythologie et faits astronomiques), sa hauteur et sa direction, son éclat, sa distance, ses heures de lever et de coucher. La Lune donne sa phase et la prochaine pleine lune.
- **Chercher** : Lune, planètes, étoiles nommées, 88 constellations, objets de Messier, ISS et Tiangong. « Viser » tourne la caméra vers l'astre, ou une flèche guide si on est en mode boussole.
- **Voyager dans le temps** : de 12 heures en arrière à 12 heures en avant, en accéléré.
- **Lieu** : ta position, ou une ville de la liste (Douala, Yaoundé, Paris, Montréal, Dakar…). Par défaut, la ville de ton fuseau horaire.
- **Calques** : tracés des constellations, noms, Voie lactée, sol opaque, satellites.

## Lancer l'appli

Les modules JavaScript ne s'ouvrent pas en `file://` : lancez `npm start` puis ouvrez http://localhost:8000 (ou jouez en ligne sur GitHub Pages).

## Technique

- Modules ES sans étape de construction, dans `src/`. three.js (WebGL), Astronomy Engine et satellite.js sont dans `lib/`.
- `src/astro.js` et `src/catalog.js` : calculs du ciel et catalogue, sans DOM ni WebGL, testés sous Node. `src/scene.js` : rendu WebGL ; `src/labels.js`, `src/controls.js`, `src/pick.js`, `src/search.js`, `src/panels.js`, `src/timebar.js`, `src/sats.js` : interface.
- Typage `// @ts-check` et JSDoc, vérifié par `npm run types` (TypeScript strict).

## Visuels

Les 13 visuels du dossier `art/` ont été peints avec Codex (prompts dans `tools/art/prompts.json`) :
la nuit sous la Voie lactée de l'accueil, et une image pour la fiche du Soleil, de la Lune, des 7 planètes,
de l'ISS, des étoiles et des objets de Messier (`src/art.js`). Le ciel lui-même reste calculé et dessiné en WebGL.

## Sauvegarde

Le lieu et les calques sont gardés dans `localStorage`, clé `kevsmos.sauvegarde`, avec un numéro de version. Une sauvegarde abîmée ou venant d'une version plus récente est mise de côté (`kevsmos.sauvegarde.abimee`) et l'appli repart des valeurs par défaut. L'ancien format (`kevsmos.place`, `kevsmos.layers`) est repris une fois puis effacé. Les orbites des satellites sont gardées 6 heures en cache (`kevsmos.tle`).

## Tests

```bash
npm install
npx playwright install chromium
npm run types    # typage
npm run unit     # calculs du ciel (Étoile polaire, Soleil, lever et coucher), catalogue, fiches, satellites, sauvegarde
npm run smoke    # fumée sur ordinateur, iPhone SE et Pixel 7
npm run partie   # parcours complet à une date fixe : recherche, visée, toucher une planète, lieu, calques, temps, rechargement, iPhone SE
npm test         # tout
```

La CI GitHub (`.github/workflows/tests.yml`) lance tout sur chaque PR ; captures dans `test-results/`.

## Données et licences

Catalogue d'étoiles Hipparcos et tracés des constellations via d3-celestial (BSD), positions par Astronomy Engine (MIT), orbites CelesTrak et satellite.js (MIT), three.js (MIT). Voir `licences/`.
