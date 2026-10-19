// Mise en forme des infos du second cerveau.

import type { FicheCerveau } from '../types';

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
