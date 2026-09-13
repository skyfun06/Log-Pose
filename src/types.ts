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

export type Vue = 'carte' | 'planning' | 'going-merry';
