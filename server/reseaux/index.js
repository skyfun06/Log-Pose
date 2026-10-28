// Onglet « Réseaux » : une vidéo déposée part sur les plateformes choisies, et
// les stats de chaque compte remontent au même endroit.
//
// Ajouter une plateforme (Instagram, YouTube…) = un fichier dans ce dossier
// qui exporte la même interface que ./tiktok.js, puis une ligne dans
// PLATEFORMES ci-dessous :
//   id, nom, typesVideo          identité et types de vidéo acceptés
//   etat()                       { id, nom, configure, connecte, manque, destination, conseil, publique? }
//                                (publique : la vidéo sort tout de suite en public, pas en brouillon)
//   lienConnexion()              adresse d'autorisation OAuth
//   terminerConnexion(params)    paramètres renvoyés sur l'adresse de retour
//   deconnecter()
//   envoyerVideo(chemin, type, { legende }) → { idEnvoi }
//   statutEnvoi(idEnvoi)         → { etat: 'en-cours' | 'recue' | 'publiee' | 'echec', raison? }
//   stats({ forcer })            → { compte, videos, releveLe } (voir StatsReseau dans src/types.ts)
// Côté front, la plateforme s'ajoute dans PLATEFORMES de src/components/Reseaux.tsx.

import { ErreurReseau } from './commun.js';
import * as instagram from './instagram.js';
import * as tiktok from './tiktok.js';

export { ErreurReseau };

const PLATEFORMES = { tiktok, instagram };

// Services annexes à lancer avec le serveur (adresse publique des vidéos Instagram).
export function demarrerReseaux() {
  instagram.demarrerServeurPublic();
}

export function plateforme(id) {
  const p = Object.hasOwn(PLATEFORMES, id) ? PLATEFORMES[id] : null;
  if (!p) throw new ErreurReseau(404, `Plateforme inconnue : ${id}`);
  return p;
}

export function etatReseaux() {
  return Promise.all(Object.values(PLATEFORMES).map((p) => p.etat()));
}

// Types de vidéo acceptés par au moins une plateforme.
export const TYPES_VIDEO = [...new Set(Object.values(PLATEFORMES).flatMap((p) => p.typesVideo))];

// Envoie la même vidéo sur chaque plateforme demandée, l'une après l'autre.
// L'échec de l'une n'empêche pas les autres.
export async function envoyerPartout(chemin, type, cibles, infos) {
  const envois = [];
  for (const id of cibles) {
    try {
      envois.push({ plateforme: id, ...(await plateforme(id).envoyerVideo(chemin, type, infos)) });
    } catch (err) {
      if (!(err instanceof ErreurReseau)) console.error(`[Log Pose] Envoi ${id}:`, err?.message ?? err);
      envois.push({ plateforme: id, erreur: err?.message ?? 'erreur inconnue' });
    }
  }
  return envois;
}
