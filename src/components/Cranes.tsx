import { NOMS_DIFFICULTE } from '../data/difficulte';
import type { Difficulte } from '../types';
import styles from './Cranes.module.css';

// Crânes de difficulté (1 à 3), pleins jusqu'au niveau.
export function Cranes({ niveau, className }: { niveau: Difficulte; className?: string }) {
  return (
    <span
      className={[styles.cranes, className ?? ''].join(' ')}
      aria-label={NOMS_DIFFICULTE[niveau]}
    >
      {[1, 2, 3].map((n) => (
        <svg
          key={n}
          viewBox="0 0 12 12"
          className={n <= niveau ? styles.craneOn : styles.craneOff}
          aria-hidden="true"
        >
          <path d="M6 1.2a4.3 4.3 0 0 0-4.3 4.3c0 1.5.7 2.4 1.6 3v1.6h5.4V8.5c.9-.6 1.6-1.5 1.6-3A4.3 4.3 0 0 0 6 1.2z" />
          <circle cx="4.3" cy="5.6" r="1" className={styles.craneOeil} />
          <circle cx="7.7" cy="5.6" r="1" className={styles.craneOeil} />
        </svg>
      ))}
    </span>
  );
}
