// L'équipage du QG : qui ils sont, leurs habitudes à bord et ce qui leur
// passe par la tête. Sert à la scène (où ils vont, ce qu'ils font) et à leur
// fiche (clic sur un perso). Les pensées sont génériques : jamais le contenu
// d'une mission, donc rien de privé en mode tournage.

import type { IdMembreQG, StatutMembreQG } from '../types';

export type IdQG = IdMembreQG | 'capitaine';

export interface FicheQG {
  nom: string;
  poste: string;
  lieu: string; // son poste de travail à bord
  devise: string;
  peut: string; // ce qu'il a le droit de faire depuis le QG
  pensees: Record<StatutMembreQG, string[]>;
}

export const FICHES: Record<IdQG, FicheQG> = {
  capitaine: {
    nom: 'Capitaine',
    poste: 'Capitaine',
    lieu: 'La proue',
    devise: 'Devenir roi des pirates, une brique par jour.',
    peut: 'Tout décider. Personne ne dit GO à ta place.',
    pensees: {
      pause: ['Lancement en janvier 2027. On tient le cap.', 'Une brique par jour, pas une de moins.', 'Le vent tourne en notre faveur.', 'Qui je mets sur la prochaine mission ?'],
      travail: ['Je tiens la barre.'],
      fini: ['Bien joué, l’équipage.'],
      erreur: ['On recommence, c’est tout.'],
    },
  },
  nami: {
    nom: 'Nami',
    poste: 'Navigatrice',
    lieu: 'La salle des cartes',
    devise: 'Sans cap, aucun vent n’est favorable.',
    peut: 'Lire, chercher sur le web, écrire dans le dossier equipage.',
    pensees: {
      pause: ['Trois objectifs cette semaine, pas un de plus.', 'Combien ça coûte, vraiment ?', 'Il me faut une marge dans ce planning.', 'Ce trésor ne va pas se compter tout seul.'],
      travail: ['Je trace la route…', 'Je refais les comptes, avec de la marge.', 'Qu’est-ce qui passe en premier ?'],
      fini: ['La route est tracée, capitaine !', 'Les comptes sont bons.'],
      erreur: ['Ma carte est incomplète…'],
    },
  },
  robin: {
    nom: 'Robin',
    poste: 'Archéologue',
    lieu: 'La bibliothèque',
    devise: 'Là où les autres ont des impressions, j’ai des sources.',
    peut: 'Lire, chercher sur le web, écrire dans equipage, lancer ses scripts de recherche.',
    pensees: {
      pause: ['Ce livre dit peut-être le contraire du précédent.', 'Une source qu’on ne vérifie pas n’en est pas une.', 'Les vidéos qui cartonnent ont toujours un point commun.', 'Encore un chapitre.'],
      travail: ['Je déterre les faits…', 'Je croise les sources.', 'Celle-ci fait dix fois plus de vues que la moyenne…'],
      fini: ['J’ai trouvé ce qu’il fallait.', 'Tout est sourcé.'],
      erreur: ['Les archives sont muettes…'],
    },
  },
  franky: {
    nom: 'Franky',
    poste: 'Charpentier',
    lieu: 'L’atelier',
    devise: 'Solide, propre, et SUUUPER bien fini.',
    peut: 'Lire, chercher, écrire ses plans dans equipage/franky. Jamais de code depuis le QG.',
    pensees: {
      pause: ['Cette forge a besoin d’un coup de chaud.', 'Le plus petit premier morceau à construire…', 'On ne bâcle jamais une réparation.', 'Il me faudrait une meilleure clé de 12.'],
      travail: ['J’évalue ça, planche par planche…', 'Combien de temps, marge comprise ?', 'Le plan d’abord.'],
      fini: ['SUUUPER ! C’est prêt.', 'Le plan tient debout.'],
      erreur: ['Une pièce a cédé…'],
    },
  },
  brook: {
    nom: 'Brook',
    poste: 'Musicien',
    lieu: 'Le pont, avec sa batterie',
    devise: 'Une seconde pour accrocher, vingt pour convaincre.',
    peut: 'Lire, chercher, écrire dans equipage, lancer ffmpeg et l’analyse vidéo.',
    pensees: {
      pause: ['Une accroche qui claque dès la première seconde…', 'Tester UNE seule nouveauté à la fois.', 'Ce rythme ferait une super intro.', 'Les stats ne mentent pas.'],
      travail: ['Je compose l’accroche…', 'J’écris le déroulé, pas un texte récité.', 'Quelle question finale ?'],
      fini: ['Le script est prêt, capitaine !', 'Ça va captiver.'],
      erreur: ['Fausse note…'],
    },
  },
  zoro: {
    nom: 'Zoro',
    poste: 'Bretteur',
    lieu: 'Le pont arrière, avec sa longue-vue',
    devise: 'Je cherche où ça casse avant que quelqu’un d’autre le trouve.',
    peut: 'Lire et chercher, uniquement. Il ne modifie jamais rien.',
    pensees: {
      pause: ['Rien à l’horizon. Je dors.', 'Où est la faille ?', 'Une promesse intenable, c’est une faille.', 'Zzz…'],
      travail: ['Je tranche…', 'Quelle est l’hypothèse la plus fragile ?', 'Ce chiffre, il sort d’où ?'],
      fini: ['Verdict rendu.', 'J’ai trouvé les failles.'],
      erreur: ['Lame émoussée…'],
    },
  },
};

// --- À bord : coordonnées sur l'image du bateau HD (public/qg/bateau-hd.png) ---

// Sols (y sous les pieds) : le pont, les pièces du haut, les pièces du bas.
// Deux échelles relient les niveaux.
export const SOLS = [120, 234, 331];
export const ECHELLES = { haut: 317, bas: 357 }; // pont ↔ haut, haut ↔ bas

export type Action = 'regarde' | 'dort' | 'travaille';
export interface Habitude {
  x: number;
  y: number;
  quoi: string; // « compte le trésor »
  action: Action;
  poids?: number; // plus c'est grand, plus il y va souvent
}
export interface PosteQG {
  travail: { x: number; y: number }; // son poste de travail
  camera: { x: number; y: number }; // centre de sa pièce
  verbe: string; // bulle générique pendant une mission (« Robin étudie… »)
  habitudes: Habitude[];
}

export const POSTES: Record<IdQG, PosteQG> = {
  nami: {
    travail: { x: 232, y: 234 },
    camera: { x: 236, y: 186 },
    verbe: 'trace la route',
    habitudes: [
      { x: 282, y: 234, quoi: 'étudie les cartes', action: 'travaille', poids: 3 },
      { x: 158, y: 234, quoi: 'fait tourner le globe', action: 'regarde' },
      { x: 420, y: 331, quoi: 'compte le trésor', action: 'regarde', poids: 2 },
      { x: 172, y: 234, quoi: 'fait une petite sieste', action: 'dort' },
    ],
  },
  robin: {
    travail: { x: 428, y: 234 },
    camera: { x: 400, y: 186 },
    verbe: 'étudie',
    habitudes: [
      { x: 366, y: 234, quoi: 'parcourt les étagères', action: 'regarde', poids: 2 },
      { x: 392, y: 234, quoi: 'lit un vieux livre', action: 'travaille', poids: 3 },
      { x: 446, y: 234, quoi: 'prend des notes', action: 'travaille' },
      { x: 380, y: 234, quoi: 's’est endormie sur un livre', action: 'dort' },
    ],
  },
  franky: {
    travail: { x: 248, y: 331 },
    camera: { x: 240, y: 284 },
    verbe: 'bricole',
    habitudes: [
      { x: 304, y: 331, quoi: 'attise la forge', action: 'travaille', poids: 3 },
      { x: 272, y: 331, quoi: 'choisit un outil', action: 'regarde', poids: 2 },
      { x: 176, y: 331, quoi: 'range ses outils', action: 'travaille' },
      { x: 190, y: 331, quoi: 'fait une pause bien méritée', action: 'dort' },
    ],
  },
  brook: {
    travail: { x: 370, y: 120 },
    camera: { x: 372, y: 84 },
    verbe: 'compose',
    habitudes: [
      { x: 370, y: 120, quoi: 'joue de la batterie', action: 'travaille', poids: 3 },
      { x: 330, y: 120, quoi: 'improvise un air', action: 'travaille', poids: 2 },
      { x: 432, y: 120, quoi: 'regarde la mer', action: 'regarde' },
      { x: 300, y: 120, quoi: 'somnole au soleil', action: 'dort' },
    ],
  },
  zoro: {
    travail: { x: 86, y: 98 },
    camera: { x: 96, y: 66 },
    verbe: 'scrute les failles',
    habitudes: [
      { x: 64, y: 98, quoi: 'fait la sieste contre les tonneaux', action: 'dort', poids: 4 },
      { x: 120, y: 98, quoi: 'scrute l’horizon à la longue-vue', action: 'travaille', poids: 2 },
      { x: 100, y: 98, quoi: 's’entraîne', action: 'travaille' },
    ],
  },
  capitaine: {
    travail: { x: 560, y: 230 },
    camera: { x: 560, y: 190 },
    verbe: 'tient la barre',
    habitudes: [
      { x: 600, y: 230, quoi: 'regarde l’horizon', action: 'regarde', poids: 3 },
      { x: 528, y: 230, quoi: 'réfléchit au prochain cap', action: 'regarde', poids: 2 },
      { x: 444, y: 331, quoi: 'admire le trésor', action: 'regarde' },
    ],
  },
};

// Chemin à pied d'un point à un autre : on passe par les échelles pour
// changer de niveau.
const niveau = (y: number) => (y < 180 ? 0 : y < 290 ? 1 : 2);
export function chemin(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  const points: [number, number][] = [[a.x, a.y]];
  let n = niveau(a.y);
  let y = a.y;
  const cible = niveau(b.y);
  while (n !== cible) {
    const suivant = n + Math.sign(cible - n);
    const x = Math.min(n, suivant) === 0 ? ECHELLES.haut : ECHELLES.bas;
    const ySuivant = suivant === cible ? b.y : SOLS[suivant];
    points.push([x, y], [x, ySuivant]);
    n = suivant;
    y = ySuivant;
  }
  points.push([b.x, b.y]);
  return points;
}
