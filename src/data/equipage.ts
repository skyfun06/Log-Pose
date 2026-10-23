// L'équipage se recrute avec la régularité : chaque membre rejoint le navire
// après un certain nombre de « jours en mer » (jours où Louis a avancé : une
// habitude tenue, une étape cochée ou un gain). Le total ne retombe jamais,
// contrairement à la série : un jour raté ne fait perdre personne.

export type Role =
  | 'vigie'
  | 'cuisinier'
  | 'navigatrice'
  | 'charpentier'
  | 'medecin'
  | 'archeologue'
  | 'musicien'
  | 'timonier'
  | 'second';

export interface Membre {
  role: Role;
  titre: string;
  jours: number; // jours en mer pour le recruter
  apport: string; // ce qu'il apporte (pour le plaisir)
  citation: string;
}

export const EQUIPAGE: Membre[] = [
  {
    role: 'vigie',
    titre: 'La Vigie',
    jours: 1,
    apport: 'Prépare le rapport de chaque matin.',
    citation: 'Terre en vue, capitaine ! Enfin… bientôt.',
  },
  {
    role: 'cuisinier',
    titre: 'Le Cuisinier',
    jours: 3,
    apport: 'Un équipage bien nourri tient la distance.',
    citation: 'On ne conquiert rien le ventre vide.',
  },
  {
    role: 'navigatrice',
    titre: 'La Navigatrice',
    jours: 7,
    apport: 'Une semaine de cap tenu : elle trace la route.',
    citation: "Sans cap, aucun vent n'est favorable.",
  },
  {
    role: 'charpentier',
    titre: 'Le Charpentier',
    jours: 14,
    apport: 'Répare la coque quand une journée cède.',
    citation: 'Un navire se construit planche après planche.',
  },
  {
    role: 'medecin',
    titre: 'Le Médecin',
    jours: 21,
    apport: "Trois semaines : l'habitude est ancrée.",
    citation: 'Prends soin du capitaine, il tient la barre.',
  },
  {
    role: 'archeologue',
    titre: "L'Archéologue",
    jours: 30,
    apport: 'Un mois en mer : elle lit dans ton passé ce que tu as bâti.',
    citation: "Ce que tu fais chaque jour finit par écrire l'histoire.",
  },
  {
    role: 'musicien',
    titre: 'Le Musicien',
    jours: 45,
    apport: "Met de l'ambiance dans les longues traversées.",
    citation: 'Yohoho ! Même la tempête a son rythme.',
  },
  {
    role: 'timonier',
    titre: 'Le Timonier',
    jours: 60,
    apport: 'Deux mois : il tient la barre quand tu doutes.',
    citation: 'Le courant ne décide pas à ta place.',
  },
  {
    role: 'second',
    titre: 'Le Second',
    jours: 100,
    apport: "Cent jours en mer. Ton bras droit, l'équipage est complet.",
    citation: "Je te suivrais jusqu'au bout de Grand Line.",
  },
];

export function equipageRecrute(joursEnMer: number): Membre[] {
  return EQUIPAGE.filter((m) => joursEnMer >= m.jours);
}

export function prochaineRecrue(joursEnMer: number): Membre | null {
  return EQUIPAGE.find((m) => joursEnMer < m.jours) ?? null;
}
