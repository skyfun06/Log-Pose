// Catégories du second cerveau créées par Louis, en plus de celles de
// data/categoriesCerveau.ts. Gardées dans le localStorage et synchronisées
// entre appareils (voir synchro.ts).

import { useSyncExternalStore } from 'react';
import { CATEGORIES_CERVEAU, type CategorieCerveau } from '../data/categoriesCerveau';
import { enregistrer } from './synchro';

const CLE = 'log-pose-cerveau-categories';
export const LONGUEUR_MAX_CATEGORIE = 40; // limite du serveur (server/cerveau.js)

export interface CategoriePerso {
  nom: string;
  icone: string;
}

let perso: CategoriePerso[] | null = null;
const abonnes = new Set<() => void>();

// Lu au premier rendu (après la synchro de démarrage, pas à l'import).
function charger(): CategoriePerso[] {
  if (perso) return perso;
  let lu: unknown = [];
  try {
    lu = JSON.parse(localStorage.getItem(CLE) ?? '[]');
  } catch {
    /* illisible : on repart de zéro */
  }
  perso = Array.isArray(lu)
    ? lu.filter(
        (c): c is CategoriePerso =>
          typeof c === 'object' && c !== null && typeof c.nom === 'string' && typeof c.icone === 'string',
      )
    : [];
  // Première écriture « de montage » : non datée par la synchro.
  enregistrer(CLE, JSON.stringify(perso));
  return perso;
}

function changer(liste: CategoriePerso[]) {
  perso = liste;
  enregistrer(CLE, JSON.stringify(liste));
  abonnes.forEach((f) => f());
}

function sAbonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

// Toutes les catégories : celles de base, les perso, et « Autre » en dernier.
let cache: { source: CategoriePerso[]; liste: CategorieCerveau[] } | null = null;
function toutes(): CategorieCerveau[] {
  const source = charger();
  if (cache?.source !== source) {
    const autre = CATEGORIES_CERVEAU[CATEGORIES_CERVEAU.length - 1];
    cache = {
      source,
      liste: [
        ...CATEGORIES_CERVEAU.slice(0, -1),
        ...source.map((c) => ({ ...c, perso: true, exempleNote: 'ce qui t’aidera à le retrouver' })),
        autre,
      ],
    };
  }
  return cache.liste;
}

const normaliser = (nom: string) =>
  nom.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Renvoie un message d'erreur, ou null si la catégorie est créée.
export function creerCategorie(nom: string, icone: string): string | null {
  const propre = nom.trim().replace(/\s+/g, ' ');
  if (!propre) return 'Donne un nom à la catégorie.';
  if (propre.length > LONGUEUR_MAX_CATEGORIE) return `${LONGUEUR_MAX_CATEGORIE} caractères maximum.`;
  if (toutes().some((c) => normaliser(c.nom) === normaliser(propre))) return 'Cette catégorie existe déjà.';
  changer([...charger(), { nom: propre, icone }]);
  return null;
}

// Les fichiers déjà rangés dedans gardent leur catégorie (avec l'icône « Autre »).
export function supprimerCategorie(nom: string) {
  changer(charger().filter((c) => c.nom !== nom));
}

export function useCategoriesCerveau(): CategorieCerveau[] {
  return useSyncExternalStore(sAbonner, toutes);
}

// Icônes proposées pour une nouvelle catégorie (viewBox 24×24, au trait).
export const ICONES_PERSO: string[] = [
  'M3 7h7l2 2h9v10H3z', // dossier
  'M12 3.5 14.6 9l5.9.6-4.4 4 1.3 5.9L12 16.6l-5.4 2.9 1.3-5.9-4.4-4L9.4 9z', // étoile
  'M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10C19.5 15.4 12 20 12 20z', // cœur
  'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5', // maison
  'M4 16V12l2-5h12l2 5v4zM4 16v2.5M20 16v2.5M7.5 13h1M15.5 13h1', // voiture
  'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z', // livre
  'M3.5 12.5 11 5h8v8l-7.5 7.5zM15.5 8.5h.01', // étiquette
  'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-2.5z', // outil
  'M4 20h16M6 20V10M10 20V6M14 20v-8M18 20V4', // graphique
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9', // monde
];
