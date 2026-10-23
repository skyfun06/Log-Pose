import type { Ile } from '../types';

export const iles: Ile[] = [
  {
    id: 1,
    numero: 1,
    arc: 'East Blue',
    titre: 'Décrocher un premier revenu',
    situation:
      "Le tout premier pas hors du village. Il faut prouver qu'on peut gagner ses premiers berrys.",
    quete: 'Générer mon premier revenu réel, aussi petit soit-il.',
    etapesSuggerees: [
      { texte: "Choisir une façon de gagner de l'argent", difficulte: 1 },
      { texte: 'Trouver une première opportunité concrète', difficulte: 2 },
      { texte: 'Encaisser mon premier euro', difficulte: 3 },
    ],
    backgroundImage: '/assets/ile1.png',
    couleurFallback: '#2C1E12',
  },
  {
    id: 2,
    numero: 2,
    arc: 'East Blue',
    titre: 'Valider la rentrée à la fac',
    situation:
      "Une île administrative : il faut s'inscrire, s'organiser, et tenir le rythme des cours.",
    quete: 'Valider mon inscription et mes premières semaines de cours.',
    etapesSuggerees: [
      { texte: 'Organiser mon emploi du temps de cours', difficulte: 1 },
      { texte: "M'inscrire officiellement", difficulte: 2 },
      { texte: 'Tenir les 4 premières semaines', difficulte: 3 },
    ],
    backgroundImage: '',
    couleurFallback: '#1E2C2A',
  },
  {
    id: 3,
    numero: 3,
    arc: 'Grand Line',
    titre: 'Lancer le business',
    situation: 'Le grand large commence ici : poser les fondations concrètes du projet.',
    quete: 'Lancer officiellement le business (structure, offre, premier produit).',
    etapesSuggerees: [
      { texte: 'Définir mon offre', difficulte: 2 },
      { texte: 'Créer la structure (statut)', difficulte: 2 },
      { texte: 'Sortir un premier produit', difficulte: 3 },
    ],
    backgroundImage: '',
    couleurFallback: '#2A1E2C',
  },
  {
    id: 4,
    numero: 4,
    arc: 'Grand Line',
    titre: 'Démarcher / premiers clients',
    situation:
      'Il faut sortir en mer et convaincre : trouver les premiers clients qui font confiance.',
    quete: 'Décrocher mes premiers clients payants.',
    etapesSuggerees: [
      { texte: 'Lister 50 prospects', difficulte: 1 },
      { texte: 'Contacter 20 prospects', difficulte: 2 },
      { texte: 'Signer un premier client payant', difficulte: 3 },
    ],
    backgroundImage: '',
    couleurFallback: '#2C241E',
  },
  {
    id: 5,
    numero: 5,
    arc: 'Grand Line',
    titre: 'Scaler',
    situation: 'Le business tient debout, il faut maintenant le faire grandir.',
    quete: 'Faire grandir le business de façon durable.',
    etapesSuggerees: [
      { texte: 'Automatiser ou déléguer une tâche', difficulte: 2 },
      { texte: 'Avoir 3 clients récurrents', difficulte: 2 },
      { texte: "Doubler le chiffre d'affaires", difficulte: 3 },
    ],
    backgroundImage: '',
    couleurFallback: '#1E242C',
  },
];
