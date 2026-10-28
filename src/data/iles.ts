import type { Ile } from '../types';

// Le voyage : 15 îles en trois mers, calées sur le vrai projet de Louis
// (abonnement à 40 €/mois pour faire monter la note des commerces sous
// 4 étoiles, démarchés en physique entre Nice et Cannes).
//  - East Blue : préparer le lancement (novembre-décembre 2026) : site final,
//    son parcours raconté en vidéo, futurs démarcheurs réunis, premiers
//    commerces engagés pour janvier, société au 1er janvier ;
//  - Grand Line : conquérir (dès janvier 2027) : premiers clients, démarcheurs
//    recrutés par le parrainage, recommandations, 1 000 € par mois ;
//  - Nouveau Monde : grandir puis passer à la suite : 1 500 € net par mois
//    (plus jamais de patron), équipe sur toute la Côte, entreprise suivante.
// Chaque île a une quête courte (3 à 4 étapes) pour avancer souvent. L'ordre
// du tableau est l'ordre de la route ; les id ne servent que de clés (les
// anciennes îles 1 à 5 gardent les leurs pour ne rien perdre).

const FOND = '/assets/ile1.webp';

export const iles: Ile[] = [
  // ===== East Blue : préparer le lancement (novembre-décembre 2026) =====
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
    nom: 'Chantier Naval',
    titre: 'Mettre le site en version finale',
    situation:
      'Le navire est construit, il reste les derniers coups de rabot. Mi-novembre, il doit pouvoir prendre la mer sans prendre l’eau.',
    quete: 'Peaufiner le site et le mettre en ligne en version finale avant le 20 novembre.',
    pourquoi:
      'Un commerçant qui voit un bug ne signe pas, un futur démarcheur qui voit un site bancal ne s’engage pas. Le site, c’est ta crédibilité.',
    etapesSuggerees: [
      { texte: 'Lister les dernières choses à peaufiner', difficulte: 1 },
      { texte: 'Faire tout le parcours client moi-même, du début au paiement', difficulte: 2 },
      { texte: 'Corriger tout ce qui accroche', difficulte: 2 },
      { texte: 'Mettre en ligne la version finale', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },
  {
    id: 1,
    numero: 3,
    arc: 'East Blue',
    nom: 'Île des Projecteurs',
    titre: 'Faire de mon parcours une série que les gens suivent',
    situation:
      "Un jeune qui arrête les cours pour monter sa boîte et devenir riche : c’est déjà une histoire. Sur cette île, tu la racontes chaque jour, et les gens s’attachent.",
    quete: 'Trouver mon format, tenir 30 jours d’affilée et passer les 1 000 abonnés.',
    pourquoi:
      'Tes futurs démarcheurs ont ton âge et scrollent TikTok. S’ils te voient avancer jour après jour, ils voudront embarquer avec toi.',
    etapesSuggerees: [
      { texte: 'Trouver mon format signature (série « Jour X », mes chiffres…)', difficulte: 1 },
      { texte: 'Tenir 30 jours d’affilée à une vidéo par jour', difficulte: 2 },
      { texte: 'Faire une vidéo à 10 000 vues', difficulte: 2 },
      { texte: 'Passer 1 000 abonnés (TikTok, Insta et YouTube réunis)', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 2,
    numero: 4,
    arc: 'East Blue',
    nom: 'Taverne des Recrues',
    titre: 'Réunir mes futurs démarcheurs avant le lancement',
    situation:
      'Dans la taverne, des jeunes motivés qui veulent passer à l’action écoutent ton histoire. En janvier, ils démarchent avec toi.',
    quete: 'Avoir 5 personnes prêtes à démarcher avec moi dès janvier.',
    pourquoi:
      'Seul, tu pousses quelques portes par jour. Si ton équipage est prêt le jour du lancement, tu démarres à plusieurs dès la première semaine.',
    etapesSuggerees: [
      { texte: 'Publier la vidéo qui annonce le programme de parrainage', difficulte: 1 },
      { texte: 'Créer le groupe des futurs démarcheurs (Snap, WhatsApp ou Discord)', difficulte: 1 },
      { texte: 'Avoir 20 personnes intéressées dans le groupe', difficulte: 2 },
      { texte: '5 personnes qui s’engagent à démarcher en janvier', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 8,
    numero: 5,
    arc: 'East Blue',
    nom: 'Île des Premières Portes',
    titre: 'Rôder mon pitch sur le terrain avant janvier',
    situation:
      'Décembre, entre Nice et Cannes. Avant la vraie conquête, tu pousses tes premières portes pour apprendre ce qui fait dire oui à un commerçant.',
    quete: 'Avoir 3 commerces qui s’engagent à démarrer dès le 2 janvier.',
    pourquoi:
      'Un pitch se travaille sur le terrain, pas dans sa tête. Et commencer janvier avec 3 clients déjà d’accord, c’est un lancement qui démarre en trombe.',
    etapesSuggerees: [
      { texte: 'Écrire mon pitch de 30 secondes et les réponses aux objections', difficulte: 1 },
      { texte: 'Acheter les lunettes Meta et filmer ma première sortie terrain', difficulte: 2 },
      { texte: 'Présenter le système à 20 commerces sous 4 étoiles', difficulte: 2 },
      { texte: '3 commerces qui s’engagent à démarrer en janvier', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 9,
    numero: 6,
    arc: 'East Blue',
    nom: 'Île du Pavillon',
    titre: 'Avoir une vraie société le 1er janvier',
    situation:
      'Dernière escale de l’East Blue : le navire reçoit son nom et ses papiers. Le 1er janvier, il est en règle pour encaisser.',
    quete: 'Choisir le statut et être prêt à encaisser des abonnements dès le 1er janvier.',
    pourquoi:
      'Les papiers ne rapportent rien, mais sans eux rien ne rapporte. Tout régler en décembre, c’est démarcher dès le 2 janvier.',
    etapesSuggerees: [
      { texte: 'Choisir le statut (micro-entreprise ou société) avec un avis pro', difficulte: 1 },
      { texte: 'Préparer le dossier de création pour le 1er janvier', difficulte: 2 },
      { texte: 'Ouvrir le compte pro et le paiement par abonnement', difficulte: 2 },
      { texte: 'Avoir le SIRET et un premier paiement test reçu', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },

  // ===== Grand Line : conquérir la Côte d'Azur (à partir de janvier 2027) =====
  {
    id: 3,
    numero: 7,
    arc: 'Grand Line',
    nom: 'Premier Abordage',
    titre: 'Signer mon premier client payant',
    situation:
      'Janvier, les rues de Nice. On pousse la porte, on parle au gérant, on encaisse les refus, et on revient le lendemain.',
    quete: 'Démarcher 50 commerces et signer le premier abonnement à 40 €.',
    pourquoi:
      'Le premier client payant transforme le projet en entreprise. Après lui, tu ne te demandes plus si ça marche : tu sais.',
    etapesSuggerees: [
      { texte: 'Démarcher 20 commerces en une semaine', difficulte: 1 },
      { texte: 'Filmer une journée de démarchage avec les lunettes Meta', difficulte: 2 },
      { texte: 'Démarcher 50 commerces au total', difficulte: 2 },
      { texte: 'Signer mon premier abonnement payant', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 10,
    numero: 8,
    arc: 'Grand Line',
    nom: 'Comptoir des Marchands',
    titre: 'Atteindre 10 clients (400 € par mois)',
    situation:
      'Le grand marché de la Côte : maintenant que tu sais signer, il faut le refaire encore et encore, avec méthode.',
    quete: 'Signer 10 clients et garder un rythme de démarchage fixe.',
    pourquoi:
      'Dix clients, c’est la preuve que ce n’était pas de la chance. Tu connais ton taux de réussite : tu sais combien de portes pousser.',
    etapesSuggerees: [
      { texte: 'Fixer mon rythme : 10 commerces démarchés par jour', difficulte: 1 },
      { texte: 'Tenir ce rythme 2 semaines d’affilée', difficulte: 2 },
      { texte: 'Atteindre 5 clients', difficulte: 2 },
      { texte: 'Atteindre 10 clients', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 4,
    numero: 9,
    arc: 'Grand Line',
    nom: 'Île des Recrues',
    titre: 'Lancer mes premiers démarcheurs sur le terrain',
    situation:
      'Les recrues de la taverne t’ont vu démarcher chaque jour. Maintenant, elles poussent les portes à leur tour.',
    quete: 'Former l’équipage de la taverne et avoir un premier client signé par un démarcheur.',
    pourquoi:
      'Tu ne peux pousser que quelques portes par jour. Chaque démarcheur multiplie ta force sans multiplier tes heures.',
    etapesSuggerees: [
      { texte: 'Fixer la commission d’un démarcheur par client signé', difficulte: 1 },
      { texte: 'Former 3 démarcheurs à ma méthode, sur le terrain avec moi', difficulte: 2 },
      { texte: 'Un premier client signé par un démarcheur', difficulte: 3 },
      { texte: '5 clients signés par les démarcheurs en un mois', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 11,
    numero: 10,
    arc: 'Grand Line',
    nom: 'Île des Rumeurs',
    titre: 'Des clients qui restent et qui en ramènent',
    situation:
      'Sur la Côte, les commerçants se parlent. Un client content en amène un autre ; un client déçu en fait fuir dix.',
    quete: 'Garder tous mes clients 3 mois et décrocher des clients par recommandation.',
    pourquoi:
      'Avec un abonnement, garder un client vaut autant qu’en signer un nouveau. Les résultats parlent, les commerçants répètent.',
    etapesSuggerees: [
      { texte: 'Envoyer chaque mois ses résultats à chaque client', difficulte: 1 },
      { texte: 'Publier 3 études de cas avant/après', difficulte: 2 },
      { texte: 'Passer un mois complet sans aucune résiliation', difficulte: 2 },
      { texte: 'Signer 3 clients venus par recommandation', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 12,
    numero: 11,
    arc: 'Grand Line',
    nom: 'Île des Marées',
    titre: 'Atteindre 25 clients (1 000 € par mois)',
    situation:
      'Les abonnements reviennent chaque mois, comme les marées. Ici, le revenu ne repart plus de zéro le 1er du mois.',
    quete: 'Atteindre 1 000 € d’abonnements par mois.',
    pourquoi:
      'À 1 000 € par mois, le business commence à payer ta vie. Tu peux décider en confiance de prolonger le job… ou pas.',
    etapesSuggerees: [
      { texte: 'Atteindre 15 clients', difficulte: 2 },
      { texte: 'Avoir 5 démarcheurs actifs', difficulte: 2 },
      { texte: 'Atteindre 25 clients, soit 1 000 € par mois', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },

  // ===== Nouveau Monde : grandir puis passer à la suite =====
  {
    id: 13,
    numero: 12,
    arc: 'Nouveau Monde',
    nom: 'Île de la Liberté',
    titre: 'Ne plus jamais avoir de patron',
    situation:
      "L'île que tout pirate rêve d'atteindre : le business rapporte plus que le SMIC, le job devient un choix et plus une obligation.",
    quete: 'Atteindre 50 clients (2 000 € par mois, environ 1 500 € après cotisations), 3 mois d’affilée.',
    pourquoi:
      'C’est ta ligne d’arrivée : au-delà de 1 500 € par mois, tu ne retravailles plus jamais pour quelqu’un d’autre.',
    etapesSuggerees: [
      { texte: 'Atteindre 38 clients, soit 1 500 € par mois avant cotisations', difficulte: 2 },
      { texte: 'Atteindre 50 clients, soit 1 500 € par mois après cotisations', difficulte: 3 },
      { texte: 'Tenir ce niveau 3 mois d’affilée', difficulte: 3 },
      { texte: 'Quitter le job pour de bon', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C241E',
  },
  {
    id: 5,
    numero: 13,
    arc: 'Nouveau Monde',
    nom: "Île de l'Équipage",
    titre: 'Une vraie équipe de démarcheurs sur toute la Côte',
    situation:
      'Nice et Cannes ne suffisent plus. Antibes, Monaco, Menton, Grasse : il faut un équipage capable de couvrir toute la Côte d’Azur.',
    quete: 'Avoir 10 démarcheurs actifs et 100 clients (4 000 € par mois).',
    pourquoi:
      'Un capitaine seul plafonne. Un équipage bien formé fait grandir l’entreprise même les jours où tu ne sors pas.',
    etapesSuggerees: [
      { texte: 'Écrire la méthode de démarchage que chaque recrue apprend', difficulte: 1 },
      { texte: 'Avoir 10 démarcheurs actifs', difficulte: 2 },
      { texte: 'Ouvrir une nouvelle ville au-delà de Nice-Cannes', difficulte: 2 },
      { texte: 'Atteindre 100 clients', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2A1E2C',
  },
  {
    id: 14,
    numero: 14,
    arc: 'Nouveau Monde',
    nom: 'Forteresse des Rouages',
    titre: "Faire tourner l'entreprise sans moi",
    situation:
      'Une forteresse d’engrenages : recrutement, formation, suivi des clients. Chaque rouage tourne, même quand le capitaine est à terre.',
    quete: 'Passer un mois sans démarcher moi-même tout en gagnant des clients.',
    pourquoi:
      'Une entreprise qui tourne sans toi a de la valeur : elle te rapporte, et elle te libère pour la suivante.',
    etapesSuggerees: [
      { texte: 'Confier le suivi des clients à quelqu’un', difficulte: 2 },
      { texte: 'Nommer un chef d’équipe des démarcheurs', difficulte: 2 },
      { texte: 'Un mois sans démarcher et plus de clients qu’avant', difficulte: 3 },
      { texte: 'Atteindre 250 clients, soit 10 000 € par mois', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#1E242C',
  },
  {
    id: 15,
    numero: 15,
    arc: 'Nouveau Monde',
    nom: 'Laugh Tale',
    titre: "Lancer l'entreprise suivante",
    situation:
      "La dernière île, celle dont on parle à voix basse dans les tavernes. Le premier navire tourne seul : le capitaine peut en armer un deuxième.",
    quete: 'Lancer une deuxième entreprise financée par la première, et faire fructifier le reste.',
    pourquoi:
      'Le vrai One Piece, c’est de pouvoir recommencer quand tu veux, avec l’argent, la méthode et l’audience déjà en main.',
    etapesSuggerees: [
      { texte: 'Investir chaque mois une part de ce que je gagne', difficulte: 2 },
      { texte: 'Choisir l’idée de la deuxième entreprise', difficulte: 2 },
      { texte: 'La lancer avec l’argent de la première', difficulte: 3 },
    ],
    backgroundImage: FOND,
    couleurFallback: '#2C1E12',
  },
];
