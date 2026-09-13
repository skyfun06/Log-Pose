import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BlocPlanning, JourSemaine } from '../types';
import { BlocForm } from './BlocForm';
import styles from './Planning.module.css';

interface PlanningPageProps {
  blocs: BlocPlanning[];
  onAjouter: (bloc: Omit<BlocPlanning, 'id'>) => void;
  onModifier: (id: string, patch: Omit<BlocPlanning, 'id'>) => void;
  onSupprimer: (id: string, jour: JourSemaine) => void;
}

const JOURS: { key: JourSemaine; label: string; court: string }[] = [
  { key: 'lun', label: 'Lundi', court: 'Lun' },
  { key: 'mar', label: 'Mardi', court: 'Mar' },
  { key: 'mer', label: 'Mercredi', court: 'Mer' },
  { key: 'jeu', label: 'Jeudi', court: 'Jeu' },
  { key: 'ven', label: 'Vendredi', court: 'Ven' },
  { key: 'sam', label: 'Samedi', court: 'Sam' },
  { key: 'dim', label: 'Dimanche', court: 'Dim' },
];

const HEURE_MIN_DEFAUT = 7;
const HEURE_MAX_DEFAUT = 22;

function toMinutes(h: string): number {
  const [heures, minutes] = h.split(':').map(Number);
  return heures * 60 + minutes;
}

interface BlocPositionne {
  bloc: BlocPlanning;
  debut: number;
  fin: number;
  colonne: number;
  colonnes: number;
}

/**
 * Positionne les créneaux d'un jour en colonnes côte à côte quand ils se
 * chevauchent (algorithme de partition d'intervalles par grappe).
 */
function positionnerJour(blocs: BlocPlanning[], jour: JourSemaine): BlocPositionne[] {
  const items = blocs
    .filter((b) => b.jours.includes(jour))
    .map((bloc) => ({ bloc, debut: toMinutes(bloc.heureDebut), fin: toMinutes(bloc.heureFin) }))
    .sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  const resultat: BlocPositionne[] = [];
  let grappe: typeof items = [];
  let finGrappe = -1;

  const vider = () => {
    const finsColonnes: number[] = [];
    const affectations: { item: (typeof items)[number]; colonne: number }[] = [];

    for (const item of grappe) {
      let place = false;
      for (let c = 0; c < finsColonnes.length; c++) {
        if (finsColonnes[c] <= item.debut) {
          finsColonnes[c] = item.fin;
          affectations.push({ item, colonne: c });
          place = true;
          break;
        }
      }
      if (!place) {
        finsColonnes.push(item.fin);
        affectations.push({ item, colonne: finsColonnes.length - 1 });
      }
    }

    const total = finsColonnes.length;
    for (const a of affectations) {
      resultat.push({ ...a.item, colonne: a.colonne, colonnes: total });
    }
    grappe = [];
    finGrappe = -1;
  };

  for (const item of items) {
    if (grappe.length && item.debut >= finGrappe) vider();
    grappe.push(item);
    finGrappe = Math.max(finGrappe, item.fin);
  }
  vider();

  return resultat;
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

  // Plage horaire affichée : par défaut 7h–22h, élargie pour englober tous les créneaux.
  let heureMin = HEURE_MIN_DEFAUT;
  let heureMax = HEURE_MAX_DEFAUT;
  for (const bloc of blocs) {
    heureMin = Math.min(heureMin, Math.floor(toMinutes(bloc.heureDebut) / 60));
    heureMax = Math.max(heureMax, Math.ceil(toMinutes(bloc.heureFin) / 60));
  }
  heureMin = Math.max(0, heureMin);
  heureMax = Math.min(24, heureMax);

  const nbHeures = heureMax - heureMin;
  const heures = Array.from({ length: nbHeures + 1 }, (_, i) => heureMin + i);
  const debutPlage = heureMin * 60;

  const styleGrille = {
    '--heures': nbHeures,
    '--hauteur-heure': '60px',
  } as CSSProperties;

  return (
    <section className={styles.page}>
      <div className={styles.calendrier}>
        <div className={styles.entete}>
          <h1 className={styles.titre}>Emploi du temps</h1>
          <button type="button" className={styles.boutonAjouter} onClick={ouvrirAjout}>
            + Ajouter un créneau
          </button>
        </div>

        <div className={styles.grille} style={styleGrille}>
          <div className={styles.coin} />
          {JOURS.map(({ key, label, court }) => (
            <div key={key} className={styles.enteteJour}>
              <span className={styles.jourLong}>{label}</span>
              <span className={styles.jourCourt}>{court}</span>
            </div>
          ))}

          <div className={styles.axe}>
            {heures.map((h) => (
              <span
                key={h}
                className={styles.labelHeure}
                style={{
                  top: `calc(var(--decalage-haut) + ${h - heureMin} * var(--hauteur-heure))`,
                }}
              >
                {String(h).padStart(2, '0')}h
              </span>
            ))}
          </div>

          {JOURS.map(({ key }) => (
            <div key={key} className={styles.colonneJour}>
              {positionnerJour(blocs, key).map(({ bloc, debut, fin, colonne, colonnes }) => {
                const styleBloc = {
                  top: `calc(var(--decalage-haut) + ${debut - debutPlage} / 60 * var(--hauteur-heure))`,
                  height: `calc(${fin - debut} / 60 * var(--hauteur-heure) - 3px)`,
                  left: `calc(${(colonne / colonnes) * 100}% + 2px)`,
                  width: `calc(${(1 / colonnes) * 100}% - 4px)`,
                } as CSSProperties;
                const compact = fin - debut <= 45;
                return (
                  <article key={bloc.id} className={styles.bloc} style={styleBloc}>
                    <div className={styles.blocInfos}>
                      <div className={styles.blocTitre}>{bloc.titre}</div>
                      {!compact && (
                        <div className={styles.blocHoraire}>
                          {bloc.heureDebut} – {bloc.heureFin}
                        </div>
                      )}
                      {bloc.questWeight > 0 && !compact && (
                        <span className={styles.badge}>quête +{bloc.questWeight}%</span>
                      )}
                    </div>
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
                        onClick={() => onSupprimer(bloc.id, key)}
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
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
