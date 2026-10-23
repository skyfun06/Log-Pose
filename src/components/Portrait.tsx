import type { Role } from '../data/equipage';
import styles from './Portrait.module.css';

// Médaillon d'un membre d'équipage : un emblème gravé par rôle. Pas encore
// recruté : silhouette sombre et cadenas.
const EMBLEMES: Record<Role, string> = {
  vigie: 'M4 15.5 16 9.5l2 4-12 6zM14 18l2 3.5M9.5 20.5 8.5 22M16 9.5l1.5-1 2 4-1.5 1',
  cuisinier: 'M7 14h10v5H7zM7 14c-3 0-4-4-1-5 0-3 4-4 6-2 2-2 6-1 6 2 3 1 2 5-1 5',
  navigatrice: 'M12 3a9 9 0 1 0 .01 0zM15 9l-2 4-4 2 2-4z',
  charpentier: 'M5 19.5l8.5-8.5M11.5 5.5l5 5 3-3-5-5z',
  medecin: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  archeologue: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',
  musicien:
    'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  timonier:
    'M12 7a5 5 0 1 0 .01 0zM12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3.6 3.6M15.5 15.5l3.6 3.6M4.9 19.1l3.6-3.6M15.5 8.5l3.6-3.6',
  second: 'M4 4l16 16M20 4 4 20M4 4v4M4 4h4M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3',
};

export function Portrait({
  role,
  recrute,
  taille = 56,
}: {
  role: Role;
  recrute: boolean;
  taille?: number;
}) {
  return (
    <span
      className={recrute ? styles.portrait : `${styles.portrait} ${styles.verrouille}`}
      style={{ width: taille, height: taille }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        <path d={recrute ? EMBLEMES[role] : 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z'} />
      </svg>
    </span>
  );
}
