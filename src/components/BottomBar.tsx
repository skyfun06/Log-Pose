import styles from './BottomBar.module.css';

const OBJECTIF_BOUNTY = 5_000_000_000;

interface BottomBarProps {
  bounty: number;
}

export function BottomBar({ bounty }: BottomBarProps) {
  const ratio = Math.min(100, (bounty / OBJECTIF_BOUNTY) * 100);
  const pourcentageAffiche = ratio.toFixed(ratio < 1 ? 3 : 1);

  return (
    <footer className={styles.bar}>
      <div className={styles.ligneTexte}>
        <span className={styles.icone} aria-hidden="true">
          👑
        </span>
        <span className={styles.label}>
          Roi des pirates · ฿ {OBJECTIF_BOUNTY.toLocaleString('fr-FR')}
        </span>
        <span className={styles.pourcentage}>{pourcentageAffiche}%</span>
      </div>
      <div className={styles.barreFond}>
        <div className={styles.barreRemplie} style={{ width: `${ratio}%` }} />
      </div>
    </footer>
  );
}
