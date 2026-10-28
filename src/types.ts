export interface Ile {
  id: number;
  numero: number;
  arc: string;
  nom: string; // nom de l'île sur la carte (« Île de l'Aube »)
  titre: string; // l'objectif de vie qu'elle représente
  situation: string;
  quete: string;
  pourquoi: string; // l'idée derrière la quête
  backgroundImage: string;
  couleurFallback: string;
  // Étapes proposées tant que Louis n'a pas réglé les siennes.
  etapesSuggerees: { texte: string; difficulte: Difficulte }[];
}

// Difficulté d'un objectif : 1 = facile, 2 = costaud, 3 = exploit. Plus c'est
// dur, plus le navire avance et plus la victoire est fêtée.
export type Difficulte = 1 | 2 | 3;

// Une étape (objectif) de la quête d'une île. Les cocher toutes fait accoster
// le navire : l'île est conquise.
export interface Etape {
  id: string;
  texte: string;
  difficulte: Difficulte;
  creeLe: string; // ISO
  faiteLe?: string; // ISO
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

// Un gain réel inscrit au registre (la prime est la somme des gains).
export interface Gain {
  id: string;
  montant: number; // euros
  date: string; // ISO
  note?: string; // d'où vient l'argent
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

// D'où vient le salaire du budget : saisi à la main, ou lu sur les fiches de
// paie d'un mois du second cerveau (mois « AAAA-MM », null = le plus récent).
export type SourceSalaire = { mode: 'manuel' } | { mode: 'fiche'; mois: string | null };

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

// Un créneau du programme retenu comme priorité, repris mot pour mot.
export interface BlocPrioritaire {
  titre: string;
  heureDebut: string;
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
  priorites?: BlocPrioritaire[]; // créneaux clés choisis par l'IA (absents des vieux récaps)
  conseil?: string | null; // conseil de l'IA pour la suite
  erreurs: string[];
}

export type Vue =
  | 'carte'
  | 'recap'
  | 'planning'
  | 'habitudes'
  | 'budget'
  | 'courrier'
  | 'reseaux'
  | 'going-merry';

// --- Réseaux ---------------------------------------------------------------

// Plateformes de l'onglet « Réseaux » (voir server/reseaux/index.js).
export type IdReseau = 'tiktok' | 'instagram' | 'youtube';

// Un compte tel que vu par le serveur. « manque » : autorisations non
// accordées ; « destination » : où atterrit une vidéo envoyée (« tes
// brouillons TikTok ») ; « conseil » : quoi faire ensuite.
export interface EtatReseau {
  id: IdReseau;
  nom: string;
  configure: boolean;
  connecte: boolean;
  manque: string[];
  destination: string;
  conseil: string | null;
  publique?: boolean; // la vidéo sort tout de suite en public (pas de brouillon)
  legende?: boolean; // la légende saisie dans Log Pose est reprise
}

export interface VideoReseau {
  id: string;
  titre: string;
  publieeLe: string; // ISO
  couverture: string | null;
  lien: string | null;
  duree: number; // secondes
  vues: number;
  likes: number | null; // null = la plateforme ne le donne pas
  commentaires: number | null;
  partages: number | null;
}

export interface StatsReseau {
  compte: {
    nom: string;
    avatar: string | null;
    abonnes: number;
    likes: number | null;
    videos: number;
  };
  videos: VideoReseau[]; // publiques, les plus récentes d'abord
  releveLe: string; // ISO
}

// --- Second cerveau ---------------------------------------------------------

// Lecture du fichier par Ollama (voir server/cerveau.js).
export type AnalyseCerveau =
  | { etat: 'attente' | 'en-cours' }
  | {
      etat: 'faite';
      resume: string;
      motsCles: string[];
      date: string | null; // AAAA-MM-JJ trouvée dans le document
      montant: number | null; // en euros, trouvé dans le document
    }
  | { etat: 'echec' | 'sans-objet'; raison: string };

// Infos saisies à la main lors du dépôt (modifiables ensuite).
export interface InfosCerveau {
  nom: string;
  categorie: string;
  date: string | null; // AAAA-MM-JJ
  montant: number | null; // euros
  note: string;
}

export interface FicheCerveau extends InfosCerveau {
  id: string;
  fichier: { nomOrigine: string; type: string; taille: number; extension: string };
  ajouteLe: string; // ISO
  apercu?: boolean; // miniature disponible (images)
  analyse: AnalyseCerveau;
}

// Un échange avec le cerveau : les réponses citent les fichiers trouvés.
export interface MessageCerveau {
  role: 'user' | 'assistant';
  content: string;
  ids?: string[];
}
