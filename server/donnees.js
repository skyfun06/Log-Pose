// Données synchronisées entre appareils (PC, téléphone via Tailscale).
// Le front garde ses données dans le localStorage ; il en envoie ici une copie
// à chaque changement, et récupère celle des autres appareils à l'ouverture.
// Une entrée par clé du localStorage : { valeur, maj } (maj = horodatage du
// changement). La plus récente gagne.

import { readFile, rename, writeFile } from 'node:fs/promises';

const FICHIER_DONNEES = new URL('./.donnees.json', import.meta.url);

// Seules ces clés du localStorage sont acceptées.
export const CLES_SYNCHRO = ['log-pose-state', 'log-pose-habitudes', 'log-pose-budget', 'log-pose-cerveau-categories'];

let donnees = null;

async function charger() {
  if (donnees) return donnees;
  try {
    donnees = JSON.parse(await readFile(FICHIER_DONNEES, 'utf8'));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    donnees = {};
  }
  return donnees;
}

// Écriture dans un fichier temporaire puis renommage : un arrêt brutal ne
// laisse jamais un fichier à moitié écrit. Une écriture à la fois.
let ecriture = Promise.resolve();
function sauver() {
  ecriture = ecriture
    .catch(() => {})
    .then(async () => {
      const temporaire = new URL('./.donnees.json.tmp', import.meta.url);
      await writeFile(temporaire, JSON.stringify(donnees));
      await rename(temporaire, FICHIER_DONNEES);
    });
  return ecriture;
}

export async function lireDonnees() {
  return charger();
}

// Garde la valeur si elle est plus récente que celle déjà connue. Renvoie
// l'entrée retenue (celle du serveur si elle était plus récente).
export async function ecrireDonnee(cle, valeur, maj) {
  if (!CLES_SYNCHRO.includes(cle)) throw new Error(`Clé inconnue : ${cle}`);
  if (typeof valeur !== 'string' || !Number.isFinite(maj)) throw new Error('Donnée invalide.');
  const tout = await charger();
  const actuelle = tout[cle];
  if (actuelle && actuelle.maj > maj) return actuelle;
  tout[cle] = { valeur, maj };
  await sauver();
  return tout[cle];
}
