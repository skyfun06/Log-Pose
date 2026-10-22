// Bilan d'une journée et suivi de la semaine, calculés à partir des marques
// réelles des habitudes (et non d'un instantané) : le récap reste juste même
// quand on coche après qu'il a été préparé. Les jours « malade » ne comptent
// pas, comme partout dans l'appli (sauf habitudes qui comptent même malade).

import type { Habitude, MarquesHabitudes } from '../types';

export function isoDeDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateDeIso(iso: string): Date {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function decalerIso(iso: string, jours: number): string {
  const d = dateDeIso(iso);
  d.setDate(d.getDate() + jours);
  return isoDeDate(d);
}

// Une habitude est-elle attendue ce jour-là ? (jour malade → non, sauf si
// elle compte même malade)
function active(h: Habitude, iso: string, malades: Set<string>): boolean {
  return h.compteMemeMalade === true || !malades.has(iso);
}

// Jours d'affilée où l'habitude est tenue, en remontant depuis `iso` inclus.
// Les jours malades sont sautés sans casser la série.
export function serie(h: Habitude, marques: MarquesHabitudes, malades: Set<string>, iso: string): number {
  const parDate = marques[h.id] ?? {};
  let n = 0;
  let jour = iso;
  for (let garde = 0; garde < 400; garde++) {
    if (!active(h, jour, malades)) {
      jour = decalerIso(jour, -1);
      continue;
    }
    if (parDate[jour] !== 'fait') break;
    n++;
    jour = decalerIso(jour, -1);
  }
  return n;
}

export interface Reussite {
  nom: string;
  serie: number; // jours d'affilée (quotidiennes), 0 pour une hebdomadaire
  hebdo: boolean;
}

export interface BilanJour {
  iso: string;
  malade: boolean;
  reussites: Reussite[];
  ratees: string[]; // marquées « ratée »
  oubliees: string[]; // quotidiennes jamais cochées
  faites: number; // quotidiennes tenues
  attendues: number; // quotidiennes attendues ce jour-là
}

export function bilanDuJour(
  habitudes: Habitude[],
  marques: MarquesHabitudes,
  joursMalades: string[],
  iso: string,
): BilanJour {
  const malades = new Set(joursMalades);
  const bilan: BilanJour = {
    iso,
    malade: malades.has(iso),
    reussites: [],
    ratees: [],
    oubliees: [],
    faites: 0,
    attendues: 0,
  };
  for (const h of habitudes) {
    if (!active(h, iso, malades)) continue;
    const etat = marques[h.id]?.[iso];
    const quotidienne = h.cadence === 'quotidienne';
    if (quotidienne) bilan.attendues++;
    if (etat === 'fait') {
      if (quotidienne) bilan.faites++;
      bilan.reussites.push({ nom: h.nom, serie: quotidienne ? serie(h, marques, malades, iso) : 0, hebdo: !quotidienne });
    } else if (etat === 'rate') {
      bilan.ratees.push(h.nom);
    } else if (quotidienne) {
      bilan.oubliees.push(h.nom);
    }
  }
  // Les plus belles séries d'abord.
  bilan.reussites.sort((a, b) => b.serie - a.serie);
  return bilan;
}

export type StatutHebdo = 'atteint' | 'en-route' | 'serre' | 'hors-portee';

export interface SuiviHebdo {
  nom: string;
  faits: number;
  objectif: number;
  joursRestants: number; // jours encore jouables cette semaine
  statut: StatutHebdo;
}

// Objectifs hebdomadaires à la date `iso`. `jourCompris` : le jour même est
// encore jouable (récap du matin) ou déjà passé (récap du soir).
export function suiviSemaine(
  habitudes: Habitude[],
  marques: MarquesHabitudes,
  joursMalades: string[],
  iso: string,
  jourCompris: boolean,
): SuiviHebdo[] {
  const malades = new Set(joursMalades);
  const date = dateDeIso(iso);
  const rang = (date.getDay() + 6) % 7; // 0 = lundi
  const lundi = decalerIso(iso, -rang);
  const dimanche = decalerIso(iso, 6 - rang);
  const maladesSemaine = joursMalades.filter((d) => d >= lundi && d <= dimanche).length;

  return habitudes
    .filter((h) => h.cadence === 'hebdomadaire')
    .map((h) => {
      const parDate = marques[h.id] ?? {};
      const ignoreMalade = h.compteMemeMalade === true;
      let faits = 0;
      for (const [d, e] of Object.entries(parDate)) {
        if (e === 'fait' && d >= lundi && d <= dimanche && (ignoreMalade || !malades.has(d))) faits++;
      }
      // Les jours malades de la semaine réduisent l'objectif d'autant.
      const objectif = ignoreMalade ? h.objectifHebdo : Math.max(0, Math.min(h.objectifHebdo, 7 - maladesSemaine));
      let joursRestants = 0;
      for (let k = jourCompris ? 0 : 1; rang + k <= 6; k++) {
        const jour = decalerIso(iso, k);
        if (ignoreMalade || !malades.has(jour)) joursRestants++;
      }
      const reste = objectif - faits;
      const statut: StatutHebdo =
        reste <= 0 ? 'atteint' : reste > joursRestants ? 'hors-portee' : reste === joursRestants ? 'serre' : 'en-route';
      return { nom: h.nom, faits, objectif, joursRestants, statut };
    })
    .sort((a, b) => ordreStatut[a.statut] - ordreStatut[b.statut]);
}

// Les objectifs qui demandent de l'attention d'abord.
const ordreStatut: Record<StatutHebdo, number> = { serre: 0, 'hors-portee': 1, 'en-route': 2, atteint: 3 };
