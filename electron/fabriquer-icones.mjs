// Fabrique les icônes de l'appli (logpose.ico + logpose.png) à partir de
// logpose.svg. À relancer seulement si tu changes le dessin :
//   node electron/fabriquer-icones.mjs
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const dossier = new URL('./icones/', import.meta.url);
const svg = await readFile(new URL('logpose.svg', dossier));
const rendre = (taille) => sharp(svg, { density: 384 }).resize(taille, taille).png().toBuffer();

await writeFile(new URL('logpose.png', dossier), await rendre(512));

// Un .ico n'est qu'une liste de PNG précédée d'un petit sommaire.
const tailles = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(tailles.map(rendre));
const entete = Buffer.alloc(6 + 16 * tailles.length);
entete.writeUInt16LE(1, 2);
entete.writeUInt16LE(tailles.length, 4);
let position = entete.length;
tailles.forEach((taille, i) => {
  const o = 6 + 16 * i;
  entete.writeUInt8(taille % 256, o); // 256 s'écrit 0 dans le sommaire
  entete.writeUInt8(taille % 256, o + 1);
  entete.writeUInt16LE(1, o + 4);
  entete.writeUInt16LE(32, o + 6);
  entete.writeUInt32LE(images[i].length, o + 8);
  entete.writeUInt32LE(position, o + 12);
  position += images[i].length;
});
await writeFile(new URL('logpose.ico', dossier), Buffer.concat([entete, ...images]));
console.log('Icônes fabriquées dans electron/icones/');
