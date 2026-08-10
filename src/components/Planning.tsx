import { useState } from 'react';
import type { BlocPlanning, JourSemaine } from '../types';
import { BlocForm } from './BlocForm';
import styles from './Planning.module.css';

interface PlanningPageProps {
  blocs: BlocPlanning[];
  onAjouter: (bloc: Omit<BlocPlanning, 'id'>) => void;
  onModifier: (id: string, patch: Omit<BlocPlanning, 'id'>) => void;
  onSupprimer: (id: string) => void;
}

const JOURS: { key: JourSemaine; label: string }[] = [
  { key: 'lun', label: 'Lundi' },
  { key: 'mar', label: 'Mardi' },
  { key: 'mer', label: 'Mercredi' },
  { key: 'jeu', label: 'Jeudi' },
  { key: 'ven', label: 'Vendredi' },
  { key: 'sam', label: 'Samedi' },
  { key: 'dim', label: 'Dimanche' },
];

function blocsDuJour(blocs: BlocPlanning[], jour: JourSemaine) {
  return blocs
    .filter((b) => b.jours.includes(jour))
    .slice()
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
}

export function PlanningPage({ blocs, onAjouter, onModifier, onSupprimer }: PlanningPageProps) {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [blocEnEdition, setBlocEnEdition] = useState<BlocPlanning | null>(null);

  function ouvrirAjout() {
    setBlocEnEdition(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(bloc: BlocPlanning) {
    setBlocEnEdition(bloc);
    setFormulaireOuvert(true);
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setBlocEnEdition(null);
  }

  function handleValider(patch: Omit<BlocPlanning, 'id'>) {
    if (blocEnEdition) {
      onModifier(blocEnEdition.id, patch);
    } else {
      onAjouter(patch);
    }
    fermerFormulaire();
  }

  return (
    <section className={styles.page}>
      <div className={styles.entete}>
        <h1 className={styles.titre}>Emploi du temps</h1>
        <button type="button" className={styles.boutonAjouter} onClick={ouvrirAjout}>
          + Ajouter un créneau
        </button>
      </div>

      <div className={styles.grille}>
        {JOURS.map(({ key, label }) => (
          <div key={key} className={styles.colonneJour}>
            <div className={styles.enteteJour}>{label}</div>
            <div className={styles.blocsJour}>
              {blocsDuJour(blocs, key).map((bloc) => (
                <div key={bloc.id} className={styles.bloc}>
                  <div className={styles.blocTitre}>{bloc.titre}</div>
                  <div className={styles.blocHoraire}>
                    {bloc.heureDebut} – {bloc.heureFin}
                  </div>
                  {bloc.questWeight > 0 && (
                    <span className={styles.badge}>quête +{bloc.questWeight}%</span>
                  )}
                  <div className={styles.blocActions}>
                    <button
                      type="button"
                      className={styles.blocBoutonModifier}
                      aria-label="Modifier le créneau"
                      onClick={() => ouvrirEdition(bloc)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.blocBoutonSupprimer}
                      aria-label="Supprimer le créneau"
                      onClick={() => onSupprimer(bloc.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {formulaireOuvert && (
        <BlocForm
          blocInitial={blocEnEdition ?? undefined}
          onValider={handleValider}
          onAnnuler={fermerFormulaire}
        />
      )}
    </section>
  );
}
