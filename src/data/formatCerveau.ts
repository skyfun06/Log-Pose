// Mise en forme des infos du second cerveau.

import type { FicheCerveau, SourceSalaire } from '../types';

// « 2026-09-15 » → « 15 sept. 2026 »
export function dateLisible(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function montantLisible(montant: number | null | undefined): string {
  return montant === null || montant === undefined
    ? ''
    : montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

// Date et montant de la fiche : ceux saisis, sinon ceux repérés par la lecture.
export function dateFiche(fiche: FicheCerveau): string | null {
  return fiche.date ?? (fiche.analyse.etat === 'faite' ? fiche.analyse.date : null);
}

export function montantFiche(fiche: FicheCerveau): number | null {
  return fiche.montant ?? (fiche.analyse.etat === 'faite' ? fiche.analyse.montant : null);
}

// Étiquette courte du format : « PDF », « PNG »...
export function formatFichier(fiche: FicheCerveau): string {
  return fiche.fichier.extension.replace('.', '').toUpperCase().slice(0, 4) || 'FICHIER';
}

// Recherche instantanée dans la cale (sans IA) : tous les mots doivent
// apparaître quelque part dans la fiche.
function normaliser(texte: string) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function correspondAuFiltre(fiche: FicheCerveau, filtre: string): boolean {
  const mots = normaliser(filtre).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const analyse = fiche.analyse.etat === 'faite' ? fiche.analyse : null;
  const texte = normaliser(
    [
      fiche.nom,
      fiche.categorie,
      fiche.note,
      fiche.fichier.nomOrigine,
      dateLisible(dateFiche(fiche)),
      analyse?.resume ?? '',
      analyse?.motsCles.join(' ') ?? '',
    ].join(' '),
  );
  return mots.every((m) => texte.includes(m));
}

// --- Fiches de paie → budget ------------------------------------------------

export const CATEGORIE_PAIE = 'Fiche de paie';

// Les fiches de paie regroupées par mois : un mois peut en compter
// plusieurs (heures sup payées à part, deux employeurs...), le salaire du
// mois est leur somme.
export interface MoisDePaie {
  cle: string; // « AAAA-MM »
  libelle: string; // « Septembre 2026 »
  fiches: FicheCerveau[]; // celles dont le montant est connu
  incompletes: FicheCerveau[]; // celles dont le montant reste inconnu
  total: number;
}

// Mois d'une fiche : celui de sa date (saisie ou lue), sinon de son rangement.
function moisDeLaFiche(fiche: FicheCerveau): string {
  return (dateFiche(fiche) ?? fiche.ajouteLe).slice(0, 7);
}

function libelleMois(cle: string): string {
  const texte = new Date(`${cle}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Mois ayant au moins une fiche de paie chiffrée, du plus récent au plus ancien.
export function moisDePaie(fichiers: FicheCerveau[]): MoisDePaie[] {
  const parMois = new Map<string, MoisDePaie>();
  for (const fiche of fichiers) {
    if (fiche.categorie !== CATEGORIE_PAIE) continue;
    const cle = moisDeLaFiche(fiche);
    let mois = parMois.get(cle);
    if (!mois) {
      mois = { cle, libelle: libelleMois(cle), fiches: [], incompletes: [], total: 0 };
      parMois.set(cle, mois);
    }
    const montant = montantFiche(fiche);
    if (montant === null) {
      mois.incompletes.push(fiche);
    } else {
      mois.fiches.push(fiche);
      mois.total = Math.round((mois.total + montant) * 100) / 100;
    }
  }
  const parNom = (a: FicheCerveau, b: FicheCerveau) =>
    a.nom.localeCompare(b.nom, 'fr', { numeric: true });
  for (const mois of parMois.values()) mois.fiches.sort(parNom); // « 1/2 » avant « 2/2 »
  return [...parMois.values()]
    .filter((m) => m.fiches.length > 0)
    .sort((a, b) => b.cle.localeCompare(a.cle));
}

// Le mois que suit le budget : celui choisi, sinon (ou s'il n'a plus de
// fiche) le plus récent.
export function moisDuSalaire(mois: MoisDePaie[], source: SourceSalaire): MoisDePaie | null {
  if (source.mode !== 'fiche') return null;
  return (source.mois ? mois.find((m) => m.cle === source.mois) : undefined) ?? mois[0] ?? null;
}
