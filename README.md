# kevsmos

## Tests
Un test de fumée joue le jeu tout seul sur ordinateur, iPhone SE et Pixel 7 couché (Chromium) : il échoue sur toute erreur console, un bouton hors de l'écran impossible à atteindre, une page qui déborde ou une chute d'images/s.

```bash
npm install
npx playwright install chromium
npm test            # captures dans test-results/
```
Réglages propres au jeu : `tests/smoke.config.mjs`. La CI GitHub (`.github/workflows/tests.yml`) le lance sur chaque PR.
