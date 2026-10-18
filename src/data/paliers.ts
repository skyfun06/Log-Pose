// Paliers de prime : l'objectif « Roi des pirates » découpé en étapes.
// Le seuil est en euros réellement gagnés ; la prime affichée vaut 1 000 ฿
// par euro (comme sur l'affiche WANTED). Pour changer un palier : cette liste.

export interface Palier {
  seuil: number; // euros gagnés pour l'atteindre
  titre: string;
}

export const BERRYS_PAR_EURO = 1000;

export const PALIERS: Palier[] = [
  { seuil: 0, titre: 'Moussaillon' },
  { seuil: 100, titre: 'Pirate en herbe' },
  { seuil: 1_000, titre: "Capitaine de l'East Blue" },
  { seuil: 5_000, titre: 'Pirate redouté' },
  { seuil: 30_000, titre: 'Chapeau de paille' },
  { seuil: 100_000, titre: 'Supernova' },
  { seuil: 500_000, titre: 'Pire Génération' },
  { seuil: 1_000_000, titre: 'Empereur en devenir' },
  { seuil: 3_000_000, titre: 'Empereur des mers' },
  { seuil: 5_000_000, titre: 'Roi des pirates' },
];

export interface PositionPalier {
  index: number; // palier atteint
  actuel: Palier;
  suivant: Palier | null; // null = dernier palier atteint
  avancement: number; // 0..1 entre le palier atteint et le suivant
  reste: number; // euros manquants pour le suivant
}

export function positionPalier(prime: number): PositionPalier {
  let index = 0;
  PALIERS.forEach((p, i) => {
    if (prime >= p.seuil) index = i;
  });
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
