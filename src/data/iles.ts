import type { Ile } from '../types';

// Le voyage : 15 îles en trois mers, de plus en plus exigeantes.
//  - East Blue : se construire (journées, argent, premier revenu, études, compétence) ;
//  - Grand Line : lancer le business (idée, structure, visibilité, clients, réputation) ;
//  - Nouveau Monde : grandir et se libérer (récurrence, équipe, systèmes, liberté).
// Chaque île a une quête courte (3 à 4 étapes) pour avancer souvent. L'ordre
// du tableau est l'ordre de la route ; les id ne servent que de clés (les
// anciennes îles 1 à 5 gardent les leurs pour ne rien perdre).

const FOND = '/assets/ile1.png';

export const iles: Ile[] = [
  // ===== East Blue : se construire =====
  {
    id: 6,
    numero: 1,
    arc: 'East Blue',
    nom: "Île de l'Aube",
    titre: 'Reprendre la barre de mes journées',
    situation:
      "Le premier matin du voyage. Avant d'affronter la mer, il faut savoir se lever, s'organiser et tenir un cap, même par temps calme.",
    quete: 'Tenir une vraie routine pendant une semaine.',
    pourquoi:
      'Toutes les grandes conquêtes commencent par des journées maîtrisées. Une routine solide, c’est le gouvernail de tout le reste.',
    etapesSuggerees: [
      { texte: 'Fixer mon heure de lever et de coucher', difficulte: 1 },
      { texte: "Tenir mon emploi du temps 3 jours d'affilée", difficulte: 2 },
      { texte: 'Tenir une semaine complète sans décrocher', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C1E12',
  },
  {
    id: 7,
    numero: 2,
    arc: 'East Blue',
    nom: 'Île du Coffre',
    titre: 'Prendre le contrôle de mon argent',
    situation:
      'Un pirate sans coffre ne va pas loin. Sur cette île, on apprend à savoir où part chaque berry.',
    quete: 'Construire un budget et une première réserve.',
    pourquoi:
      'Maîtriser ses dépenses libère de l’énergie et du courage : on ose davantage quand on a un filet de sécurité.',
    etapesSuggerees: [
      { texte: 'Répartir mon salaire dans le budget', difficulte: 1 },
      { texte: 'Suivre mes dépenses pendant un mois', difficulte: 2 },
      { texte: 'Mettre 300 € de côté', difficulte: 2 },
      { texte: "Avoir un mois de dépenses d'avance", difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C1E12',
  },
  {
    id: 1,
    numero: 3,
    arc: 'East Blue',
    nom: 'Port du Premier Berry',
    titre: 'Gagner mon premier euro par moi-même',
    situation:
      "Le salaire paie le voyage, mais ici il s'agit d'autre chose : prouver qu'on peut créer de la valeur seul, sans patron.",
    quete: 'Encaisser un premier revenu hors salaire, aussi petit soit-il.',
    pourquoi:
      'Le premier euro gagné seul change tout : on passe de « je voudrais » à « je sais le faire ».',
    etapesSuggerees: [
      { texte: 'Lister 5 choses que je sais faire et qui rendent service', difficulte: 1 },
      { texte: 'Proposer un service à mon entourage', difficulte: 2 },
      { texte: 'Encaisser mon premier euro', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C1E12',
  },
  {
    id: 2,
    numero: 4,
    arc: 'East Blue',
    nom: 'Archipel du Savoir',
    titre: 'Réussir ma rentrée à la fac',
    situation:
      "Une île exigeante : s'inscrire, s'organiser et tenir le rythme des cours en parallèle du reste.",
    quete: 'Valider mon inscription et tenir mes premières semaines de cours.',
    pourquoi:
      'Les études sont une arme à long terme. Les tenir en parallèle prouve que tu sais mener plusieurs combats à la fois.',
    etapesSuggerees: [
      { texte: 'Caler les cours dans mon emploi du temps', difficulte: 1 },
      { texte: "M'inscrire officiellement", difficulte: 2 },
      { texte: 'Tenir les 4 premières semaines sans retard', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E2C2A',
  },
  {
    id: 8,
    numero: 5,
    arc: 'East Blue',
    nom: 'Île de la Forge',
    titre: 'Forger une compétence qui se vend',
    situation:
      "Dans les forges de l'East Blue, on façonne l'arme qu'on emportera sur Grand Line : un savoir-faire pour lequel des gens sont prêts à payer.",
    quete: 'Choisir une compétence et produire un premier travail dont je suis fier.',
    pourquoi:
      'Un business repose sur un savoir-faire. Plus ta lame est affûtée, plus les clients viendront à toi.',
    etapesSuggerees: [
      { texte: 'Choisir la compétence à travailler', difficulte: 1 },
      { texte: 'Y consacrer 10 heures de pratique', difficulte: 2 },
      { texte: 'Réaliser un projet démonstration à montrer', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },

  // ===== Grand Line : lancer le business =====
  {
    id: 9,
    numero: 6,
    arc: 'Grand Line',
    nom: 'Île des Idées',
    titre: 'Trouver une idée qui répond à un vrai besoin',
    situation:
      "Les courants de Grand Line sont imprévisibles. Pour ne pas s'y perdre, il faut un cap : un problème réel que des gens veulent voir résolu.",
    quete: 'Valider une idée de business auprès de vraies personnes.',
    pourquoi:
      'La plupart des projets échouent faute de clients, pas faute de travail. Écouter avant de construire évite des mois perdus.',
    etapesSuggerees: [
      { texte: 'Lister 10 problèmes que je pourrais résoudre', difficulte: 1 },
      { texte: 'Interroger 5 personnes concernées', difficulte: 2 },
      { texte: "Choisir l'idée la plus demandée", difficulte: 2 },
      { texte: 'Obtenir un premier « je paierais pour ça »', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E2C2A',
  },
  {
    id: 3,
    numero: 7,
    arc: 'Grand Line',
    nom: 'Chantier Naval',
    titre: 'Lancer officiellement le business',
    situation:
      'Sur ce chantier, le projet devient un vrai navire : un nom, un statut, une offre claire.',
    quete: 'Créer la structure et une offre que l’on peut acheter.',
    pourquoi:
      'Tant que ce n’est pas officiel, c’est un rêve. Une offre claire avec un prix, c’est un business.',
    etapesSuggerees: [
      { texte: 'Définir mon offre et mon prix', difficulte: 2 },
      { texte: 'Ouvrir un moyen d’encaisser les paiements', difficulte: 1 },
      { texte: 'Créer mon statut (micro-entreprise)', difficulte: 2 },
      { texte: 'Sortir la première version de mon produit', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },
  {
    id: 10,
    numero: 8,
    arc: 'Grand Line',
    nom: 'Île de la Vitrine',
    titre: 'Me rendre visible',
    situation:
      'Un navire que personne ne voit ne fait pas de prises. Ici, on hisse son pavillon pour que les bons clients le repèrent.',
    quete: 'Avoir une vitrine en ligne et commencer à publier.',
    pourquoi:
      'La visibilité travaille pour toi pendant que tu dors. Chaque publication est une bouteille à la mer qui peut ramener un client.',
    etapesSuggerees: [
      { texte: 'Créer ma page ou mon portfolio', difficulte: 2 },
      { texte: 'Publier 5 contenus utiles', difficulte: 2 },
      { texte: 'Recevoir un premier contact entrant', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },
  {
    id: 4,
    numero: 9,
    arc: 'Grand Line',
    nom: 'Comptoir des Marchands',
    titre: 'Décrocher mes premiers clients payants',
    situation:
      'Le grand marché de Grand Line : il faut aller au contact, proposer, essuyer des refus et revenir.',
    quete: 'Signer mes trois premiers clients payants.',
    pourquoi:
      'Chaque client prouve que ton offre a de la valeur. Les refus font partie du chemin : chacun te rapproche du oui.',
    etapesSuggerees: [
      { texte: 'Lister 50 prospects', difficulte: 1 },
      { texte: 'Contacter 20 prospects', difficulte: 2 },
      { texte: 'Signer un premier client', difficulte: 3 },
      { texte: 'Signer trois clients', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 11,
    numero: 10,
    arc: 'Grand Line',
    nom: 'Île des Rumeurs',
    titre: 'Faire parler de moi',
    situation: 'Sur cette île, les nouvelles voyagent vite. Un client satisfait en amène d’autres.',
    quete: 'Transformer mes clients en ambassadeurs.',
    pourquoi:
      'La recommandation est le canal le plus puissant et le moins cher. Ta réputation devient ta voile.',
    etapesSuggerees: [
      { texte: 'Demander un avis à chaque client', difficulte: 1 },
      { texte: 'Obtenir 3 témoignages', difficulte: 2 },
      { texte: 'Décrocher un client par recommandation', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },

  // ===== Nouveau Monde : grandir et se libérer =====
  {
    id: 12,
    numero: 11,
    arc: 'Nouveau Monde',
    nom: 'Île des Marées',
    titre: 'Créer un revenu qui revient chaque mois',
    situation:
      'Les marées reviennent toujours. Dans le Nouveau Monde, on construit des revenus qui reviennent eux aussi.',
    quete: 'Atteindre 1 000 € de revenu récurrent par mois.',
    pourquoi: 'Un revenu récurrent apporte de la sérénité : tu ne repars plus de zéro chaque mois.',
    etapesSuggerees: [
      { texte: 'Créer une offre récurrente (abonnement, suivi)', difficulte: 2 },
      { texte: 'Signer 3 clients récurrents', difficulte: 2 },
      { texte: 'Atteindre 1 000 € récurrents par mois', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 13,
    numero: 12,
    arc: 'Nouveau Monde',
    nom: "Île de l'Équipage",
    titre: "M'entourer des bonnes personnes",
    situation:
      "Aucun capitaine n'a conquis le Nouveau Monde seul. Ici, on recrute ceux qui rendent le navire plus fort.",
    quete: 'Trouver un mentor et déléguer une première tâche.',
    pourquoi:
      'S’entourer, c’est multiplier sa force. Déléguer libère ton temps pour ce que toi seul peux faire.',
    etapesSuggerees: [
      { texte: "Rejoindre un groupe d'entrepreneurs", difficulte: 1 },
      { texte: 'Trouver un mentor', difficulte: 2 },
      { texte: 'Déléguer une tâche payée à quelqu’un', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },
  {
    id: 5,
    numero: 13,
    arc: 'Nouveau Monde',
    nom: 'Forteresse des Rouages',
    titre: 'Faire tourner le business sans moi',
    situation:
      'Une forteresse d’engrenages : chaque tâche répétée devient une mécanique qui tourne seule.',
    quete: 'Automatiser et documenter pour faire grandir le business.',
    pourquoi:
      'Un business qui dépend de chacune de tes heures plafonne vite. Les systèmes permettent de grandir sans s’épuiser.',
    etapesSuggerees: [
      { texte: 'Documenter mes 3 tâches principales', difficulte: 1 },
      { texte: 'Automatiser une tâche répétitive', difficulte: 2 },
      { texte: "Doubler mon chiffre d'affaires", difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 14,
    numero: 14,
    arc: 'Nouveau Monde',
    nom: 'Île de la Liberté',
    titre: 'Vivre de mon business',
    situation:
      "L'île que tout pirate rêve d'atteindre : ici, le business paie le voyage, plus besoin du salaire.",
    quete: 'Gagner avec le business autant que mon salaire.',
    pourquoi:
      'C’est le moment où l’on choisit son temps. Tout le voyage jusqu’ici mène à cette liberté.',
    etapesSuggerees: [
      { texte: 'Atteindre la moitié de mon salaire avec le business', difficulte: 2 },
      { texte: "Égaler mon salaire 3 mois d'affilée", difficulte: 3 },
      { texte: 'Choisir librement mon temps de travail', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 15,
    numero: 15,
    arc: 'Nouveau Monde',
    nom: 'Laugh Tale',
    titre: 'Bâtir mon empire',
    situation:
      "La dernière île, celle dont on parle à voix basse dans les tavernes. Le trésor attend ceux qui ont tenu le cap jusqu'au bout.",
    quete: 'Construire un patrimoine qui me rend libre pour de bon.',
    pourquoi:
      'Le vrai One Piece, c’est la liberté totale : choisir ses projets, aider les siens et ne plus jamais dépendre de personne.',
    etapesSuggerees: [
      { texte: 'Investir chaque mois une part de mes revenus', difficulte: 2 },
      { texte: "Atteindre 100 000 € de chiffre d'affaires annuel", difficulte: 3 },
      { texte: 'Être libre financièrement', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C1E12',
  },
];
