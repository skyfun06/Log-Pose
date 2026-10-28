// Liens automatiques entre les fichiers du second cerveau (graphe).
//
// Deux fichiers sont liés quand ils partagent des mots *qui les distinguent*
// des autres, pas juste des mots qui traînent partout :
// - on ignore les nombres et les dates (« 2026 », « septembre »...), les mots
//   vides et les mots génériques (« document », « page »...) ;
// - chaque mot pèse selon sa rareté (TF-IDF) : un mot présent dans la moitié
//   de la cale, ou dans 3 catégories différentes ou plus, ne relie plus rien ;
// - une expression entière partagée (« carte de visite ») compte en plus ;
// - la ressemblance (cosinus) doit dépasser un seuil, plus haut entre deux
//   catégories différentes : il faut alors davantage de preuves.

import type { FicheCerveau } from '../types';

const MOTS_VIDES = new Set(
  (
    // Mots vides du français.
    'les des une uns aux avec dans sur par pour sans sous chez entre vers ' +
    'est sont ete etre avoir son ses leur leurs notre nos votre vos mon mes ton tes ' +
    'qui que quoi dont ou mais donc car plus moins tres tout tous toute toutes ' +
    'ce cet cette ces du de la le un et en au il elle ils elles on nous vous ne se sa ma ta si ' +
    // Mots qui décrivent n'importe quel fichier.
    'fichier fichiers document documents fiche fiches projet projets style page pages ' +
    'image photo pdf scan copie version recto verso numero total montant date mois ' +
    'annee jour euro euros contact info infos information informations divers autre ' +
    // Mois.
    'janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre'
  ).split(' '),
);

// Liens gardés par fichier, et seuils de ressemblance (0 à 1).
const VOISINS_MAX = 3;
const SEUIL_MEME_CATEGORIE = 0.2;
const SEUIL_AUTRE_CATEGORIE = 0.35;
// Au-delà, un mot est trop répandu pour relier deux fichiers.
const PART_MAX = 0.5;
const CATEGORIES_MAX = 3;
// Poids des sources de mots.
const POIDS_MOT_CLE = 1;
const POIDS_NOM = 1;
const POIDS_NOTE = 0.7;
const POIDS_EXPRESSION = 1.5;
const POIDS_UNIQUE = 0.5; // terme présent dans un seul fichier

function normaliser(texte: string) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Racine grossière : « assurances » et « assurance » se rejoignent.
function racine(mot: string) {
  return mot.length > 4 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

function motsUtiles(texte: string): string[] {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 2 && !/\d/.test(m) && !MOTS_VIDES.has(m))
    .map(racine);
}

// Termes d'un fichier → poids. Une expression de plusieurs mots utiles lue par
// la vigie (« carte de visite ») devient aussi un terme à elle seule.
function termesDe(fiche: FicheCerveau): Map<string, number> {
  const termes = new Map<string, number>();
  const ajouter = (terme: string, poids: number) =>
    termes.set(terme, Math.max(termes.get(terme) ?? 0, poids));

  if (fiche.analyse.etat === 'faite') {
    for (const motCle of fiche.analyse.motsCles) {
      const mots = motsUtiles(motCle);
      mots.forEach((m) => ajouter(m, POIDS_MOT_CLE));
      if (mots.length >= 2) ajouter(`« ${mots.join(' ')} »`, POIDS_EXPRESSION);
    }
  }
  motsUtiles(fiche.nom).forEach((m) => ajouter(m, POIDS_NOM));
  motsUtiles(fiche.note).forEach((m) => ajouter(m, POIDS_NOTE));
  return termes;
}

export interface LienFichiers {
  a: number; // index dans la liste des fichiers
  b: number;
  score: number; // ressemblance, 0 à 1
  communs: string[]; // les termes qui ont fait le lien, du plus fort au plus faible
}

export function lierFichiers(fichiers: FicheCerveau[]): LienFichiers[] {
  const n = fichiers.length;
  const termes = fichiers.map(termesDe);

  // Dans combien de fichiers, et de catégories, chaque terme apparaît.
  const frequence = new Map<string, number>();
  const categoriesDuTerme = new Map<string, Set<string>>();
  termes.forEach((t, i) => {
    for (const terme of t.keys()) {
      frequence.set(terme, (frequence.get(terme) ?? 0) + 1);
      if (!categoriesDuTerme.has(terme)) categoriesDuTerme.set(terme, new Set());
      categoriesDuTerme.get(terme)!.add(fichiers[i].categorie);
    }
  });

  const rarete = (terme: string) => {
    const df = frequence.get(terme) ?? 0;
    if (df < 2) return 0;
    // Sur une petite cale, la part n'a pas de sens (2 fichiers sur 3...).
    if (n >= 6 && df / n > PART_MAX) return 0;
    if ((categoriesDuTerme.get(terme)?.size ?? 0) >= CATEGORIES_MAX) return 0;
    return Math.log(1 + n / df);
  };

  // Vecteurs TF-IDF, et leur norme. Les termes propres au fichier comptent un
  // peu dans la norme (un fichier qui parle surtout d'autre chose ressemble
  // moins), sans écraser ce qu'il partage.
  const vecteurs = termes.map((t) => {
    const v = new Map<string, number>();
    let norme = 0;
    for (const [terme, poids] of t) {
      const idf = (frequence.get(terme) ?? 0) < 2 ? POIDS_UNIQUE : rarete(terme);
      const valeur = poids * idf;
      norme += valeur * valeur;
      if (valeur > 0 && (frequence.get(terme) ?? 0) >= 2) v.set(terme, valeur);
    }
    return { v, norme: Math.sqrt(norme) };
  });

  const candidats: LienFichiers[][] = fichiers.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const vi = vecteurs[i];
      const vj = vecteurs[j];
      if (!vi.norme || !vj.norme) continue;
      const parts: [string, number][] = [];
      let produit = 0;
      for (const [terme, valeur] of vi.v) {
        const autre = vj.v.get(terme);
        if (!autre) continue;
        produit += valeur * autre;
        parts.push([terme, valeur * autre]);
      }
      // Au moins deux preuves : un seul mot commun, c'est souvent un hasard.
      if (parts.length < 2) continue;
      const score = produit / (vi.norme * vj.norme);
      const seuil =
        fichiers[i].categorie === fichiers[j].categorie ? SEUIL_MEME_CATEGORIE : SEUIL_AUTRE_CATEGORIE;
      if (score < seuil) continue;
      const lien = {
        a: i,
        b: j,
        score,
        communs: parts.sort((p, q) => q[1] - p[1]).map(([terme]) => terme),
      };
      candidats[i].push(lien);
      candidats[j].push(lien);
    }
  }

  // Chaque fichier garde ses meilleurs voisins.
  const gardes = new Set<LienFichiers>();
  for (const liste of candidats) {
    liste
      .sort((p, q) => q.score - p.score)
      .slice(0, VOISINS_MAX)
      .forEach((l) => gardes.add(l));
  }
  return [...gardes];
}
