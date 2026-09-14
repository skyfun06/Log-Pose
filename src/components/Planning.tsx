import { Fragment, useEffect, useRef, useState } from 'react';
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

// getDay() renvoie 0 pour dimanche.
const JOUR_INDEX: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

const HEURE_MIN_DEFAUT = 7;
const HEURE_MAX_DEFAUT = 22;

// Vue affichée : « jour » (le cap du jour, lisible en un regard) ou « semaine »
// (la grille complète). Le choix est mémorisé entre deux visites.
type ModeVue = 'jour' | 'semaine';
const CLE_MODE_VUE = 'log-pose-planning-vue';

function toMinutes(h: string): number {
  const [heures, minutes] = h.split(':').map(Number);
  return heures * 60 + minutes;
}

function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
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

  const [mode, setMode] = useState<ModeVue>(() => {
    try {
      return localStorage.getItem(CLE_MODE_VUE) === 'semaine' ? 'semaine' : 'jour';
    } catch {
      return 'jour';
    }
  });

  function choisirMode(m: ModeVue) {
    setMode(m);
    try {
      localStorage.setItem(CLE_MODE_VUE, m);
    } catch {
      /* pas grave */
    }
  }

  // Heure courante, rafraîchie toutes les 30 s : anime le fil rouge « maintenant »
  // et fait vivre la vue du jour (créneau en cours, prochain cap...).
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const jourActuel = JOUR_INDEX[maintenant.getDay()];
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();

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
        <div className={styles.controles}>
          <div className={styles.basculeVue} role="tablist" aria-label="Choix de la vue">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'jour'}
              className={`${styles.basculeBtn} ${mode === 'jour' ? styles.basculeBtnActif : ''}`}
              onClick={() => choisirMode('jour')}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'semaine'}
              className={`${styles.basculeBtn} ${mode === 'semaine' ? styles.basculeBtnActif : ''}`}
              onClick={() => choisirMode('semaine')}
            >
              Semaine
            </button>
          </div>
          <button type="button" className={styles.boutonAjouter} onClick={ouvrirAjout}>
            + Ajouter un créneau
          </button>
        </div>
      </div>

      {mode === 'jour' ? (
        <VueJour
          blocs={blocs}
          jourActuel={jourActuel}
          minutesActuelles={minutesActuelles}
          maintenant={maintenant}
          onEditer={ouvrirEdition}
          onSupprimer={onSupprimer}
        />
      ) : (
        <VueSemaine
          blocs={blocs}
          jourActuel={jourActuel}
          minutesActuelles={minutesActuelles}
          onEditer={ouvrirEdition}
          onSupprimer={onSupprimer}
        />
      )}

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

// ============================================================================
// Vue « Aujourd'hui » : la feuille de route d'un jour, sur parchemin.
// Par défaut le jour réel, mais les pastilles Lun → Dim permettent de mettre
// le cap sur n'importe quel jour de la semaine. Les effets « temps réel »
// (caps estompés, cap en cours, fil rouge) ne valent que pour le jour réel.
// ============================================================================
function VueJour({
  blocs,
  jourActuel,
  minutesActuelles,
  maintenant,
  onEditer,
  onSupprimer,
}: {
  blocs: BlocPlanning[];
  jourActuel: JourSemaine;
  minutesActuelles: number;
  maintenant: Date;
  onEditer: (bloc: BlocPlanning) => void;
  onSupprimer: (id: string, jour: JourSemaine) => void;
}) {
  const [jourVu, setJourVu] = useState<JourSemaine>(jourActuel);
  // Sens du dernier changement de jour : anime le glissement du contenu.
  const [direction, setDirection] = useState<1 | -1>(1);
  const estAujourdhui = jourVu === jourActuel;
  const labelJourVu = JOURS.find((j) => j.key === jourVu)?.label ?? jourVu;

  const ORDRE = JOURS.map((j) => j.key);

  function decalerJour(delta: 1 | -1) {
    setDirection(delta);
    setJourVu((prev) => ORDRE[(ORDRE.indexOf(prev) + delta + 7) % 7]);
  }

  function revenirAujourdhui() {
    setDirection(1);
    setJourVu(jourActuel);
  }

  // Swipe tactile : un glissement horizontal franc change de jour.
  const toucheDepart = useRef<{ x: number; y: number } | null>(null);

  function surToucheDebut(e: React.TouchEvent) {
    toucheDepart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function surToucheFin(e: React.TouchEvent) {
    const depart = toucheDepart.current;
    toucheDepart.current = null;
    if (!depart) return;
    const dx = e.changedTouches[0].clientX - depart.x;
    const dy = e.changedTouches[0].clientY - depart.y;
    // Seuil + geste bien horizontal (pour ne pas gêner le scroll vertical).
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      decalerJour(dx < 0 ? 1 : -1);
    }
  }

  const blocsJour = blocs
    .filter((b) => b.jours.includes(jourVu))
    .map((bloc) => ({ bloc, debut: toMinutes(bloc.heureDebut), fin: toMinutes(bloc.heureFin) }))
    .sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  const enCours = estAujourdhui
    ? blocsJour.find((b) => b.debut <= minutesActuelles && minutesActuelles < b.fin)
    : undefined;
  const prochain = estAujourdhui
    ? blocsJour.find((b) => b.debut > minutesActuelles)
    : undefined;
  const restants = blocsJour.filter((b) => b.fin > minutesActuelles).length;

  const dateLongue = maintenant.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Position du fil rouge dans la liste : après tous les caps déjà commencés.
  const indexMaintenant = blocsJour.filter((b) => b.debut <= minutesActuelles).length;

  const heureCourante = `${String(maintenant.getHours()).padStart(2, '0')}:${String(
    maintenant.getMinutes(),
  ).padStart(2, '0')}`;

  // Pastille forte + phrase clé, adaptées selon qu'on regarde le jour réel ou
  // un autre jour de la semaine.
  let chipForte: string;
  let phraseCap: string;
  if (estAujourdhui) {
    chipForte =
      restants > 0 ? `${restants} cap${restants > 1 ? 's' : ''} à tenir` : 'journée bouclée';
    if (enCours) {
      phraseCap = `⚓ En ce moment : ${enCours.bloc.titre}, jusqu'à ${enCours.bloc.heureFin}.`;
    } else if (prochain) {
      phraseCap = `Prochain cap à ${prochain.bloc.heureDebut} — ${prochain.bloc.titre}.`;
    } else if (blocsJour.length > 0) {
      phraseCap = 'Tous les caps du jour sont derrière toi. Belle navigation.';
    } else {
      phraseCap = 'Mer calme : aucun cap prévu aujourd’hui.';
    }
  } else {
    const n = blocsJour.length;
    chipForte = n > 0 ? `${n} cap${n > 1 ? 's' : ''} prévu${n > 1 ? 's' : ''}` : 'journée libre';
    if (n > 0) {
      const finMax = blocsJour.reduce((max, b) => (b.fin > max.fin ? b : max), blocsJour[0]);
      phraseCap = `De ${blocsJour[0].bloc.heureDebut} à ${finMax.bloc.heureFin}.`;
    } else {
      phraseCap = 'Mer calme : rien de prévu ce jour-là.';
    }
  }

  return (
    <div className={styles.jourVue} onTouchStart={surToucheDebut} onTouchEnd={surToucheFin}>
      <header className={styles.jourEntete}>
        <button
          type="button"
          className={styles.fleche}
          aria-label="Jour précédent"
          onClick={() => decalerJour(-1)}
        >
          ❮
        </button>
        <div className={styles.jourTitreBloc}>
          <div className={styles.jourSurtitre}>{estAujourdhui ? 'Cap du jour' : 'Cap sur'}</div>
          <h2 className={styles.jourDate}>{estAujourdhui ? dateLongue : labelJourVu}</h2>
          {!estAujourdhui && (
            <button type="button" className={styles.retourAujourdhui} onClick={revenirAujourdhui}>
              ⌖ Revenir à aujourd'hui
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.fleche}
          aria-label="Jour suivant"
          onClick={() => decalerJour(1)}
        >
          ❯
        </button>
      </header>

      <div className={styles.jourChips}>
        <span className={`${styles.chip} ${styles.chipFort}`}>{chipForte}</span>
        <span className={styles.chip}>{phraseCap}</span>
      </div>

      <div
        key={jourVu}
        className={direction === 1 ? styles.glisseDroite : styles.glisseGauche}
      >
      {blocsJour.length === 0 ? (
        <div className={styles.jourVide}>
          <div className={styles.jourVideIcone} aria-hidden="true">
            ⛵
          </div>
          <p className={styles.jourVideTitre}>Rien à l'horizon</p>
          <p className={styles.jourVideTexte}>
            Ajoute un créneau avec le bouton ci-dessus, ou demande au Capitaine de te caler la
            journée.
          </p>
        </div>
      ) : (
        <ol className={styles.route}>
          {blocsJour.map(({ bloc, debut, fin }, i) => {
            const passe = estAujourdhui && fin <= minutesActuelles;
            const actif = estAujourdhui && debut <= minutesActuelles && minutesActuelles < fin;
            const progression = actif
              ? Math.round(((minutesActuelles - debut) / (fin - debut)) * 100)
              : 0;
            return (
              <Fragment key={bloc.id}>
                {estAujourdhui && i === indexMaintenant && (
                  <li className={styles.filMaintenant} aria-hidden="true">
                    <span className={styles.filHeure}>{heureCourante}</span>
                    <span className={styles.filLigne} />
                  </li>
                )}
                <li
                  className={`${styles.cap} ${passe ? styles.capPasse : ''} ${
                    actif ? styles.capEnCours : ''
                  }`}
                >
                  <div className={styles.capHeure}>
                    <span className={styles.capHeureDebut}>{bloc.heureDebut}</span>
                    <span className={styles.capDuree}>{formatDuree(fin - debut)}</span>
                  </div>
                  <article className={`${styles.capCarte} ${bloc.questWeight > 0 ? styles.capQuete : ''}`}>
                    <div className={styles.capLigneTitre}>
                      <h3 className={styles.capTitre}>{bloc.titre}</h3>
                      {actif && <span className={styles.badgeEnCours}>En cours</span>}
                      <div className={styles.capActions}>
                        <button
                          type="button"
                          className={styles.capBoutonModifier}
                          aria-label="Modifier le créneau"
                          onClick={() => onEditer(bloc)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className={styles.capBoutonSupprimer}
                          aria-label="Retirer ce créneau de ce jour"
                          title="Retirer ce créneau de ce jour"
                          onClick={() => onSupprimer(bloc.id, jourVu)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className={styles.capMeta}>
                      {bloc.heureDebut} – {bloc.heureFin}
                      {bloc.questWeight > 0 && (
                        <span className={styles.badgeQuete}>quête +{bloc.questWeight}%</span>
                      )}
                    </div>
                    {actif && (
                      <div
                        className={styles.progression}
                        role="progressbar"
                        aria-valuenow={progression}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={styles.progressionRemplie}
                          style={{ width: `${progression}%` }}
                        />
                      </div>
                    )}
                  </article>
                </li>
              </Fragment>
            );
          })}
          {estAujourdhui && indexMaintenant === blocsJour.length && (
            <li className={styles.filMaintenant} aria-hidden="true">
              <span className={styles.filHeure}>{heureCourante}</span>
              <span className={styles.filLigne} />
            </li>
          )}
        </ol>
      )}
      </div>
    </div>
  );
}

// ============================================================================
// Vue « Semaine » : la grille complète. La colonne d'aujourd'hui est surlignée
// et le fil rouge « maintenant » y marque l'heure courante.
// ============================================================================
function VueSemaine({
  blocs,
  jourActuel,
  minutesActuelles,
  onEditer,
  onSupprimer,
}: {
  blocs: BlocPlanning[];
  jourActuel: JourSemaine;
  minutesActuelles: number;
  onEditer: (bloc: BlocPlanning) => void;
  onSupprimer: (id: string, jour: JourSemaine) => void;
}) {
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

  const filVisible = minutesActuelles >= debutPlage && minutesActuelles <= heureMax * 60;

  return (
    <div className={styles.calendrier}>
      <div className={styles.grille} style={styleGrille}>
        <div className={styles.coin} />
        {JOURS.map(({ key, label, court }) => (
          <div
            key={key}
            className={`${styles.enteteJour} ${key === jourActuel ? styles.enteteAujourdhui : ''}`}
          >
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
          <div
            key={key}
            className={`${styles.colonneJour} ${key === jourActuel ? styles.colonneAujourdhui : ''}`}
          >
            {key === jourActuel && filVisible && (
              <div
                className={styles.ligneMaintenant}
                style={{
                  top: `calc(var(--decalage-haut) + ${minutesActuelles - debutPlage} / 60 * var(--hauteur-heure))`,
                }}
                aria-hidden="true"
              />
            )}
            {positionnerJour(blocs, key).map(({ bloc, debut, fin, colonne, colonnes }) => {
              const styleBloc = {
                top: `calc(var(--decalage-haut) + ${debut - debutPlage} / 60 * var(--hauteur-heure))`,
                height: `calc(${fin - debut} / 60 * var(--hauteur-heure) - 3px)`,
                left: `calc(${(colonne / colonnes) * 100}% + 2px)`,
                width: `calc(${(1 / colonnes) * 100}% - 4px)`,
              } as CSSProperties;
              const compact = fin - debut <= 45;
              const passe = key === jourActuel && fin <= minutesActuelles;
              return (
                <article
                  key={bloc.id}
                  className={`${styles.bloc} ${bloc.questWeight > 0 ? styles.blocQuete : ''} ${
                    passe ? styles.blocPasse : ''
                  }`}
                  style={styleBloc}
                >
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
                      onClick={() => onEditer(bloc)}
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
  );
}
