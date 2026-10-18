import { BERRYS_PAR_EURO, PALIERS, positionPalier } from '../data/paliers';
import styles from './BottomBar.module.css';

interface BottomBarProps {
  prime: number; // euros gagnés
}

const euros = (n: number) => `${Math.ceil(n).toLocaleString('fr-FR')} €`;
const berrys = (euros: number) => `฿ ${(euros * BERRYS_PAR_EURO).toLocaleString('fr-FR')}`;

// Barre des paliers : le rang atteint, la piste de tous les paliers, et ce
// qu'il reste à gagner pour le suivant.
export function BottomBar({ prime }: BottomBarProps) {
  const { index, actuel, suivant, avancement, reste } = positionPalier(prime);
  // Remplissage de la piste : paliers espacés régulièrement, plus la part
  // déjà parcourue vers le suivant.
  const remplissage = ((index + avancement) / (PALIERS.length - 1)) * 100;

  return (
    <footer className={styles.bar}>
      <div className={styles.rang}>
        <span className={styles.medaille} aria-hidden="true">
          {index + 1}
        </span>
        <span className={styles.rangTexte}>
          <span className={styles.etiquette}>Rang</span>
          <span className={styles.titre}>{actuel.titre}</span>
        </span>
      </div>

      <div className={styles.piste} role="img" aria-label={`Palier ${index + 1} sur ${PALIERS.length}`}>
        <div className={styles.rail}>
          <div className={styles.remplissage} style={{ width: `${remplissage}%` }} />
        </div>
        {PALIERS.map((p, i) => (
          <span
            key={p.titre}
            className={[
              styles.jalon,
              i <= index ? styles.jalonAtteint : '',
              i === index + 1 ? styles.jalonVise : '',
            ].join(' ')}
            style={{ left: `${(i / (PALIERS.length - 1)) * 100}%` }}
            title={`${p.titre} · ${berrys(p.seuil)} (${euros(p.seuil)})`}
          >
            <span className={styles.bulle}>
              {p.titre}
              <span className={styles.bulleMontant}>{berrys(p.seuil)}</span>
            </span>
          </span>
        ))}
      </div>

      <div className={styles.prochain}>
        {suivant ? (
          <>
            <span className={styles.etiquette}>
              Prochain palier · {Math.floor(avancement * 100)} %
            </span>
            <span className={styles.prochainTitre}>
              {suivant.titre} <span className={styles.prochainMontant}>{berrys(suivant.seuil)}</span>
            </span>
            <span className={styles.reste}>encore {euros(reste)} à gagner</span>
          </>
        ) : (
          <>
            <span className={styles.etiquette}>Dernier palier atteint</span>
            <span className={styles.prochainTitre}>Le One Piece est à toi.</span>
          </>
        )}
      </div>
    </footer>
  );
}
