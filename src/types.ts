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

export type Vue = 'carte' | 'planning' | 'habitudes' | 'budget' | 'going-merry';
