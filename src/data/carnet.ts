// Carnet de bord : ce que Louis a fait chaque jour (habitudes tenues, étapes
// cochées, gains), d'où l'on tire les « jours en mer », la série en cours et
// la meilleure série. Tout est recalculé depuis les vraies données : rien à
// tenir à jour à côté.

import type { Etape, Gain, Habitude, Ile, MarquesHabitudes } from '../types';
import { decalerIso, isoDeDate } from './bilanJournee';

export interface EtapeDuJour {
  texte: string;
  difficulte: Etape['difficulte'];
  ile: string;
}

export interface JourDeBord {
  iso: string;
  habitudes: string[]; // noms des habitudes tenues
  etapes: EtapeDuJour[];
  gains: number; // euros
}

export interface Carnet {
  jours: Map<string, JourDeBord>;
  joursEnMer: number;
  serie: number; // jours d'affilée (aujourd'hui compris s'il compte déjà)
  aujourdhuiEnMer: boolean;
  meilleureSerie: number;
}

interface Sources {
  habitudes: Habitude[];
  marques: MarquesHabitudes;
  joursMalades: string[];
  etapes: Record<number, Etape[]>;
  iles: Ile[];
  gains: Gain[];
}

function jour(jours: Map<string, JourDeBord>, iso: string): JourDeBord {
  let j = jours.get(iso);
  if (!j) {
    j = { iso, habitudes: [], etapes: [], gains: 0 };
    jours.set(iso, j);
  }
  return j;
}

export function carnetDeBord({
  habitudes,
  marques,
  joursMalades,
  etapes,
  iles,
  gains,
}: Sources): Carnet {
  const jours = new Map<string, JourDeBord>();

  for (const h of habitudes) {
    for (const [iso, etat] of Object.entries(marques[h.id] ?? {})) {
      if (etat === 'fait') jour(jours, iso).habitudes.push(h.nom);
    }
  }
  for (const ile of iles) {
    for (const e of etapes[ile.id] ?? []) {
      if (e.faiteLe) {
        jour(jours, isoDeDate(new Date(e.faiteLe))).etapes.push({
          texte: e.texte,
          difficulte: e.difficulte,
          ile: ile.titre,
        });
      }
    }
  }
  for (const g of gains) jour(jours, isoDeDate(new Date(g.date))).gains += g.montant;

  // Série : jours en mer d'affilée. Un jour « malade » ne la casse pas, et
  // aujourd'hui ne la casse pas tant qu'il n'est pas fini.
  const malades = new Set(joursMalades);
  const aujourdhui = isoDeDate(new Date());
  const aujourdhuiEnMer = jours.has(aujourdhui);
  let serie = 0;
  let curseur = aujourdhuiEnMer ? aujourdhui : decalerIso(aujourdhui, -1);
  for (let garde = 0; garde < 1000; garde++) {
    if (jours.has(curseur)) serie++;
    else if (!malades.has(curseur)) break;
    curseur = decalerIso(curseur, -1);
  }

  // Meilleure série, sur tout l'historique.
  const dates = [...jours.keys()].sort();
  let meilleureSerie = 0;
  if (dates.length) {
    let courante = 0;
    for (let d = dates[0]; d <= aujourdhui; d = decalerIso(d, 1)) {
      if (jours.has(d)) courante++;
      else if (!malades.has(d)) courante = 0;
      meilleureSerie = Math.max(meilleureSerie, courante);
    }
  }

  return { jours, joursEnMer: jours.size, serie, aujourdhuiEnMer, meilleureSerie };
}
