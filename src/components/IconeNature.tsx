import type { Nature } from '../data/creneaux';

// Petite icône gravée au trait pour chaque nature de créneau.
const TRACES: Record<Nature, string> = {
  travail: 'M4 8.5h16v10H4zM9 8.5V6.5h6v2M4 13h16',
  sport: 'M3.5 9.5v5M6.5 7.5v9M17.5 7.5v9M20.5 9.5v5M6.5 12h11',
  lecture: 'M12 6.5c-2-1.4-4.8-1.8-8-1.3V18c3.2-.5 6 0 8 1.3 2-1.3 4.8-1.8 8-1.3V5.2c-3.2-.5-6-.1-8 1.3zM12 6.5v12.8',
  etudes: 'M2.5 9.5 12 5l9.5 4.5L12 14zM6.5 11.5v4.3c3.5 2.3 7.5 2.3 11 0v-4.3M21.5 9.5v5',
  repas: 'M7 3.5v17M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M16.5 20.5v-17c-2.2 1.2-3 4-3 7h3',
  sommeil: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  autre: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM14.8 9.2l-1.7 3.9-3.9 1.7 1.7-3.9z',
};

export function IconeNature({ nature, className }: { nature: Nature; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACES[nature]} />
    </svg>
  );
}
