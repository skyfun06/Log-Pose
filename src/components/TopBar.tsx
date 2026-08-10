import type { Vue } from '../types';
import styles from './TopBar.module.css';

interface TopBarProps {
  numero: number;
  arc: string;
  titre: string;
  totalIles: number;
  vue: Vue;
  onChangerVue: (vue: Vue) => void;
}

export function TopBar({ numero, arc, titre, totalIles, vue, onChangerVue }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.gauche}>
        <span className={styles.icone}>⚓</span>
        <span className={styles.repere}>
          Île {numero} · {arc}
        </span>
        <span className={styles.titre}>{titre}</span>
      </div>

      <nav className={styles.onglets}>
        <button
          type="button"
          className={vue === 'carte' ? `${styles.onglet} ${styles.ongletActif}` : styles.onglet}
          onClick={() => onChangerVue('carte')}
        >
          Carte
        </button>
        <button
          type="button"
          className={
            vue === 'planning' ? `${styles.onglet} ${styles.ongletActif}` : styles.onglet
          }
          onClick={() => onChangerVue('planning')}
        >
          Emploi du temps
        </button>
      </nav>

      <div className={styles.points}>
        {Array.from({ length: totalIles }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={n === numero ? `${styles.point} ${styles.pointActif}` : styles.point}
          />
        ))}
      </div>
    </header>
  );
}
