// Prépare les images du QG en pixel art (onglet « QG ») à partir des
// originaux de equipage/qg-assets/ :
//   - fond vert effacé (seulement le vert relié aux bords, plus les trous
//     de la couleur exacte du fond : le vert d'un perso n'est pas mangé) ;
//   - reflets verts retirés sur les contours ;
//   - réduit à sa vraie taille de pixel art, palette limitée, bords nets
//     (pixel entièrement visible ou entièrement transparent) ;
//   - persos à la même hauteur.
// Résultat dans public/qg/. À relancer après avoir changé une image :
//   node scripts/qg-images.mjs            (tout)
//   node scripts/qg-images.mjs bateau robin   (seulement ceux-là)

import sharp from 'sharp';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = process.env.QG_ASSETS ?? 'C:/Users/Borrelli/Desktop/dev/business/equipage/qg-assets';
const SORTIE = fileURLToPath(new URL('../public/qg/', import.meta.url));

const LARGEUR_BATEAU = 440; // pixels « réels » du bateau
const HAUTEUR_PERSO = 64; // tous les persos à cette hauteur
const PERSOS = ['nami', 'robin', 'franky', 'brook', 'zoro', 'capitaine'];
const POSES = ['normal', 'travail'];

const distance = (d, i, c) => Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);
const estVert = (d, i) => d[i + 1] > 80 && d[i + 1] - Math.max(d[i], d[i + 2]) > 50;

// toutVert : l'image ne contient aucun vert (le bateau) : tout vert est effacé,
// même piégé entre les cordages.
// rogner : retirer les bords transparents (non pour le bateau HD : ses
// coordonnées doivent rester celles de l'image).
async function detourer(fichier, { toutVert = false, rogner = true } = {}) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: L, height: H } = info;
  // Couleur du fond : moyenne des 4 coins.
  const coins = [0, L - 1, (H - 1) * L, H * L - 1].map((p) => p * 4);
  const fond = [0, 1, 2].map((k) => coins.reduce((s, i) => s + data[i + k], 0) / 4);

  const efface = new Uint8Array(L * H);
  // 1) Remplissage depuis les bords : tout vert relié au fond.
  const pile = [];
  for (let x = 0; x < L; x++) pile.push(x, (H - 1) * L + x);
  for (let y = 0; y < H; y++) pile.push(y * L, y * L + L - 1);
  while (pile.length) {
    const p = pile.pop();
    if (efface[p]) continue;
    const i = p * 4;
    if (!(estVert(data, i) && distance(data, i, fond) < 170)) continue;
    efface[p] = 1;
    const x = p % L;
    if (x > 0) pile.push(p - 1);
    if (x < L - 1) pile.push(p + 1);
    if (p >= L) pile.push(p - L);
    if (p < L * (H - 1)) pile.push(p + L);
  }
  // 2) Trous fermés (entre un bras et le corps) : couleur très proche du fond.
  for (let p = 0; p < L * H; p++) {
    const i = p * 4;
    if (!efface[p] && (distance(data, i, fond) < 70 || (toutVert && data[i + 1] > Math.max(data[i], data[i + 2]) + 18))) efface[p] = 1;
  }

  for (let p = 0; p < L * H; p++) {
    const i = p * 4;
    if (efface[p]) {
      data[i + 3] = 0;
      continue;
    }
    // Reflet vert sur les contours : le vert ramené au niveau des autres couleurs.
    const max = Math.max(data[i], data[i + 2]);
    const marge = toutVert ? 0 : 25;
    if (data[i + 1] > max + marge) data[i + 1] = max + marge;
  }
  const image = sharp(data, { raw: info });
  return rogner ? image.trim({ threshold: 1 }) : image;
}

// Réduit en vrais pixels : pas de demi-transparence, palette limitée.
async function pixeliser(image, options, couleurs, nom) {
  const reduit = await sharp(await image.png().toBuffer())
    .resize({ ...options, kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = reduit;
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 140 ? 255 : 0;
  await sharp(data, { raw: info })
    .png({ palette: true, colors: couleurs, dither: 0, compressionLevel: 9 })
    .toFile(`${SORTIE}${nom}.png`);
  console.log(`✓ ${nom}.png  ${info.width}×${info.height}`);
}

const demandes = process.argv.slice(2);
const veut = (nom) => demandes.length === 0 || demandes.includes(nom);
if (!existsSync(SORTIE)) mkdirSync(SORTIE, { recursive: true });

// Bateau HD : moitié de la taille d'origine (688 px), palette large : le
// maximum de détail qui reste du vrai pixel art.
if (veut('bateau-hd') && existsSync(`${SOURCE}/bateau-hd.jpg`)) {
  await pixeliser(await detourer(`${SOURCE}/bateau-hd.jpg`, { toutVert: true, rogner: false }), { width: 688 }, 160, 'bateau-hd');
}
// Bateau avec sa proue entière (1024 × 408) : réduit à 963 px de large, ses
// pièces tombent pile sur celles du bateau HD (même échelle), à 1 pixel près
// en hauteur, retiré en haut : les coordonnées de equipageQG.ts restent bonnes.
if (veut('bateau-proue') && existsSync(`${SOURCE}/bateau-proue.jpg`)) {
  await pixeliser(await detourer(`${SOURCE}/bateau-proue.jpg`, { toutVert: true, rogner: false }), { width: 963 }, 160, 'bateau-proue-brut');
  const brut = `${SORTIE}bateau-proue-brut.png`;
  const { width, height } = await sharp(brut).metadata();
  await sharp(brut).extract({ left: 0, top: 1, width, height: height - 1 }).png({ palette: true, colors: 160, dither: 0, compressionLevel: 9 }).toFile(`${SORTIE}bateau-proue.png`);
  unlinkSync(brut);
  console.log(`✓ bateau-proue.png  ${width}×${height - 1}`);
}
if (veut('bateau')) {
  await pixeliser(await detourer(`${SOURCE}/bateau.jpg`, { toutVert: true }), { width: LARGEUR_BATEAU }, 64, 'bateau');
}
for (const perso of PERSOS) {
  if (!veut(perso)) continue;
  for (const pose of POSES) {
    const fichier = ['jpeg', 'jpg', 'png'].map((ext) => `${SOURCE}/persos/${perso}-${pose}.${ext}`).find(existsSync);
    if (!fichier) {
      console.warn(`⚠ manque ${perso}-${pose}`);
      continue;
    }
    await pixeliser(await detourer(fichier), { height: HAUTEUR_PERSO }, 24, `${perso}-${pose}`);
  }
}

// Portraits du bandeau : la tête de chaque perso, centrée dans un carré.
// Le centre du visage = milieu des pixels visibles dans le haut du sprite.
async function portrait(perso) {
  const { data, info } = await sharp(`${SORTIE}${perso}-normal.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: L, height: H } = info;
  const opaque = (x, y) => data[(y * L + x) * 4 + 3] > 0;
  let haut = 0;
  while (haut < H && ![...Array(L).keys()].some((x) => opaque(x, haut))) haut++;
  let somme = 0;
  let n = 0;
  for (let y = haut; y < Math.min(H, haut + 16); y++) {
    for (let x = 0; x < L; x++) if (opaque(x, y)) (somme += x), n++;
  }
  const COTE = 36; // toute la tête et le haut des épaules
  const cx = Math.round(n ? somme / n : L / 2);
  const gauche = cx - COTE / 2;
  const fond = { r: 0, g: 0, b: 0, alpha: 0 };
  // Agrandit la toile si le carré déborde du sprite, puis découpe.
  const agrandi = await sharp(`${SORTIE}${perso}-normal.png`)
    .extend({ top: COTE, bottom: COTE, left: COTE, right: COTE, background: fond })
    .png()
    .toBuffer();
  await sharp(agrandi)
    .extract({ left: gauche + COTE, top: Math.max(0, haut - 2) + COTE, width: COTE, height: COTE })
    .png()
    .toFile(`${SORTIE}${perso}-portrait.png`);
  console.log(`✓ ${perso}-portrait.png`);
}
for (const perso of PERSOS) if (veut(perso) && existsSync(`${SORTIE}${perso}-normal.png`)) await portrait(perso);
