import type { Mission } from '../types';

export const missionsInitiales: Mission[] = [
  {
    id: 'm1',
    texte: 'Envoyer 3 messages de prospection',
    questWeight: 10,
    statut: 'pending',
  },
  {
    id: 'm2',
    texte: 'Faire 30 minutes de sport',
    questWeight: 0,
    statut: 'pending',
  },
  {
    id: 'm3',
    texte: 'Lire 10 pages d\'un livre utile',
    questWeight: 0,
    statut: 'pending',
  },
  {
    id: 'm4',
    texte: 'Se coucher avant minuit',
    questWeight: 0,
    statut: 'pending',
  },
];
