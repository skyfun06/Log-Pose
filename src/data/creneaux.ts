// Outils communs à l'emploi du temps et au programme du jour : reconnaître la
// nature d'un créneau d'après son titre, le ranger dans un moment de la
// journée, et formater heures et durées.

export type Nature = 'travail' | 'sport' | 'lecture' | 'etudes' | 'repas' | 'sommeil' | 'autre';

// Mots-clés (sans accents, en minuscules) → nature. Le premier qui correspond gagne.
const MOTS_CLES: [Nature, string[]][] = [
  ['sommeil', ['coucher', 'dormir', 'sieste', 'sommeil', 'reveil', 'lever']],
  ['sport', ['sport', 'muscu', 'courir', 'course', 'footing', 'running', 'salle', 'velo', 'natation', 'yoga', 'etirement', 'marche']],
  ['lecture', ['lire', 'lecture', 'livre', 'pages']],
  ['etudes', ['cours', 'fac', 'reviser', 'revision', 'etudier', 'examen', 'partiel', 'td', 'tp', 'devoir']],
  ['repas', ['repas', 'dejeuner', 'diner', 'manger', 'cuisine', 'petit-dej', 'petit dej']],
  ['travail', ['prospection', 'prospect', 'client', 'travail', 'boulot', 'business', 'mail', 'appel', 'rdv', 'rendez-vous', 'projet', 'reunion', 'facture', 'vente', 'shift', 'service']],
];

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function natureDe(titre: string): Nature {
  const t = normaliser(titre);
  for (const [nature, mots] of MOTS_CLES) {
    if (mots.some((m) => new RegExp(`(^|[^a-z])${m}`).test(t))) return nature;
  }
  return 'autre';
}

export const LIBELLES_NATURE: Record<Nature, string> = {
  travail: 'Travail',
  sport: 'Sport',
  lecture: 'Lecture',
  etudes: 'Études',
  repas: 'Repas',
  sommeil: 'Repos',
  autre: 'Cap',
};

// Moments de la journée, dans l'ordre.
export type Moment = 'matin' | 'apresMidi' | 'soir';

export const MOMENTS: { cle: Moment; label: string; debut: number }[] = [
  { cle: 'matin', label: 'Matin', debut: 0 },
  { cle: 'apresMidi', label: 'Après-midi', debut: 12 * 60 },
  { cle: 'soir', label: 'Soir', debut: 18 * 60 },
];

export function momentDe(minutes: number): Moment {
  if (minutes >= 18 * 60) return 'soir';
  if (minutes >= 12 * 60) return 'apresMidi';
  return 'matin';
}

export function enMinutes(h: string): number {
  const [heures, minutes] = h.split(':').map(Number);
  return heures * 60 + minutes;
}

export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

// « dans 25 min », « dans 2 h 10 ».
export function formatDans(minutes: number): string {
  return `dans ${formatDuree(Math.max(1, Math.round(minutes)))}`;
}
