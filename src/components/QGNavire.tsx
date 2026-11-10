import { useEffect, useRef, useState } from 'react';
import type { IdMembreQG, MembreQG, StatutMembreQG } from '../types';
import { FICHES, POSTES, chemin, type Habitude, type IdQG, type PosteQG } from '../data/equipageQG';
import styles from './QGNavire.module.css';

// Le QG en pixel art, plein écran : L'Obstiné vu de profil, coupé en deux,
// et une caméra qu'on déplace (glisser) et qu'on zoome (molette).
//
// Netteté : tout vit dans un « monde » en vrais pixels. Une fois arrêtée, la
// caméra affiche ce monde par demi-crans de zoom en pixels de l'écran (échelle
// Windows comprise), calée au pixel d'écran près : rien n'est jamais lissé. Le ciel et la mer sont dessinés à la taille de l'écran
// (ils couvrent tout, quel que soit le zoom), le bateau et les persos sont des
// images (public/qg/, préparées par scripts/qg-images.mjs).

// --- Le bateau ------------------------------------------------------------------

// Bateau entier, mâts compris (scripts/qg-images.mjs) : 963 × 690 vrais pixels,
// sans agrandissement, à la même échelle que l'ancien bateau HD : le pont et les
// pièces gardent leurs coordonnées (y = 0 en haut de l'ancienne image).
const IMAGE_BATEAU = '/qg/bateau-final.png';
const BATEAU = { l: 963, h: 690 };
const HAUT = 307; // l'image commence à y = −HAUT (mâts et drapeau au-dessus du pont)
const FLOTTAISON = 350; // y au ras de l'eau (sous le plancher des pièces du bas)
const PROUE = 597; // x où la coque touche l'eau (mesuré sur l'image)
const IPS_MER = 10; // images par seconde de l'eau (saccadé exprès, façon pixel art)

// Lanternes et fenêtres : halo le soir, reflet doré dans l'eau.
const LUMIERES = [
  { x: 18, y: 85, r: 6, reflet: true },
  { x: 315, y: 105, r: 5, reflet: true },
  { x: 419, y: 92, r: 5, reflet: true },
  { x: 45, y: 188, r: 6, reflet: true },
  { x: 89, y: 192, r: 6, reflet: true },
  { x: 255, y: 190, r: 10, reflet: false },
  { x: 429, y: 159, r: 9, reflet: false },
  { x: 317, y: 277, r: 9, reflet: false },
  { x: 302, y: 315, r: 7, reflet: false },
];

// --- Heure : jour, crépuscule, nuit ------------------------------------------

type Couleur = [number, number, number];
interface Ambiance {
  cielHaut: Couleur;
  cielBas: Couleur;
  nuages: Couleur;
  mer: [Couleur, Couleur, Couleur, Couleur]; // profonde, moyenne, claire, écume
  nuit: number; // 0 = plein jour, 1 = nuit noire
}

const NUIT: Ambiance = {
  cielHaut: [16, 12, 44],
  cielBas: [58, 34, 86],
  nuages: [92, 50, 104],
  mer: [[10, 34, 54], [18, 62, 84], [42, 112, 130], [150, 206, 212]],
  nuit: 1,
};
const AMBIANCES: { h: number; a: Ambiance }[] = [
  { h: 0, a: NUIT },
  { h: 5.5, a: { cielHaut: [26, 20, 64], cielBas: [96, 54, 104], nuages: [130, 72, 116], mer: [[14, 42, 66], [24, 76, 102], [60, 130, 148], [170, 214, 220]], nuit: 0.85 } },
  { h: 7, a: { cielHaut: [84, 110, 170], cielBas: [240, 170, 130], nuages: [250, 196, 170], mer: [[22, 76, 110], [40, 116, 148], [110, 182, 202], [236, 246, 250]], nuit: 0.3 } },
  { h: 10, a: { cielHaut: [70, 140, 210], cielBas: [168, 214, 236], nuages: [246, 246, 250], mer: [[20, 86, 134], [36, 128, 174], [96, 184, 216], [240, 252, 255]], nuit: 0 } },
  { h: 17, a: { cielHaut: [70, 136, 204], cielBas: [184, 212, 228], nuages: [244, 240, 236], mer: [[20, 84, 128], [36, 124, 166], [100, 182, 212], [240, 250, 252]], nuit: 0 } },
  { h: 19.5, a: { cielHaut: [70, 60, 130], cielBas: [240, 132, 86], nuages: [236, 120, 110], mer: [[28, 52, 88], [56, 86, 124], [196, 136, 114], [252, 214, 170]], nuit: 0.45 } },
  { h: 21.5, a: { ...NUIT, nuit: 0.95 } },
  { h: 24, a: NUIT },
];

const mel = (a: number, b: number, t: number) => a + (b - a) * t;
const melC = (a: Couleur, b: Couleur, t: number): Couleur => [mel(a[0], b[0], t), mel(a[1], b[1], t), mel(a[2], b[2], t)];
const css = (c: Couleur) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function ambianceA(heure: number): Ambiance {
  const i = AMBIANCES.findIndex((x) => x.h > heure);
  const [a, b] = [AMBIANCES[i - 1], AMBIANCES[i]];
  const t = (heure - a.h) / (b.h - a.h);
  return {
    cielHaut: melC(a.a.cielHaut, b.a.cielHaut, t),
    cielBas: melC(a.a.cielBas, b.a.cielBas, t),
    nuages: melC(a.a.nuages, b.a.nuages, t),
    mer: [0, 1, 2, 3].map((k) => melC(a.a.mer[k], b.a.mer[k], t)) as Ambiance['mer'],
    nuit: mel(a.a.nuit, b.a.nuit, t),
  };
}

// Heure du PC (ou forcée par « ?qg-heure=22 » pour les essais), relue toutes les 30 s.
const HEURE_FORCEE = Number(new URLSearchParams(location.search).get('qg-heure'));
function lireHeure() {
  if (Number.isFinite(HEURE_FORCEE) && HEURE_FORCEE > 0) return HEURE_FORCEE % 24;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function useHeure() {
  const [heure, setHeure] = useState(lireHeure);
  useEffect(() => {
    const id = setInterval(() => setHeure(lireHeure()), 30_000);
    return () => clearInterval(id);
  }, []);
  return heure;
}

// Hasard reproductible : étoiles et vagues restent à la même place.
function hasard(graine: number) {
  let s = graine;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const r = hasard(7);
const TUILE = 512; // les motifs du ciel et de la mer se répètent tous les TUILE pixels
const ETOILES = Array.from({ length: 70 }, () => ({ x: (r() * TUILE) | 0, y: r(), p: r() * 6.28, g: r() > 0.85 }));
const NUAGES = Array.from({ length: 5 }, (_, i) => ({ x: r() * TUILE, y: 0.55 + i * 0.07 + r() * 0.04, l: 60 + r() * 110, v: 1 + r() * 2 }));

// Rangées de vagues, de l'horizon (petites, lentes) au premier plan (grandes, rapides).
// L'eau file vers la gauche : le bateau avance vers la droite.
const RANGEES = [
  { y: 3, vitesse: 3, pas: 22, taille: 0 },
  { y: 8, vitesse: 5, pas: 28, taille: 0 },
  { y: 14, vitesse: 8, pas: 34, taille: 1 },
  { y: 22, vitesse: 12, pas: 40, taille: 1 },
  { y: 31, vitesse: 17, pas: 48, taille: 2 },
  { y: 42, vitesse: 23, pas: 56, taille: 2 },
  { y: 56, vitesse: 30, pas: 64, taille: 2 },
  { y: 72, vitesse: 38, pas: 72, taille: 2 },
].map((rg) => ({
  ...rg,
  decalages: Array.from({ length: 20 }, () => ({ dx: r() * rg.pas * 0.9, phase: (r() * 9) | 0, taille: r() < 0.35 ? -1 : r() < 0.8 ? 0 : 1, ecume: r() < 0.3 })),
}));
const ILES = [{ x: 40, l: 60, h: 7 }, { x: 150, l: 26, h: 4 }, { x: 330, l: 90, h: 10 }, { x: 440, l: 34, h: 5 }];
const MOUETTES = [0, 1, 2, 3].map((i) => ({ x: r() * 400, y: 0.15 + r() * 0.35, v: 9 + r() * 8, p: i * 3 }));
// Mouette en deux images : ailes hautes, ailes basses.
const MOUETTE = [
  [[-4, -1], [-3, -1], [-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0], [3, -1], [4, -1]],
  [[-4, 1], [-3, 0], [-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0], [3, 0], [4, 1]],
];
const ECLATS = Array.from({ length: 30 }, () => ({ x: (r() * TUILE) | 0, y: 2 + r() * 90, periode: 14 + ((r() * 30) | 0), phase: (r() * 40) | 0 }));

// Crêtes : petits arcs clairs (⌒), du plus petit au plus grand.
const ARCS = [
  [[1, 0], [2, 0], [0, 1], [3, 1]],
  [[2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [0, 2], [6, 2]],
  [[3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [2, 1], [7, 1], [8, 1], [0, 2], [9, 2]],
];

const mod = (a: number, n: number) => ((a % n) + n) % n;

// Ce que voit la caméra, en pixels du monde : coin haut-gauche (entier) et taille.
type Vue = { ox: number; oy: number; l: number; h: number };

// --- Dessin du ciel ------------------------------------------------------------

function point(ctx: CanvasRenderingContext2D, x: number, y: number, l = 1, h = 1) {
  ctx.fillRect(Math.round(x), Math.round(y), l, h);
}

function disque(ctx: CanvasRenderingContext2D, cx: number, cy: number, rayon: number) {
  for (let y = -rayon; y <= rayon; y++) {
    const l = Math.round(Math.sqrt(rayon * rayon - y * y));
    point(ctx, cx - l, cy + y, l * 2, 1);
  }
}

function dessinerCiel(ctx: CanvasRenderingContext2D, t: number, a: Ambiance, heure: number, v: Vue) {
  const horizon = FLOTTAISON - v.oy;
  ctx.clearRect(0, 0, v.l, v.h);
  if (horizon <= 0) return;
  // Bandes nettes, sans dégradé lisse (sur la hauteur de ciel visible).
  const BANDES = 10;
  for (let i = 0; i < BANDES; i++) {
    ctx.fillStyle = css(melC(a.cielHaut, a.cielBas, i / (BANDES - 1)));
    const y0 = Math.round((horizon * i) / BANDES);
    ctx.fillRect(0, y0, v.l, Math.round((horizon * (i + 1)) / BANDES) - y0);
  }
  // Étoiles, nuages, soleil et lune : à l'infini, ils glissent peu quand on se déplace.
  const lointain = Math.round(v.ox * 0.1);
  if (a.nuit > 0.2) {
    const pas = Math.floor(t * 4);
    ctx.fillStyle = a.nuit > 0.6 ? '#fff6dc' : '#d8d0e8';
    for (let base = -mod(lointain, TUILE); base < v.l; base += TUILE) {
      for (const e of ETOILES) {
        if (Math.sin(pas * 0.7 + e.p * 3) < -0.6) continue;
        const x = base + e.x;
        const y = Math.round(e.y * (horizon - 16));
        point(ctx, x, y);
        if (e.g && Math.sin(pas * 0.5 + e.p) > 0.7) {
          point(ctx, x - 1, y, 3, 1);
          point(ctx, x, y - 1, 1, 3);
        }
      }
    }
  }
  const jour = heure >= 6 && heure < 20;
  const avance = jour ? (heure - 6) / 14 : ((heure + 24 - 20) % 24) / 10;
  const ax = 30 + avance * (v.l - 60);
  const ay = Math.max(18, horizon - 30 - Math.sin(avance * Math.PI) * Math.min(260, horizon * 0.75));
  ctx.fillStyle = jour ? '#ffe08a' : '#ece6d0';
  disque(ctx, ax, ay, jour ? 12 : 9);
  ctx.fillStyle = jour ? '#fff3c4' : '#c9bf9f';
  if (jour) disque(ctx, ax - 3, ay - 3, 5);
  else {
    point(ctx, ax + 2, ay - 4, 3, 2);
    point(ctx, ax - 5, ay + 2, 2, 2);
  }
  ctx.fillStyle = css(melC(a.cielBas, a.mer[0], 0.55));
  for (let base = -mod(Math.round(v.ox * 0.3), TUILE); base < v.l; base += TUILE) {
    for (const ile of ILES) {
      for (let k = 0; k < ile.l; k++) {
        const h = Math.round(ile.h * Math.sin((k / ile.l) * Math.PI) ** 0.6 + (k % 7 === 0 ? 1 : 0));
        ctx.fillRect(base + ile.x + k, horizon - h, 1, h);
      }
    }
  }
  if (a.nuit < 0.7) {
    const pas = Math.floor(t * 6);
    for (const m of MOUETTES) {
      const x = mod(m.x + t * m.v - v.ox * 0.5, v.l + 60) - 30;
      const y = Math.round(m.y * horizon + Math.sin(t * 0.8 + m.p) * 6);
      const forme = MOUETTE[(pas + m.p) % 4 < 2 ? 0 : 1];
      ctx.fillStyle = '#3a3a44';
      for (const [px, py] of forme) ctx.fillRect(Math.round(x) + px, y + py + 1, 1, 1);
      ctx.fillStyle = '#f4f2ea';
      for (const [px, py] of forme) ctx.fillRect(Math.round(x) + px, y + py, 1, 1);
    }
  }
  ctx.fillStyle = css(a.nuages);
  for (let base = -mod(lointain * 2, TUILE); base < v.l; base += TUILE) {
    for (const n of NUAGES) {
      const x = base + mod(n.x + t * n.v, TUILE + n.l) - n.l;
      const y = horizon * n.y;
      point(ctx, x, y, Math.round(n.l), 3);
      point(ctx, x + n.l * 0.2, y - 2, Math.round(n.l * 0.5), 2);
    }
  }
}

// --- Dessin de la mer ----------------------------------------------------------

// Silhouette du bateau (une seule couleur), pour son reflet.
function silhouette(image: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const x = c.getContext('2d')!;
  x.drawImage(image, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function dessinerMer(ctx: CanvasRenderingContext2D, image: number, a: Ambiance, bob: number, ombre: HTMLCanvasElement | null, v: Vue) {
  const [fonce, moyen, clair, ecume] = a.mer.map(css);
  const t = image / IPS_MER;
  ctx.clearRect(0, 0, v.l, v.h);
  const H = FLOTTAISON - v.oy; // la mer, en y de l'écran visible
  if (H >= v.h) return;
  const X = (x: number) => x - v.ox; // x du monde → x de l'écran

  // Bandes de couleur, raccordées par une ligne en damier (pas de dégradé).
  ctx.fillStyle = clair;
  ctx.fillRect(0, H, v.l, 1);
  ctx.fillStyle = moyen;
  ctx.fillRect(0, H + 1, v.l, 13);
  ctx.fillStyle = fonce;
  ctx.fillRect(0, H + 14, v.l, Math.max(0, v.h - H - 14));
  ctx.fillStyle = moyen;
  for (let x = mod(image - v.ox, 2); x < v.l; x += 2) ctx.fillRect(x, H + 14, 1, 1);
  for (let x = mod(image + 1 - v.ox, 4); x < v.l; x += 4) ctx.fillRect(x, H + 15, 1, 1);

  // Reflet du bateau : silhouette sombre, ondulée par lignes de E pixels.
  if (ombre) {
    ctx.globalAlpha = 0.3;
    for (let y = 0; y < Math.min(90, v.h - H); y += 2) {
      const sy = HAUT + FLOTTAISON - y - 2 + bob;
      if (sy < 0) break;
      const dx = Math.round(Math.sin(t * 2 + y * 0.25) * (1 + y * 0.03));
      ctx.drawImage(ombre, 0, sy, BATEAU.l, 2, X(0) + dx, H + y, BATEAU.l, 2);
    }
    ctx.globalAlpha = 1;
  }

  // La nuit : reflets dorés des lanternes, en tirets qui tremblent.
  if (a.nuit > 0.35) {
    for (const l of LUMIERES) {
      if (!l.reflet) continue;
      for (let y = H + 2, k = 0; y < Math.min(v.h, H + 70); y += 3, k++) {
        if ((image + k * 3 + l.x) % 7 === 0) continue;
        const dx = Math.round(Math.sin(t * 3 + k * 1.3 + l.x) * (1 + k * 0.25));
        const l2 = Math.max(1, 5 - (k >> 2));
        ctx.fillStyle = k % 2 ? '#e8a040' : '#ffd27a';
        point(ctx, X(l.x) - (l2 >> 1) + dx, y, l2, 1);
      }
    }
  }

  // Crêtes de vagues qui avancent, et lignes d'écume (motif qui suit la caméra).
  for (const rg of RANGEES) {
    const y = H + rg.y;
    if (y >= v.h) break;
    const base = t * rg.vitesse + v.ox;
    for (let i = Math.floor(base / rg.pas) - 1; i * rg.pas - base < v.l + rg.pas; i++) {
      const d = rg.decalages[mod(i, 20)];
      const x = Math.round(i * rg.pas - base + d.dx);
      const etape = mod(Math.floor(t * 1.6) + d.phase + i, 9);
      if (etape >= 5) continue;
      if (etape === 4) {
        ctx.fillStyle = ecume;
        point(ctx, x + 1, y + 1, 2, 1);
        point(ctx, x + 5, y + 1, 1, 1);
        continue;
      }
      const forme = ARCS[Math.max(0, Math.min(2, rg.taille + d.taille + (etape >= 2 ? 1 : 0)))];
      ctx.fillStyle = etape === 2 ? ecume : clair;
      for (const [px, py] of forme) ctx.fillRect(x + px, y + py, 1, 1);
      if (rg.taille > 0 && d.ecume) {
        ctx.fillStyle = clair;
        point(ctx, x + 12, y + 2, 5 + rg.taille * 3, 1);
      }
    }
  }

  // Reflets qui scintillent : un point, puis une petite croix, puis rien.
  ctx.fillStyle = ecume;
  for (let base = -mod(v.ox, TUILE); base < v.l; base += TUILE) {
    for (const e of ECLATS) {
      const f = (image + e.phase) % e.periode;
      if (f > 2) continue;
      const x = base + e.x;
      const y = H + Math.round(e.y);
      point(ctx, x, y);
      if (f === 1) {
        point(ctx, x - 1, y, 3, 1);
        point(ctx, x, y - 1, 1, 3);
      }
    }
  }

  // Écume à la proue : la vague se fend contre l'étrave (au-dessus de l'eau)
  // et son reflet en miroir dessous, calé sur la ligne d'eau. Segments :
  // [décalage x, hauteur au-dessus de l'eau, largeur].
  const pr = X(PROUE);
  const yb = H + bob;
  const houle = [0, 1, 2, 1][image % 4];
  const blanc = css(melC(a.mer[3], [255, 255, 255], 0.6));
  const vague: [number, number, number][] = [];
  for (let k = 0; k <= 5 + houle; k++) vague.push([-2 - k * 3, k + 1, 4 + k * 2]); // monte le long de la coque
  for (let k = 0; k < 4; k++) vague.push([1 + k * 4, 2 - (k >> 1), 6 - k]); // repoussée devant l'étrave
  vague.push([-26, 0, 34]); // la ligne d'écume au ras de l'eau
  ctx.fillStyle = blanc;
  for (const [dx, dy, l] of vague) point(ctx, pr + dx, yb - dy, l, 1);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = clair;
  for (const [dx, dy, l] of vague) if (dy > 0) point(ctx, pr + dx, yb + dy, l, 1);
  ctx.globalAlpha = 1;
  // Sillage : traits d'écume qui filent vers l'arrière le long de la coque.
  for (let k = 0; k < 18; k++) {
    const x = pr - 30 - ((image * 7 + k * 41) % 480);
    const age = (pr - 30 - x) / 480;
    ctx.fillStyle = age < 0.35 ? blanc : clair;
    point(ctx, x, yb + 1 + (k % 5), Math.max(2, Math.round(16 * (1 - age))), 1);
  }
  // Embruns : quelques gouttes projetées en arc devant l'étrave.
  ctx.fillStyle = blanc;
  for (let k = 0; k < 9; k++) {
    const q = ((image + k * 2) % 8) / 8;
    point(ctx, pr + 2 + q * (14 + k * 3), yb - 5 - Math.sin(q * Math.PI) * (6 + k * 1.5), k % 3 ? 1 : 2, 1);
  }
}

// Halos des lanternes : disques à deux anneaux, qui vacillent.
function dessinerLumieres(ctx: CanvasRenderingContext2D, image: number, nuit: number, bob: number, v: Vue) {
  if (nuit < 0.15) return;
  for (const [i, l] of LUMIERES.entries()) {
    const vacille = (image + i * 3) % 9 === 0 ? -1 : 0;
    const x = l.x - v.ox;
    const y = l.y - v.oy + bob;
    ctx.globalAlpha = 0.16 * nuit;
    ctx.fillStyle = '#ffb04a';
    disque(ctx, x, y, l.r + vacille);
    ctx.globalAlpha = 0.22 * nuit;
    ctx.fillStyle = '#ffd27a';
    disque(ctx, x, y, Math.round(l.r / 2) + vacille);
  }
  ctx.globalAlpha = 1;
}

// --- Un perso ---------------------------------------------------------------

const FIN_DE_TRAVAIL: Record<StatutMembreQG, string | null> = { pause: null, travail: null, fini: '✓ Terminé !', erreur: '⚠ Un souci…' };
const court = (s: string) => {
  const t = s.split(' : ')[0];
  return t.length > 34 ? `${t.slice(0, 33)}…` : t;
};
const auHasard = <T,>(liste: T[]) => liste[Math.floor(Math.random() * liste.length)];
function choisirHabitude(liste: Habitude[], avant: Habitude | null) {
  const choix = liste.filter((h) => h !== avant);
  const total = choix.reduce((s, h) => s + (h.poids ?? 1), 0);
  let tirage = Math.random() * total;
  return choix.find((h) => (tirage -= h.poids ?? 1) < 0) ?? choix[0];
}

export type VieQG = { fait: string; pense: string };

// Bulles rares : une seule à la fois sur tout le navire, et seulement quand
// c'est intéressant (une nouvelle action en mission, une mission finie ou
// ratée, de temps en temps une pensée).
let bulleOccupeeJusqua = 0;
const DUREE_BULLE = 5000;
const prendreLaParole = (duree: number, prioritaire = false) => {
  const maintenant = performance.now();
  if (!prioritaire && maintenant < bulleOccupeeJusqua) return false;
  bulleOccupeeJusqua = maintenant + duree + 1500;
  return true;
};

// Un membre à bord : il travaille à son poste pendant une mission (dans sa
// pose de travail), et le reste du temps il suit ses habitudes : il marche
// d'un endroit à l'autre (par les échelles), s'occupe, dort. Ce qu'il fait et
// pense remonte à sa fiche.
function Perso({
  membre,
  poste,
  prive,
  choisi,
  cache,
  onVie,
}: {
  membre: MembreQG;
  poste: PosteQG;
  prive: boolean;
  choisi: boolean;
  cache: boolean;
  onVie: (id: IdQG, vie: VieQG) => void;
}) {
  const id = membre.id as IdQG;
  const corps = useRef<HTMLSpanElement>(null);
  const [pose, setPose] = useState<'normal' | 'travail'>('normal');
  const [dort, setDort] = useState(false);
  const [pensee, setPensee] = useState<string | null>(null);
  const statut = membre.statut;
  const onVieRef = useRef(onVie);
  useEffect(() => {
    onVieRef.current = onVie;
  });

  useEffect(() => {
    const el = corps.current;
    if (!el) return;
    const fiche = FICHES[id];
    // Position : reprise là où il était (pas de téléportation au changement de statut).
    const depart = el.dataset.x ? { x: Number(el.dataset.x), y: Number(el.dataset.y) } : statut === 'pause' ? auHasard(poste.habitudes) : poste.travail;
    let x = depart.x;
    let y = depart.y;
    let route: [number, number][] = [];
    let habitude: Habitude | null = null;
    let reste = 0; // secondes à passer sur place
    let sens = -1;
    let dernier = performance.now();
    let prochainePensee = performance.now() + 15000 + Math.random() * 45000;
    let finPensee = 0;
    let fait = '';
    let pense = auHasard(fiche.pensees[statut]);
    let anim = 0;

    const dire = (nouveau: string) => {
      if (nouveau === fait) return;
      fait = nouveau;
      onVieRef.current(id, { fait, pense });
    };
    const allerA = (b: { x: number; y: number }) => {
      route = chemin({ x, y }, b).slice(1);
    };
    if (statut === 'pause') {
      habitude = choisirHabitude(poste.habitudes, null);
      allerA(habitude);
    } else allerA(poste.travail);
    setDort(false);
    setPose('normal');
    onVieRef.current(id, { fait: '', pense });

    const image = (ms: number) => {
      const t = ms / 1000;
      const dt = Math.min(0.1, (ms - dernier) / 1000);
      dernier = ms;
      let saut = 0;
      let squash = 0;
      let travaille = false;

      if (route.length) {
        // Marche vers le prochain point (vertical = il grimpe à l'échelle).
        const [cx, cy] = route[0];
        const dx = cx - x;
        const dy = cy - y;
        const d = Math.hypot(dx, dy);
        const pas = 34 * dt;
        if (d <= pas) {
          x = cx;
          y = cy;
          route.shift();
        } else {
          x += (dx / d) * pas;
          y += (dy / d) * pas;
        }
        if (Math.abs(dx) > 0.5) {
          sens = dx < 0 ? -1 : 1;
          saut = Math.floor(t * 8) % 2 ? 2 : 0;
        }
        setDort(false);
        dire(Math.abs(dy) > Math.abs(dx) ? 'grimpe à l’échelle' : habitude && statut === 'pause' ? `en route : ${habitude.quoi}` : 'rejoint son poste');
      } else if (statut === 'travail') {
        travaille = true;
        dire(`travaille à son poste (${fiche.lieu.toLowerCase()})`);
      } else if (statut === 'pause' && habitude) {
        if (reste <= 0) reste = 7 + Math.random() * 9;
        reste -= dt;
        if (habitude.action === 'dort') {
          squash = 9 + (Math.floor(t * 0.8) % 2);
          setDort(true);
        } else if (habitude.action === 'travaille') travaille = true;
        dire(habitude.quoi);
        if (reste <= 0) {
          setDort(false);
          habitude = choisirHabitude(poste.habitudes, habitude);
          allerA(habitude);
        }
      } else {
        dire(statut === 'fini' ? 'attend tes ordres, mission finie' : 'a besoin de toi : la mission a échoué');
      }

      // Au travail, il reste dans sa pose de travail (petit mouvement de temps en temps).
      setPose(travaille ? 'travail' : 'normal');
      if (travaille && saut === 0 && Math.floor(t * 2) % 5 === 0) saut = 1;
      if (squash === 0 && saut === 0 && Math.floor(t * 1.4) % 2) squash = -1; // respiration

      // Une pensée de temps en temps (générique : rien de privé). Elle va
      // toujours dans sa fiche ; en bulle, seulement s'il est réveillé, posé
      // (pas en marche) et que personne d'autre ne parle.
      if (ms > prochainePensee) {
        pense = auHasard(fiche.pensees[statut]);
        onVieRef.current(id, { fait, pense });
        if (statut === 'pause' && habitude?.action !== 'dort' && !route.length && prendreLaParole(4500)) {
          setPensee(pense);
          finPensee = ms + 4500;
        }
        prochainePensee = ms + 50000 + Math.random() * 70000;
      }
      if (finPensee && ms > finPensee) {
        setPensee(null);
        finPensee = 0;
      }

      el.dataset.x = String(x);
      el.dataset.y = String(y);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - saut)}px)`;
      el.style.setProperty('--sens', String(sens));
      el.style.setProperty('--squash', `${squash}px`);
      anim = requestAnimationFrame(image);
    };
    anim = requestAnimationFrame(image);
    return () => cancelAnimationFrame(anim);
  }, [statut, poste, id]);

  // Bulle de mission, quelques secondes seulement : au début, à chaque nouvelle
  // action (« Robin cherche sur le web… »), puis à la fin (terminé / souci).
  // En tournage (prive), jamais le contenu d'une mission : le verbe du poste.
  const [bulle, setBulle] = useState<string | null>(null);
  const activite = statut === 'travail' ? (prive ? null : membre.activite) : null;
  useEffect(() => {
    const texte =
      statut === 'travail' ? `${membre.nom} ${activite ? court(activite) : poste.verbe}…` : FIN_DE_TRAVAIL[statut];
    if (!texte) return setBulle(null);
    const duree = statut === 'travail' ? DUREE_BULLE : 8000;
    // Fin de mission : prioritaire. Action en cours : seulement si personne ne parle.
    if (!prendreLaParole(duree, statut !== 'travail')) return;
    setBulle(texte);
    const minuteur = setTimeout(() => setBulle(null), duree);
    return () => clearTimeout(minuteur);
  }, [statut, activite, membre.nom, poste.verbe]);

  return (
    <span
      ref={corps}
      className={choisi ? `${styles.perso} ${styles.persoChoisi}` : styles.perso}
      data-perso={id}
      data-statut={statut}
      style={cache ? { visibility: 'hidden' } : undefined}
    >
      <span className={styles.silhouette}>
        <img src={`/qg/${id}-${pose}.png`} alt={membre.nom} draggable={false} />
      </span>
      {dort && (
        <span className={styles.zzz} aria-hidden="true">
          <i>z</i>
          <i>z</i>
          <i>Z</i>
        </span>
      )}
      {bulle ? (
        <span className={styles.bulle} data-statut={statut}>
          {bulle}
        </span>
      ) : (
        pensee && <span className={`${styles.bulle} ${styles.pensee}`}>{pensee}</span>
      )}
    </span>
  );
}

// --- Passation : le membre porte son travail jusqu'à la pièce du suivant ------

const DUREE_MARCHE = 6.2; // secondes

function Messager({ de, vers }: { de: IdMembreQG; vers: IdMembreQG }) {
  const corps = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = corps.current;
    if (!el) return;
    const points = chemin(POSTES[de].travail, POSTES[vers].travail);
    const longueurs = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
    const total = longueurs.reduce((s, l) => s + l, 0) || 1;
    const debut = performance.now();
    let anim = 0;
    const image = (ms: number) => {
      const t = Math.min(1, (ms - debut) / 1000 / DUREE_MARCHE);
      let reste = t * total;
      let k = 0;
      while (k < longueurs.length - 1 && reste > longueurs[k]) reste -= longueurs[k++];
      const f = longueurs[k] ? reste / longueurs[k] : 1;
      const [x0, y0] = points[k];
      const [x1, y1] = points[k + 1];
      const grimpe = x0 === x1;
      const saut = grimpe ? 0 : Math.floor(ms / 125) % 2 ? 2 : 0;
      el.style.transform = `translate(${Math.round(x0 + (x1 - x0) * f)}px, ${Math.round(y0 + (y1 - y0) * f - saut)}px)`;
      if (!grimpe) el.style.setProperty('--sens', x1 < x0 ? '-1' : '1');
      if (t < 1) anim = requestAnimationFrame(image);
    };
    anim = requestAnimationFrame(image);
    return () => cancelAnimationFrame(anim);
  }, [de, vers]);
  return (
    <span ref={corps} className={styles.perso} aria-hidden="true">
      <span className={styles.silhouette}>
        <img src={`/qg/${de}-normal.png`} alt="" draggable={false} />
      </span>
      <span className={styles.rouleau} />
    </span>
  );
}

// --- La scène et sa caméra ---------------------------------------------------

// Barre d'ordres : le bas de l'écran (~120 pixels écran) en laisse voir la mer.
// En tournage, elle disparaît : tout l'écran est à la scène.
const BARRE = 120;
// L'écran (pixels de l'écran) et la hauteur cachée en bas par la barre.
type Ecran = { l: number; h: number; barre: number };
// Zoom par demi-crans (x2, x2,5, x3…) : une fois arrêté, chaque pixel du
// bateau fait 2 ou 3 pixels d'écran, en alternance régulière, jamais flou.
const demi = (z: number) => Math.max(1, Math.floor(z * 2) / 2);
// Le dessin entier (du drapeau au bas de la coque) et un peu d'air autour.
const DESSIN = { gauche: -40, droite: BATEAU.l + 40, haut: -HAUT - 20, bas: FLOTTAISON + 50 };
// Zoom minimal = vue générale : tout le bateau tient à l'écran, au-dessus de la barre.
const zoomMin = (e: Ecran) => demi(Math.min(e.l / (DESSIN.droite - DESSIN.gauche), (e.h - e.barre) / (DESSIN.bas - DESSIN.haut)));
// Zoom maximal : on voit toujours au moins ~420 pixels du monde en largeur
// (deux pièces), jamais un perso en gros plan.
const LARGEUR_MIN = 420;
const zoomMax = (e: Ecran) => Math.max(zoomMin(e), demi(e.l / LARGEUR_MIN));
const bornerZoom = (z: number, e: Ecran) => Math.max(zoomMin(e), Math.min(zoomMax(e), z));
// Centre de la vue générale : le milieu du dessin, au milieu de la partie visible.
const centreGeneral = (z: number, e: Ecran) => ({ cx: (DESSIN.gauche + DESSIN.droite) / 2, cy: (DESSIN.haut + DESSIN.bas) / 2 + e.barre / z / 2 });
// Vue générale (et toujours en tournage) : tout le bateau, centré.
function visee(choisi: IdQG | null, e: Ecran, marge: number) {
  if (!choisi) {
    const z = zoomMin(e);
    return { z, ...centreGeneral(z, e) };
  }
  const poste = POSTES[choisi];
  const z = bornerZoom(demi(Math.min((e.l - marge) / 250, (e.h - e.barre) / 190)), e);
  // Centré dans la partie visible, à gauche du parchemin.
  return { z, cx: poste.camera.x + marge / z / 2, cy: poste.camera.y + e.barre / z / 2 };
}

// Bornes du centre de la caméra pour un zoom donné : un peu de ciel et de mer
// autour du bateau, et de la mer au-dessus de la barre d'ordres. Quand la vue
// est plus grande que tout ça, le bateau reste au centre.
const MARGE_COTES = 200;
function borner(p: { cx: number; cy: number }, z: number, e: Ecran) {
  const lv = e.l / z;
  const hv = e.h / z;
  const centre = centreGeneral(z, e);
  const [g, d] = [DESSIN.gauche - MARGE_COTES + lv / 2, DESSIN.droite + MARGE_COTES - lv / 2];
  const [h, b] = [DESSIN.haut - 60 + hv / 2, DESSIN.bas + e.barre / z - hv / 2];
  p.cx = g > d ? centre.cx : Math.min(d, Math.max(g, p.cx));
  p.cy = h > b ? centre.cy : Math.min(b, Math.max(h, p.cy));
}

type Ancre = { wx: number; wy: number; mx: number; my: number };

const CAPITAINE: MembreQG ={ id: 'capitaine' as IdMembreQG, nom: 'Capitaine', poste: 'Capitaine', statut: 'pause', missionId: null, activite: null, depuis: null };

export function QGNavire({
  membres,
  choisi,
  prive,
  marge,
  passation,
  onChoisir,
  onVie,
}: {
  membres: MembreQG[];
  passation: { de: IdMembreQG; vers: IdMembreQG; a: number } | null;
  choisi: IdQG | null;
  prive: boolean; // mode tournage : aucune info de mission dans la scène
  marge: number; // largeur (pixels CSS) cachée à droite par le parchemin
  onChoisir: (id: IdQG | null) => void;
  onVie: (id: IdQG, vie: VieQG) => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const ciel = useRef<HTMLCanvasElement>(null);
  const mer = useRef<HTMLCanvasElement>(null);
  const monde = useRef<HTMLDivElement>(null);
  const bateau = useRef<HTMLDivElement>(null);
  const heure = useHeure();
  const ambiance = ambianceA(heure);
  const etat = useRef({ ambiance, heure, onChoisir });
  useEffect(() => {
    etat.current = { ambiance, heure, onChoisir };
  });

  // Caméra : centre (pixels du monde) et zoom, avec leur cible (zoom par
  // demi-crans). ancre : le point du monde qui reste sous la souris pendant un
  // zoom à la molette.
  const camera = useRef({ cx: 0, cy: 0, z: 1, vise: { cx: 0, cy: 0, z: 1 }, ancre: null as Ancre | null, pret: false });
  // L'écran en pixels d'écran, et la barre d'ordres (absente en tournage).
  const tournage = useRef(prive);
  const ecran = (el: HTMLElement): Ecran => {
    const dpr = window.devicePixelRatio || 1;
    return { l: el.clientWidth * dpr, h: el.clientHeight * dpr, barre: tournage.current ? 0 : BARRE };
  };

  // La caméra va sur le membre choisi (zoom sur sa pièce), ou revient à la vue
  // générale. En tournage : toujours tout le bateau, centré. Recadré aussi quand
  // la taille change (passage en plein écran, fenêtre redimensionnée).
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    tournage.current = prive;
    const viser = () => {
      const dpr = window.devicePixelRatio || 1;
      camera.current.vise = visee(prive ? null : choisi, ecran(el), prive ? 0 : marge * dpr);
      camera.current.ancre = null;
    };
    viser();
    let taille = `${el.clientWidth}×${el.clientHeight}`;
    const obs = new ResizeObserver(() => {
      const t = `${el.clientWidth}×${el.clientHeight}`;
      if (t === taille) return;
      taille = t;
      viser();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [choisi, marge, prive]);

  // Glisser pour se déplacer, molette pour zoomer (d'un demi-cran).
  // Un clic (sans glisser) choisit un perso, ou ferme tout s'il tombe à côté.
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    let depart: { x: number; y: number; cx: number; cy: number; bouge: boolean } | null = null;
    const bas = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const c = camera.current;
      depart = { x: e.clientX, y: e.clientY, cx: c.cx, cy: c.cy, bouge: false };
    };
    const bouge = (e: PointerEvent) => {
      if (!depart) return;
      const dx = e.clientX - depart.x;
      const dy = e.clientY - depart.y;
      if (!depart.bouge && Math.hypot(dx, dy) < 5) return;
      if (!depart.bouge) el.setPointerCapture(e.pointerId);
      depart.bouge = true;
      // La cible suit la souris ; la caméra la rattrape en douceur (boucle).
      const c = camera.current;
      const dpr = window.devicePixelRatio || 1;
      c.ancre = null;
      c.vise.cx = depart.cx - (dx * dpr) / c.z;
      c.vise.cy = depart.cy - (dy * dpr) / c.z;
    };
    const haut = (e: PointerEvent) => {
      if (!depart) return;
      const clic = !depart.bouge;
      depart = null;
      if (!clic) return;
      const perso = (e.target as HTMLElement).closest('[data-perso]')?.getAttribute('data-perso');
      etat.current.onChoisir((perso as IdQG | null) ?? null);
    };
    let derniereMolette = 0;
    const molette = (e: WheelEvent) => {
      e.preventDefault();
      // Un demi-cran à la fois (un pavé tactile envoie des rafales d'événements).
      if (e.timeStamp - derniereMolette < 90 || e.deltaY === 0) return;
      derniereMolette = e.timeStamp;
      const c = camera.current;
      const dpr = window.devicePixelRatio || 1;
      const E = ecran(el);
      const L = E.l;
      const H = E.h;
      const z = bornerZoom(c.vise.z + (e.deltaY < 0 ? 0.5 : -0.5), E);
      if (z === c.vise.z) return;
      // Le point sous la souris reste sous la souris pendant tout le zoom.
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;
      c.ancre = { mx, my, wx: c.cx - L / (2 * c.z) + mx / c.z, wy: c.cy - H / (2 * c.z) + my / c.z };
      c.vise.z = z;
    };
    el.addEventListener('pointerdown', bas);
    el.addEventListener('pointermove', bouge);
    el.addEventListener('pointerup', haut);
    el.addEventListener('wheel', molette, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', bas);
      el.removeEventListener('pointermove', bouge);
      el.removeEventListener('pointerup', haut);
      el.removeEventListener('wheel', molette);
    };
  }, []);

  // Une boucle pour tout : caméra, ciel, mer, halos, et le bateau qui monte
  // et descend d'un pixel (une rotation brouillerait le pixel art).
  useEffect(() => {
    const el = cadre.current;
    const cvCiel = ciel.current;
    const cvMer = mer.current;
    const cc = cvCiel?.getContext('2d');
    const cm = cvMer?.getContext('2d');
    if (!el || !cvCiel || !cvMer || !cc || !cm) return;
    let ombre: HTMLCanvasElement | null = null;
    const img = new Image();
    img.onload = () => (ombre = silhouette(img));
    img.src = IMAGE_BATEAU;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let id = 0;
    let derniereCle = '';
    let avant = 0;

    const boucle = (ms: number) => {
      const c = camera.current;
      const dpr = window.devicePixelRatio || 1;
      const E = ecran(el);
      const L = E.l;
      const H = E.h;
      const dt = Math.min(0.05, avant ? (ms - avant) / 1000 : 0);
      avant = ms;
      if (!c.pret && L > 0 && H > 0) {
        c.vise = visee(null, E, 0);
        Object.assign(c, { cx: c.vise.cx, cy: c.vise.cy, z: c.vise.z, pret: true });
      }
      // Mouvements amortis, au même rythme quelle que soit la fréquence de
      // l'écran. Le zoom glisse en continu et s'arrête net sur son demi-cran.
      c.vise.z = bornerZoom(c.vise.z, E);
      const amorti = (vitesse: number) => (reduit ? 1 : 1 - Math.exp(-dt * vitesse));
      c.z += (c.vise.z - c.z) * amorti(16);
      if (Math.abs(c.vise.z - c.z) < 0.01) c.z = c.vise.z;
      if (c.ancre) {
        // Zoom à la molette : le point visé reste sous la souris.
        const a = c.ancre;
        c.cx = c.vise.cx = a.wx - a.mx / c.z + L / (2 * c.z);
        c.cy = c.vise.cy = a.wy - a.my / c.z + H / (2 * c.z);
        if (c.z === c.vise.z) c.ancre = null;
      } else {
        borner(c.vise, c.vise.z, E);
        const k = amorti(14);
        c.cx += (c.vise.cx - c.cx) * k;
        c.cy += (c.vise.cy - c.cy) * k;
      }
      borner(c, c.z, E);

      // Le coin de la vue, calé au pixel d'ÉCRAN près (pas au pixel du monde) :
      // les déplacements sont fluides et l'image reste nette. Le ciel et la mer
      // sont dessinés au pixel du monde (v.ox, v.oy) puis décalés du reste.
      const lv = Math.ceil(L / c.z) + 1;
      const hv = Math.ceil(H / c.z) + 1;
      const ox = Math.round((c.cx - L / (2 * c.z)) * c.z) / c.z;
      const oy = Math.round((c.cy - H / (2 * c.z)) * c.z) / c.z;
      const v: Vue = { ox: Math.floor(ox), oy: Math.floor(oy), l: lv, h: hv };
      const echelle = c.z / dpr; // pixels CSS par pixel du monde

      if (cvCiel.width !== lv || cvCiel.height !== hv || cvCiel.dataset.z !== String(c.z)) {
        for (const cv of [cvCiel, cvMer]) {
          cv.width = lv;
          cv.height = hv;
          cv.dataset.z = String(c.z);
          cv.style.width = `${lv * echelle}px`;
          cv.style.height = `${hv * echelle}px`;
        }
        derniereCle = '';
      }
      const reste = `translate(${-(ox - v.ox) * echelle}px, ${-(oy - v.oy) * echelle}px)`;
      cvCiel.style.transform = cvMer.style.transform = reste;
      monde.current!.style.transform = `scale(${echelle}) translate(${-ox}px, ${-oy}px)`;
      monde.current!.style.setProperty('--zoom', String(echelle));

      const image = reduit ? 0 : Math.floor((ms / 1000) * IPS_MER);
      const t = image / IPS_MER;
      const bob = [0, 0, 1, 1, 0, 0, -1, -1][Math.floor(t * 1.2) % 8] ?? 0;
      if (bateau.current) bateau.current.style.transform = `translateY(${bob}px)`;

      const cle = `${image}|${v.ox}|${v.oy}|${c.z}`;
      if (cle !== derniereCle) {
        derniereCle = cle;
        const { ambiance: a, heure: hr } = etat.current;
        dessinerCiel(cc, t, a, hr, v);
        dessinerMer(cm, image, a, bob, ombre, v);
        dessinerLumieres(cm, image, a.nuit, bob, v);
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div ref={cadre} className={styles.cadre} style={{ ['--nuit' as string]: ambiance.nuit.toFixed(2) }}>
      <canvas ref={ciel} className={styles.calque} />
      <div ref={monde} className={styles.monde}>
        <div ref={bateau} className={styles.bateau} style={{ width: BATEAU.l, height: BATEAU.h - HAUT }}>
          <img
            src={IMAGE_BATEAU}
            alt="L'Obstiné, le navire de l'équipage"
            className={styles.coque}
            style={{ top: -HAUT, width: BATEAU.l, height: BATEAU.h }}
            draggable={false}
          />
          <span className={styles.nom} style={{ left: 503, top: 310 }}>
            L'Obstiné
          </span>
          {[...membres, CAPITAINE].map((m) => (
            <Perso key={m.id} membre={m} poste={POSTES[m.id as IdQG]} prive={prive} choisi={choisi === m.id} cache={passation?.de === m.id} onVie={onVie} />
          ))}
          {passation && <Messager key={passation.a} de={passation.de} vers={passation.vers} />}
        </div>
      </div>
      <canvas ref={mer} className={styles.calque} />
    </div>
  );
}
