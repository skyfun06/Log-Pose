import type { BlocPlanning } from '../types';

// Emploi du temps conseillé, construit autour des horaires de travail fixes de
// Louis (lun, mar, sam : 11 h – 19 h ; mer : 9 h – 17 h).
//
// Principes :
// - même rythme chaque jour : lever 7 h 30 (8 h 30 le dimanche), écrans
//   éteints à 23 h → coucher avant minuit, 8 h de sommeil ;
// - le cerveau frais du matin va au business : 2 h de focus avant le travail
//   les jours à 11 h, et de vraies journées business le jeudi et le vendredi ;
// - prospection tous les jours (quête de l'île : le premier revenu), courte
//   les jours travaillés, longue les jours libres ;
// - 3 séances de sport espacées (mer, ven, dim), jamais après une journée
//   de 11 h – 19 h ;
// - lecture le soir, loin des écrans ; revue de la semaine le dimanche.
// Les créneaux « fixe » (le travail) ne se modifient pas.

export const PROGRAMME_CONSEILLE: BlocPlanning[] = [
  // --- Travail (fixe) -------------------------------------------------------
  { id: 'p-travail-long', titre: 'Travail', heureDebut: '11:00', heureFin: '19:00', jours: ['lun', 'mar', 'sam'], questWeight: 0, fixe: true },
  { id: 'p-travail-mer', titre: 'Travail', heureDebut: '09:00', heureFin: '17:00', jours: ['mer'], questWeight: 0, fixe: true },

  // --- Rythme de chaque jour ------------------------------------------------
  { id: 'p-reveil', titre: 'Réveil, verre d’eau & petit-déjeuner', heureDebut: '07:30', heureFin: '08:00', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'], questWeight: 0 },
  { id: 'p-reveil-dim', titre: 'Réveil, verre d’eau & petit-déjeuner', heureDebut: '08:30', heureFin: '09:00', jours: ['dim'], questWeight: 0 },
  { id: 'p-diner', titre: 'Dîner', heureDebut: '19:30', heureFin: '20:15', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], questWeight: 0 },
  { id: 'p-lecture', titre: "Lire 10 pages d'un livre utile", heureDebut: '22:30', heureFin: '23:00', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], questWeight: 0 },
  { id: 'p-coucher', titre: 'Écrans éteints, préparer le coucher', heureDebut: '23:00', heureFin: '23:30', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], questWeight: 0 },

  // --- Jours 11 h – 19 h (lun, mar, sam) : le business avant de partir -------
  { id: 'p-prospection-matin', titre: 'Prospection : 3 messages + relances', heureDebut: '08:00', heureFin: '09:00', jours: ['lun', 'mar', 'sam'], questWeight: 10 },
  { id: 'p-business-matin', titre: "Business : avancer l'offre (téléphone loin)", heureDebut: '09:00', heureFin: '10:00', jours: ['lun', 'mar', 'sam'], questWeight: 5 },
  { id: 'p-dejeuner-tot', titre: 'Déjeuner & trajet', heureDebut: '10:00', heureFin: '11:00', jours: ['lun', 'mar', 'sam'], questWeight: 0 },

  // --- Mercredi (9 h – 17 h) -------------------------------------------------
  { id: 'p-prospection-mer', titre: 'Prospection : 3 messages', heureDebut: '08:00', heureFin: '08:30', jours: ['mer'], questWeight: 10 },
  { id: 'p-sport-mer', titre: 'Sport : séance complète', heureDebut: '17:45', heureFin: '18:45', jours: ['mer'], questWeight: 0 },
  { id: 'p-suivi-mer', titre: 'Business : répondre aux prospects & suivi', heureDebut: '20:30', heureFin: '21:30', jours: ['mer'], questWeight: 5 },

  // --- Jeudi & vendredi (libres) : les grosses journées business -------------
  { id: 'p-focus', titre: 'Business : bloc focus (offre, produit, contenu)', heureDebut: '08:30', heureFin: '10:30', jours: ['jeu', 'ven'], questWeight: 5 },
  { id: 'p-prospection-longue', titre: 'Prospection : messages, appels & relances', heureDebut: '10:45', heureFin: '12:00', jours: ['jeu', 'ven'], questWeight: 10 },
  { id: 'p-dejeuner', titre: 'Déjeuner', heureDebut: '12:15', heureFin: '13:00', jours: ['jeu', 'ven', 'dim'], questWeight: 0 },
  { id: 'p-etudes', titre: 'Études / fac : cours & révisions', heureDebut: '14:00', heureFin: '16:00', jours: ['jeu', 'ven'], questWeight: 0 },
  { id: 'p-admin-jeu', titre: 'Business : admin & suivi (devis, factures)', heureDebut: '16:30', heureFin: '17:30', jours: ['jeu'], questWeight: 5 },
  { id: 'p-sport-ven', titre: 'Sport : séance complète', heureDebut: '17:00', heureFin: '18:00', jours: ['ven'], questWeight: 0 },

  // --- Dimanche : récupérer et préparer la semaine ---------------------------
  { id: 'p-sport-dim', titre: 'Sport : séance complète', heureDebut: '10:00', heureFin: '11:00', jours: ['dim'], questWeight: 0 },
  { id: 'p-revue', titre: 'Revue de la semaine & plan de la suivante', heureDebut: '18:00', heureFin: '19:00', jours: ['dim'], questWeight: 5 },
];

// Version du programme : l'augmenter le réapplique une fois chez Louis (son
// ancien emploi du temps est sauvegardé avant).
export const VERSION_PROGRAMME = 1;
