// Outils partagés par les plateformes de l'onglet « Réseaux ».

import { readFile, rename, rm, writeFile } from 'node:fs/promises';

export class ErreurReseau extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

// Jeton de connexion d'une plateforme, gardé dans server/.reseau-<id>.json
// (non commité) et en mémoire.
export function stockageJeton(id) {
  const fichier = new URL(`../.reseau-${id}.json`, import.meta.url);
  const temporaire = new URL(`../.reseau-${id}.json.tmp`, import.meta.url);
  let jeton; // undefined = pas encore lu, null = aucun compte relié

  return {
    async lire() {
      if (jeton !== undefined) return jeton;
      try {
        jeton = JSON.parse(await readFile(fichier, 'utf8'));
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
        jeton = null;
      }
      return jeton;
    },
    async sauver(nouveau) {
      jeton = nouveau;
      await writeFile(temporaire, JSON.stringify(nouveau));
      await rename(temporaire, fichier);
    },
    async effacer() {
      jeton = null;
      await rm(fichier, { force: true });
    },
  };
}

// Jetons anti-falsification des connexions OAuth en cours (10 minutes).
export function etatsOAuth() {
  const enAttente = new Map();
  return {
    creer(etat) {
      enAttente.set(etat, Date.now() + 10 * 60 * 1000);
      return etat;
    },
    verifier(etat) {
      const expire = enAttente.get(etat);
      enAttente.delete(etat);
      if (!expire || expire < Date.now()) {
        throw new ErreurReseau(400, 'Lien de connexion périmé : relance la connexion depuis Log Pose.');
      }
    },
  };
}
