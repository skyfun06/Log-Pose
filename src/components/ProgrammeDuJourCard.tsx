import { useEffect, useState } from 'react';
import { enMinutes, formatDans, formatDuree, natureDe } from '../data/creneaux';
import type { BlocPlanning, JourSemaine } from '../types';
import { IconeNature } from './IconeNature';
import panneau from './Panneau.module.css';
import styles from './ProgrammeDuJourCard.module.css';

interface ProgrammeDuJourCardProps {
  blocs: BlocPlanning[];
  onOuvrirPlanning: () => void;
}

const JOUR_INDEX: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function minutesDuJour(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function blocsDu(blocs: BlocPlanning[], jour: JourSemaine) {
  return blocs
    .filter((b) => b.jours.includes(jour))
    .map((bloc) => ({ bloc, debut: enMinutes(bloc.heureDebut), fin: enMinutes(bloc.heureFin) }))
    .sort((a, b) => a.debut - b.debut);
}

// Le programme du jour, centré sur ce qui reste : le créneau en cours (ou le
// prochain) en tête, les suivants dessous, les créneaux passés résumés en une ligne.
export function ProgrammeDuJourCard({ blocs, onOuvrirPlanning }: ProgrammeDuJourCardProps) {
  const [maintenant, setMaintenant] = useState(minutesDuJour);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(minutesDuJour()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const indexJour = new Date().getDay();
  const duJour = blocsDu(blocs, JOUR_INDEX[indexJour]);
  const passes = duJour.filter((b) => b.fin <= maintenant);
  const restants = duJour.filter((b) => b.fin > maintenant);
  const premierDemain = blocsDu(blocs, JOUR_INDEX[(indexJour + 1) % 7])[0];

  return (
    <section className={panneau.panneau}>
      <div className={panneau.entete}>
        <h2 className={panneau.titre}>Au programme aujourd'hui</h2>
        {duJour.length > 0 && (
          <span className={panneau.compteur}>
            {restants.length === 0 ? 'Journée bouclée' : `${restants.length} à venir`}
          </span>
        )}
      </div>

      {duJour.length === 0 ? (
        <div className={panneau.vide}>
          <span>Rien au programme aujourd'hui.</span>
          <button type="button" className={panneau.boutonVide} onClick={onOuvrirPlanning}>
            Ouvrir l'emploi du temps
          </button>
        </div>
      ) : restants.length === 0 ? (
        <div className={panneau.vide}>
          <span>
            Les {duJour.length} créneaux du jour sont derrière toi. Belle navigation.
          </span>
          {premierDemain && (
            <span className={styles.demain}>
              Demain, premier cap à {premierDemain.bloc.heureDebut} : {premierDemain.bloc.titre}
            </span>
          )}
        </div>
      ) : (
        <div className={panneau.corps}>
          <ol className={panneau.liste}>
            {restants.map(({ bloc, debut, fin }, i) => {
              const nature = natureDe(bloc.titre);
              const enCours = debut <= maintenant;
              const premier = i === 0;
              return (
                <li
                  key={bloc.id}
                  className={`${styles.creneau} ${styles[`nature_${nature}`]} ${
                    premier ? styles.premier : ''
                  } ${enCours ? styles.enCours : ''}`}
                >
                  <span className={styles.heure}>{bloc.heureDebut}</span>
                  <IconeNature nature={nature} className={styles.icone} />
                  <span className={styles.texte}>
                    <span className={styles.titre}>{bloc.titre}</span>
                    {premier && (
                      <span className={styles.detail}>
                        {enCours
                          ? `En cours · encore ${formatDuree(fin - maintenant)}`
                          : `${formatDans(debut - maintenant)} · ${formatDuree(fin - debut)}`}
                      </span>
                    )}
                  </span>
                  {!premier && <span className={styles.duree}>{formatDuree(fin - debut)}</span>}
                  {premier && enCours && (
                    <span
                      className={styles.jauge}
                      style={{ width: `${((maintenant - debut) / (fin - debut)) * 100}%` }}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
          {passes.length > 0 && (
            <p className={styles.passes}>
              ✓ {passes.length} créneau{passes.length > 1 ? 'x' : ''} déjà passé
              {passes.length > 1 ? 's' : ''} aujourd'hui
            </p>
          )}
        </div>
      )}
    </section>
  );
}
