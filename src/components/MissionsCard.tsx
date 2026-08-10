import type { Mission } from '../types';
import styles from './MissionsCard.module.css';

interface MissionsCardProps {
  missions: Mission[];
  onValider: (id: string) => void;
  onEchouer: (id: string) => void;
}

function iconeStatut(statut: Mission['statut']) {
  if (statut === 'done') return '✅';
  if (statut === 'failed') return '❌';
  return '⚪';
}

export function MissionsCard({ missions, onValider, onEchouer }: MissionsCardProps) {
  const total = missions.length;
  const validees = missions.filter((m) => m.statut === 'done').length;

  return (
    <section className={styles.carte}>
      <div className={styles.entete}>
        <h2 className={styles.titre}>Missions du jour</h2>
        <span className={styles.compteur}>
          {validees} / {total}
        </span>
      </div>

      <ul className={styles.liste}>
        {missions.map((mission) => {
          const classesTexte = [styles.texte];
          if (mission.statut === 'done') classesTexte.push(styles.texteValide);
          if (mission.statut === 'failed') classesTexte.push(styles.texteEchoue);

          return (
            <li key={mission.id} className={styles.ligne}>
              <span className={styles.icone} aria-hidden="true">
                {iconeStatut(mission.statut)}
              </span>
              <span className={classesTexte.join(' ')}>{mission.texte}</span>
              {mission.questWeight > 0 && (
                <span className={styles.badge}>quête +{mission.questWeight}%</span>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.boutonValider}
                  aria-label="Valider la mission"
                  disabled={mission.statut === 'done'}
                  onClick={() => onValider(mission.id)}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className={styles.boutonEchouer}
                  aria-label="Échouer la mission"
                  disabled={mission.statut === 'done'}
                  onClick={() => onEchouer(mission.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
