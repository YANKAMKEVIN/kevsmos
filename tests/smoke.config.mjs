// Réglages du test de fumée (tests/smoke.mjs) pour kevsmos
export default {
  start: ['#goTouch'], keys: ['ArrowLeft','ArrowRight','ArrowUp'], mouse: true,
  // satellites : celestrak.org peut être injoignable, le jeu s'en passe
  ignoreErrors: [/celestrak/i],
  // ciel en WebGL : sans GPU (CI) on ne tient que ~10 images/s, le seuil vise seulement une chute brutale
  minFps: 4,
};
