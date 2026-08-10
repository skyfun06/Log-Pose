import styles from './LogPoseCard.module.css';

interface LogPoseCardProps {
  quete: string;
  progression: number;
}

export function LogPoseCard({ quete, progression }: LogPoseCardProps) {
  return (
    <section className={styles.carte}>
      <h2 className={styles.entete}>
        <span aria-hidden="true">🧭</span> Log pose · quête de l'île
      </h2>
      <p className={styles.quete}>{quete}</p>
      <div className={styles.barreFond}>
        <div className={styles.barreRemplie} style={{ width: `${progression}%` }} />
      </div>
      <div className={styles.pourcentage}>{progression}%</div>
    </section>
  );
}
