// Paliers de prime : l'objectif « Roi des pirates » découpé en étapes.
// Le seuil est en euros réellement gagnés ; la prime affichée vaut 1 000 ฿
// par euro (comme sur l'affiche WANTED). Pour changer un palier : cette liste.
//
// Chaque palier fait progresser trois pistes à la fois :
//  - le personnage : un rang, une épithète imprimée sur l'affiche ;
//  - le navire : de la barque au vaisseau-amiral (voir components/Navire) ;
//  - l'ère : change le thème de tout le site, le sceau et l'aura de l'affiche
//    (couleurs dans index.css, sous :root[data-ere="…"]).

export type Ere = 'east-blue' | 'grand-line' | 'nouveau-monde' | 'empereur' | 'roi';

export interface InfosEre {
  nom: string;
  sceau: string; // cachet de cire posé sur l'affiche
  aura: string | null; // halo autour de l'affiche (null = aucun)
}

export const ERES: Record<Ere, InfosEre> = {
  'east-blue': { nom: 'East Blue', sceau: 'Cachet de cire rouge', aura: null },
  'grand-line': {
    nom: 'Grand Line',
    sceau: 'Cachet de cire bleue',
    aura: "Liseré d'or sur l'affiche",
  },
  'nouveau-monde': { nom: 'Nouveau Monde', sceau: 'Cachet de cire noire', aura: 'Aura de Haki' },
  empereur: { nom: 'Empereur', sceau: 'Cachet de cire pourpre', aura: 'Haki des rois (éclairs)' },
  roi: { nom: 'Roi des pirates', sceau: "Cachet d'or", aura: 'Rayons du trésor' },
};

export const NAVIRES = ['Barque de pêche', 'Caravelle', 'Brick', 'Galion', 'Vaisseau-amiral'];

export interface Palier {
  seuil: number; // euros gagnés pour l'atteindre
  titre: string;
  epithete: string | null; // surnom imprimé sur l'affiche
  ere: Ere;
  navire: number; // index dans NAVIRES
  une: string; // gros titre du journal le jour où on l'atteint
}

export const BERRYS_PAR_EURO = 1000;

export const PALIERS: Palier[] = [
  {
    seuil: 0,
    titre: 'Moussaillon',
    epithete: null,
    ere: 'east-blue',
    navire: 0,
    une: 'Un inconnu prend la mer',
  },
  {
    seuil: 100,
    titre: 'Pirate en herbe',
    epithete: 'le Débrouillard',
    ere: 'east-blue',
    navire: 1,
    une: 'Première prime pour un jeune pirate',
  },
  {
    seuil: 1_000,
    titre: "Capitaine de l'East Blue",
    epithete: 'Cœur de laiton',
    ere: 'east-blue',
    navire: 1,
    une: "L'East Blue a un nouveau capitaine",
  },
  {
    seuil: 5_000,
    titre: 'Pirate redouté',
    epithete: "l'Insaisissable",
    ere: 'grand-line',
    navire: 2,
    une: 'Il franchit Reverse Mountain',
  },
  {
    seuil: 30_000,
    titre: 'Chapeau de paille',
    epithete: 'le Tenace',
    ere: 'grand-line',
    navire: 2,
    une: 'La Marine double sa prime',
  },
  {
    seuil: 100_000,
    titre: 'Supernova',
    epithete: 'la Tempête',
    ere: 'nouveau-monde',
    navire: 3,
    une: 'Une Supernova entre dans le Nouveau Monde',
  },
  {
    seuil: 500_000,
    titre: 'Pire Génération',
    epithete: "Poing d'or",
    ere: 'nouveau-monde',
    navire: 3,
    une: "Le Gouvernement mondial s'inquiète",
  },
  {
    seuil: 1_000_000,
    titre: 'Empereur en devenir',
    epithete: 'le Conquérant',
    ere: 'nouveau-monde',
    navire: 3,
    une: 'Le premier million : les Empereurs le surveillent',
  },
  {
    seuil: 3_000_000,
    titre: 'Empereur des mers',
    epithete: "l'Empereur",
    ere: 'empereur',
    navire: 4,
    une: 'Un nouvel Empereur règne sur les mers',
  },
  {
    seuil: 5_000_000,
    titre: 'Roi des pirates',
    epithete: 'le Roi',
    ere: 'roi',
    navire: 4,
    une: 'Le One Piece a trouvé son maître',
  },
];

export interface PositionPalier {
  index: number; // palier atteint
  actuel: Palier;
  suivant: Palier | null; // null = dernier palier atteint
  avancement: number; // 0..1 entre le palier atteint et le suivant
  reste: number; // euros manquants pour le suivant
}

export function indexPalier(prime: number): number {
  let index = 0;
  PALIERS.forEach((p, i) => {
    if (prime >= p.seuil) index = i;
  });
  return index;
}

export function positionPalier(prime: number): PositionPalier {
  const index = indexPalier(prime);
  const actuel = PALIERS[index];
  const suivant = PALIERS[index + 1] ?? null;
  if (!suivant) return { index, actuel, suivant, avancement: 1, reste: 0 };
  return {
    index,
    actuel,
    suivant,
    avancement: (prime - actuel.seuil) / (suivant.seuil - actuel.seuil),
    reste: suivant.seuil - prime,
  };
}

export type GenreDeblocage = 'rang' | 'epithete' | 'navire' | 'ere' | 'sceau' | 'aura';

export interface Deblocage {
  genre: GenreDeblocage;
  texte: string;
}

// Ce que le palier i apporte de neuf par rapport au précédent (calculé, pour
// que la liste reste juste quand on modifie PALIERS).
export function deblocages(i: number): Deblocage[] {
  const p = PALIERS[i];
  const avant = PALIERS[i - 1];
  const liste: Deblocage[] = [{ genre: 'rang', texte: `Rang « ${p.titre} »` }];
  if (p.epithete && p.epithete !== avant?.epithete) {
    liste.push({ genre: 'epithete', texte: `Épithète « ${p.epithete} » sur l'affiche` });
  }
  if (!avant || p.navire !== avant.navire) {
    liste.push({ genre: 'navire', texte: `Navire : ${NAVIRES[p.navire]}` });
  }
  if (!avant || p.ere !== avant.ere) {
    const ere = ERES[p.ere];
    if (avant) liste.push({ genre: 'ere', texte: `Nouvelle ère : ${ere.nom} (thème du site)` });
    if (i > 0) liste.push({ genre: 'sceau', texte: ere.sceau });
    if (ere.aura) liste.push({ genre: 'aura', texte: ere.aura });
  } else if (i === 1) {
    // Premier palier : l'affiche reçoit son premier cachet.
    liste.push({ genre: 'sceau', texte: ERES[p.ere].sceau });
  }
  return liste;
}
