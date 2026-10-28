// Catégories de base du second cerveau. Louis peut en créer d'autres depuis le
// formulaire (state/useCategoriesCerveau.ts) ; le serveur accepte n'importe quel nom.

export interface CategorieCerveau {
  nom: string;
  // Tracé de l'icône (viewBox 24×24, au trait).
  icone: string;
  // Le montant a du sens pour cette catégorie : le champ est proposé.
  avecMontant?: boolean;
  // Exemple de note affiché dans le formulaire.
  exempleNote: string;
  // Créée par Louis (supprimable).
  perso?: boolean;
}

export const CATEGORIES_CERVEAU: CategorieCerveau[] = [
  {
    nom: 'Facture',
    icone: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    avecMontant: true,
    exempleNote: "électricité de l'appart, à payer avant le 30",
  },
  {
    nom: 'Fiche de paie',
    icone: 'M4 7h16v11H4zM4 11h16M8 15h3M16 4.5 12 7 8 4.5',
    avecMontant: true,
    exempleNote: 'heures sup comprises, prime de fin d’année',
  },
  {
    nom: 'Banque',
    icone: 'M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17',
    avecMontant: true,
    exempleNote: 'relevé du compte courant, RIB',
  },
  {
    nom: 'Administratif',
    icone: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 15.5h6',
    exempleNote: "attestation CAF, avis d'impôt",
  },
  {
    nom: 'Contrat',
    icone: 'M6 3h9l3 3v15H6zM9 9h6M9 12.5h4M9 17c1.5-1.8 2.5-1.8 3 0s1.5 1.8 3-.5',
    exempleNote: 'bail, contrat de travail, assurance',
  },
  {
    nom: 'Santé',
    icone: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
    exempleNote: 'ordonnance, remboursement mutuelle',
  },
  {
    nom: 'Inspiration',
    icone: 'M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z',
    exempleNote: 'couleurs chaudes, typo à garder pour le site',
  },
  {
    nom: 'ScanAvis',
    icone: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h2M20 14v2',
    exempleNote: 'maquette de la carte fidélité, retour client',
  },
  {
    nom: 'WhatItCost',
    icone: 'M4 10h16v10H4zM4 10l1.5-5.5 15 3.5-.5 2M8.5 5.3l-.8 4.5M13 6.3l-.8 3.7M17.5 7.3l-.6 2.7',
    exempleNote: 'affiche de film, idée de mode de jeu',
  },
  {
    nom: 'Autre',
    icone: 'M4 8 12 4l8 4v8.5L12 20.5 4 16.5zM4 8l8 4 8-4M12 12v8.5',
    exempleNote: 'ce qui t’aidera à le retrouver',
  },
];

export function categorie(nom: string, liste: CategorieCerveau[] = CATEGORIES_CERVEAU): CategorieCerveau {
  return liste.find((c) => c.nom === nom) ?? CATEGORIES_CERVEAU[CATEGORIES_CERVEAU.length - 1];
}

// Devine la catégorie d'après le nom du fichier (simple point de départ :
// on la change d'un clic dans le formulaire).
export function devinerCategorie(fichier: File): string {
  const nom = fichier.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (/scan.?avis|qr.?optimi/.test(nom)) return 'ScanAvis';
  if (/what.?it.?cost/.test(nom)) return 'WhatItCost';
  if (/paie|salaire|bulletin|payslip/.test(nom)) return 'Fiche de paie';
  if (/factur|invoice|edf|engie|quittance|ticket|recu/.test(nom)) return 'Facture';
  if (/releve|rib|banque|bank/.test(nom)) return 'Banque';
  if (/contrat|bail|assurance/.test(nom)) return 'Contrat';
  if (/ordonnance|mutuelle|ameli|sante|medic/.test(nom)) return 'Santé';
  if (/impot|caf|attestation|cerfa|identite|passeport|permis|urssaf/.test(nom)) return 'Administratif';
  if (fichier.type.startsWith('image/')) return 'Inspiration';
  return 'Autre';
}

// « facture_EDF-sept.pdf » → « facture EDF sept »
export function nomDepuisFichier(fichier: File): string {
  return fichier.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
