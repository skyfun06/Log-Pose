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
