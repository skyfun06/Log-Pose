import type { EtatHabitude, HabitudeDuJour } from '../types';
import styles from './HabitudesDuJourCard.module.css';

interface HabitudesDuJourCardProps {
  habitudesDuJour: HabitudeDuJour[];
  onCocherHabitude: (id: string, etat: EtatHabitude | null) => void;
}

function iconeHabitude(etat: EtatHabitude | undefined) {
  if (etat === 'fait') return '✅';
  if (etat === 'rate') return '❌';
  return '⚪';
}

export function HabitudesDuJourCard({
  habitudesDuJour,
  onCocherHabitude,
}: HabitudesDuJourCardProps) {
  const faites = habitudesDuJour.filter((h) => h.etat === 'fait').length;
  const total = habitudesDuJour.length;

  return (
    <section className={styles.carte}>
      <div className={styles.entete}>
        <h2 className={styles.titre}>Habitudes du jour</h2>
        {total > 0 && (
          <span className={styles.compteur}>
            {faites} / {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className={styles.vide}>
          Aucune habitude à suivre aujourd'hui. Ajoute-en dans l'onglet Habitudes, ou demande
          au Capitaine.
        </p>
      ) : (
        <div className={styles.corps}>
          <ul className={styles.liste}>
            {habitudesDuJour.map((h) => {
              const classesTexte = [styles.texte];
              if (h.etat === 'fait') classesTexte.push(styles.texteValide);
              if (h.etat === 'rate') classesTexte.push(styles.texteEchoue);

              return (
                <li key={h.id} className={styles.ligne}>
                  <span className={styles.icone} aria-hidden="true">
                    {iconeHabitude(h.etat)}
                  </span>
                  <span className={classesTexte.join(' ')}>{h.nom}</span>
                  {h.cadence === 'hebdomadaire' && (
                    <span className={styles.badgeHebdo}>
                      {h.faitsCetteSemaine}/{h.objectifHebdo} sem.
                    </span>
                  )}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.boutonValider}
                      aria-label="Marquer l'habitude comme faite"
                      onClick={() => onCocherHabitude(h.id, h.etat === 'fait' ? null : 'fait')}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className={styles.boutonEchouer}
                      aria-label="Marquer l'habitude comme ratée"
                      onClick={() => onCocherHabitude(h.id, h.etat === 'rate' ? null : 'rate')}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
