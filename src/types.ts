export interface Ile {
  id: number;
  numero: number;
  arc: string;
  titre: string;
  situation: string;
  quete: string;
  backgroundImage: string;
  couleurFallback: string;
}

export type StatutMission = 'pending' | 'done' | 'failed';

export interface Mission {
  id: string;
  texte: string;
  questWeight: number;
  statut: StatutMission;
}

export type JourSemaine = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';

export interface BlocPlanning {
  id: string;
  titre: string;
  heureDebut: string;
  heureFin: string;
  jours: JourSemaine[];
  questWeight: number;
  // Créneau verrouillé (ex : horaires de travail) : ni modifiable ni supprimable.
  fixe?: boolean;
}

// --- Habitudes -------------------------------------------------------------

// Une habitude est soit quotidienne (visée chaque jour, prioritaire dans la
// grille), soit hebdomadaire (visée un certain nombre de fois par semaine).
export type CadenceHabitude = 'quotidienne' | 'hebdomadaire';

// État d'un jour pour une habitude. L'absence de marque = « prévu » (neutre) :
// on ne stocke que les jours explicitement faits ou ratés.
export type EtatHabitude = 'fait' | 'rate';

export interface Habitude {
  id: string;
  nom: string;
  cadence: CadenceHabitude;
  // Pour une habitude hebdomadaire : nombre de fois visées par semaine (1..7).
  // Ignoré (traité comme 7) pour une habitude quotidienne.
  objectifHebdo: number;
  icone?: string;
  // Vraie = l'habitude reste active les jours « malade » (ex : « !Drogues »,
  // qu'on tient même cloué au lit). Par défaut, un jour malade la désactive.
  compteMemeMalade?: boolean;
}

// Marques par habitude puis par date « YYYY-MM-DD » → 'fait' | 'rate'.
export type MarquesHabitudes = Record<string, Record<string, EtatHabitude>>;

// Une habitude telle qu'affichée dans les « missions du jour » : son état du
// jour et, pour les hebdomadaires, l'avancement de la semaine.
export interface HabitudeDuJour {
  id: string;
  nom: string;
  cadence: CadenceHabitude;
  objectifHebdo: number;
  etat: EtatHabitude | undefined; // marque d'aujourd'hui (undefined = à faire)
  faitsCetteSemaine: number;
}

// --- Budget ----------------------------------------------------------------

// Un poste de répartition du salaire mensuel (loyer, courses, épargne…).
// La répartition est manuelle : Louis saisit lui-même chaque montant.
export interface PosteBudget {
  id: string;
  nom: string;
  montant: number; // en euros
}

// --- Courrier --------------------------------------------------------------

// Un mail jugé important par le tri (voir server/mails.js).
export interface MailImportant {
  id: string;
  compte: string; // boîte Gmail qui l'a reçu
  de: string;
  adresse: string;
  objet: string;
  date: string; // ISO
  nonLu: boolean;
  lien: string | null; // ouvre le fil dans Gmail
  raison: string; // résumé d'une phrase écrit par l'IA
}

// Réponse de /api/mails. « configure: false » = aucune boîte dans .env.
export type ReleveCourrier =
  | { configure: false }
  | {
      configure: true;
      comptes: string[];
      mails: MailImportant[];
      ecartes: number;
      nonTries: number;
      jours: number;
      releveLe: string;
      erreurs: string[];
    };

// --- Récaps ----------------------------------------------------------------

export type MomentRecap = 'matin' | 'soir';

// Créneau en cours, calculé par le serveur (ex : « 2026-10-11-matin »).
export interface CreneauRecap {
  cle: string;
  moment: MomentRecap;
  depuis: string; // ISO : les mails reçus après cette date sont « nouveaux »
}

export interface BlocRecap {
  titre: string;
  heureDebut: string;
  heureFin: string;
}

// Un récap du matin ou du soir (voir server/recaps.js).
export interface Recap {
  cle: string;
  moment: MomentRecap;
  creeLe: string; // ISO
  planning: BlocRecap[]; // matin : aujourd'hui ; soir : demain
  habitudes: { nom: string; etat: EtatHabitude | null }[];
  courrier: { configure: boolean; nouveaux: MailImportant[]; nonLus: number };
  mot: string | null; // mot d'introduction écrit par l'IA
  erreurs: string[];
}

export type Vue =
  | 'carte'
  | 'recap'
  | 'planning'
  | 'habitudes'
  | 'budget'
  | 'courrier'
  | 'going-merry';
