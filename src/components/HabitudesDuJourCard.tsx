import type { EtatHabitude, HabitudeDuJour } from '../types';
import panneau from './Panneau.module.css';
import styles from './HabitudesDuJourCard.module.css';

interface HabitudesDuJourCardProps {
  habitudesDuJour: HabitudeDuJour[];
  aujourdhuiMalade: boolean;
  onCocherHabitude: (id: string, etat: EtatHabitude | null) => void;
  onOuvrirHabitudes: () => void;
}

export function HabitudesDuJourCard({
  habitudesDuJour,
  aujourdhuiMalade,
  onCocherHabitude,
  onOuvrirHabitudes,
}: HabitudesDuJourCardProps) {
  const faites = habitudesDuJour.filter((h) => h.etat === 'fait').length;
  const total = habitudesDuJour.length;

  return (
    <section className={panneau.panneau}>
      <div className={panneau.entete}>
        <h2 className={panneau.titre}>Habitudes du jour</h2>
        {total > 0 && (
          <span className={panneau.compteur}>
            {faites} / {total}
          </span>
        )}
      </div>

      {aujourdhuiMalade && total === 0 ? (
        <p className={panneau.vide}>
          Jour de repos : tu es noté malade aujourd'hui. Soigne-toi, capitaine.
        </p>
      ) : total === 0 ? (
        <div className={panneau.vide}>
          <span>Aucune habitude à tenir aujourd'hui.</span>
          <button type="button" className={panneau.boutonVide} onClick={onOuvrirHabitudes}>
            Ajouter une habitude
          </button>
        </div>
      ) : (
        <div className={panneau.corps}>
          {aujourdhuiMalade && (
            <p className={styles.noteMalade}>
              Jour malade : seules les habitudes qui comptent même malade restent à tenir.
            </p>
          )}
          <ul className={panneau.liste}>
            {habitudesDuJour.map((h) => (
              <li
                key={h.id}
                className={[
                  styles.ligne,
                  h.etat === 'fait' ? styles.faite : '',
                  h.etat === 'rate' ? styles.ratee : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  className={styles.case}
                  aria-label={
                    h.etat === 'fait' ? `Décocher « ${h.nom} »` : `Marquer « ${h.nom} » comme faite`
                  }
                  onClick={() => onCocherHabitude(h.id, h.etat === 'fait' ? null : 'fait')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 12.5 4 4 8-9" />
                  </svg>
                </button>
                <span className={styles.nom}>{h.nom}</span>
                {h.cadence === 'hebdomadaire' && (
                  <span className={styles.semaine}>
                    {h.faitsCetteSemaine}/{h.objectifHebdo} sem.
                  </span>
                )}
                <button
                  type="button"
                  className={styles.rater}
                  aria-label={
                    h.etat === 'rate' ? `Annuler l'échec de « ${h.nom} »` : `Marquer « ${h.nom} » comme ratée`
                  }
                  title="Ratée aujourd'hui"
                  onClick={() => onCocherHabitude(h.id, h.etat === 'rate' ? null : 'rate')}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
