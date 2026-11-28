// @ts-check
/** État mutable partagé : lieu, catalogue, temps, caméra, sélection. */
import { prefs } from './save.js';
import { A, V3 } from './util.js';
import { defaultPlace } from './places.js';

const place0=prefs.place||defaultPlace();

export const etat = {
  place: place0,
  obs: new A.Observer(place0.lat,place0.lon,50),
  /** catalogue data/sky.json @type {any} */ DATA: undefined,
  /** étoiles nommées ou brillantes @type {any[]} */ starObjs: [],
  /** @type {Record<string, any>} */ consById: {},
  /** @type {any[]} */ messier: [],
  /** @type {any} */ lines: undefined,
  /** @type {any} */ selLines: null,
  /** @type {any[]} */ sats: [],
  /** prochain passage visible de l'ISS @type {{t:Date,dir:string}|null} */ satPass: null,
  offset: 0,
  playing: false,
  lastBodyT: 0,
  ready: false,
  sunWorld: new V3(0,-1,0),
  lastBodyReal: 0,
  /** 'touch' ou 'compass' */ mode: 'touch',
  yaw: 180,
  pitch: 28,
  fov: 70,
  velY: 0,
  velP: 0,
  /** orientation du téléphone @type {any} */ ori: null,
  absOK: false,
  /** @type {number|null} */ compassOff: null,
  lastOri: 0,
  pinch0: 0,
  fov0: 70,
  moved: 0,
  downT: 0,
  /** visée animée en cours @type {any} */ aim: null,
  /** astre choisi @type {any} */ sel: null,
  /** @type {any[]} */ SEARCH: [],
  satFrame: 0,
  lastT: performance.now(),
  hudT: 0,
};

