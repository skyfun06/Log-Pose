import styles from './TopBar.module.css';

interface TopBarProps {
  numero: number;
  arc: string;
  titre: string;
  totalIles: number;
}

export function TopBar({ numero, arc, titre, totalIles }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.gauche}>
        <span className={styles.icone}>⚓</span>
        <span className={styles.repere}>
          Île {numero} · {arc}
        </span>
        <span className={styles.titre}>{titre}</span>
      </div>
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
