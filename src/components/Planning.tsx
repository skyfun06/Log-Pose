import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BlocPlanning, JourSemaine } from '../types';
import { BlocForm } from './BlocForm';
import { IconeNature } from './IconeNature';
import {
  LIBELLES_NATURE,
  MOMENTS,
  formatDans,
  formatDuree,
  momentDe,
  natureDe,
} from '../data/creneaux';
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
// En haut, le ruban de la journée (6 h → minuit) pour voir d'un coup d'œil où
// tombent les créneaux ; puis le cap du moment ; puis les créneaux rangés par
// moment (matin, après-midi, soir), avec le temps libre entre eux. Les pastilles
// ❮ ❯ (ou un glissement du doigt) changent de jour.
// ============================================================================

// Temps libre à partir duquel on l'affiche entre deux créneaux.
const SEUIL_TEMPS_LIBRE = 30;

type Entree =
  | { type: 'bloc'; bloc: BlocPlanning; debut: number; fin: number }
  | { type: 'libre'; debut: number; fin: number }
  | { type: 'maintenant'; debut: number };

function RubanJournee({
  blocsJour,
  minutesActuelles,
  estAujourdhui,
}: {
  blocsJour: { bloc: BlocPlanning; debut: number; fin: number }[];
  minutesActuelles: number;
  estAujourdhui: boolean;
}) {
  const debutRuban = Math.min(6 * 60, ...blocsJour.map((b) => Math.floor(b.debut / 60) * 60));
  const finRuban = Math.max(24 * 60, ...blocsJour.map((b) => Math.ceil(b.fin / 60) * 60));
  const etendue = finRuban - debutRuban;
  const pct = (m: number) => `${((m - debutRuban) / etendue) * 100}%`;
  const reperes: number[] = [];
  for (let h = Math.ceil(debutRuban / 180) * 3; h * 60 <= finRuban; h += 3) reperes.push(h);

  return (
    <div className={styles.ruban} aria-hidden="true">
      <div className={styles.rubanPiste}>
        {MOMENTS.map((m, i) => {
          const de = Math.max(debutRuban, m.debut);
          const a = Math.min(finRuban, MOMENTS[i + 1]?.debut ?? finRuban);
          if (a <= de) return null;
          return (
            <span
              key={m.cle}
              className={`${styles.rubanMoment} ${styles[`rubanMoment_${m.cle}`]}`}
              style={{ left: pct(de), width: `${((a - de) / etendue) * 100}%` }}
            />
          );
        })}
        {blocsJour.map(({ bloc, debut, fin }) => (
          <span
            key={bloc.id}
            className={`${styles.rubanBloc} ${styles[`nature_${natureDe(bloc.titre)}`]} ${
              estAujourdhui && fin <= minutesActuelles ? styles.rubanBlocPasse : ''
            }`}
            style={{ left: pct(debut), width: `max(4px, ${((fin - debut) / etendue) * 100}%)` }}
            title={`${bloc.heureDebut} – ${bloc.heureFin} · ${bloc.titre}`}
          />
        ))}
        {estAujourdhui && minutesActuelles >= debutRuban && minutesActuelles <= finRuban && (
          <span className={styles.rubanMaintenant} style={{ left: pct(minutesActuelles) }} />
        )}
      </div>
      <div className={styles.rubanReperes}>
        {reperes.map((h) => (
          <span key={h} style={{ left: pct(h * 60) }}>
            {h === 24 ? '0h' : `${h}h`}
          </span>
        ))}
      </div>
    </div>
  );
}

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
  const prochain = estAujourdhui ? blocsJour.find((b) => b.debut > minutesActuelles) : undefined;
  const totalPlanifie = blocsJour.reduce((t, b) => t + (b.fin - b.debut), 0);

  const dateLongue = maintenant.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const heureCourante = `${String(maintenant.getHours()).padStart(2, '0')}:${String(
    maintenant.getMinutes(),
  ).padStart(2, '0')}`;

  // Fil de la journée : créneaux, temps libres et repère « maintenant ».
  const entrees: Entree[] = [];
  let finPrecedente: number | null = null;
  let maintenantPlace = !estAujourdhui;
  for (const b of blocsJour) {
    if (finPrecedente !== null && b.debut - finPrecedente >= SEUIL_TEMPS_LIBRE) {
      entrees.push({ type: 'libre', debut: finPrecedente, fin: b.debut });
    }
    if (!maintenantPlace && minutesActuelles < b.debut) {
      entrees.push({ type: 'maintenant', debut: minutesActuelles });
      maintenantPlace = true;
    }
    entrees.push({ type: 'bloc', ...b });
    if (!maintenantPlace && minutesActuelles < b.fin) maintenantPlace = true; // en cours
    finPrecedente = Math.max(finPrecedente ?? 0, b.fin);
  }
  if (!maintenantPlace && blocsJour.length > 0) {
    entrees.push({ type: 'maintenant', debut: minutesActuelles });
  }

  // Chaque moment de la journée qui a au moins un créneau devient une section.
  const sections = MOMENTS.map((m) => ({
    ...m,
    entrees: entrees.filter((e) => momentDe(e.debut) === m.cle),
  })).filter((s) => s.entrees.some((e) => e.type === 'bloc'));

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

      <div key={jourVu} className={direction === 1 ? styles.glisseDroite : styles.glisseGauche}>
        {blocsJour.length === 0 ? (
          <div className={styles.jourVide}>
            <div className={styles.jourVideIcone} aria-hidden="true">
              ⛵
            </div>
            <p className={styles.jourVideTitre}>Rien à l'horizon</p>
            <p className={styles.jourVideTexte}>
              Ajoute un créneau avec le bouton « + Ajouter un créneau », ou demande au Capitaine de
              te caler la journée.
            </p>
          </div>
        ) : (
          <>
            <RubanJournee
              blocsJour={blocsJour}
              minutesActuelles={minutesActuelles}
              estAujourdhui={estAujourdhui}
            />

            {/* Le cap du moment : ce qui compte maintenant, en grand. */}
            <div className={styles.focus}>
              {enCours ? (
                <>
                  <span className={styles.focusEtiquette}>En ce moment</span>
                  <div className={styles.focusLigne}>
                    <IconeNature nature={natureDe(enCours.bloc.titre)} className={styles.focusIcone} />
                    <span className={styles.focusTitre}>{enCours.bloc.titre}</span>
                  </div>
                  <div className={styles.focusJauge}>
                    <div
                      className={styles.focusJaugeRemplie}
                      style={{
                        width: `${((minutesActuelles - enCours.debut) / (enCours.fin - enCours.debut)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className={styles.focusDetail}>
                    jusqu'à {enCours.bloc.heureFin} · encore {formatDuree(enCours.fin - minutesActuelles)}
                  </span>
                </>
              ) : prochain ? (
                <>
                  <span className={styles.focusEtiquette}>
                    Prochain cap · {formatDans(prochain.debut - minutesActuelles)}
                  </span>
                  <div className={styles.focusLigne}>
                    <IconeNature nature={natureDe(prochain.bloc.titre)} className={styles.focusIcone} />
                    <span className={styles.focusTitre}>{prochain.bloc.titre}</span>
                  </div>
                  <span className={styles.focusDetail}>
                    à {prochain.bloc.heureDebut}, pendant {formatDuree(prochain.fin - prochain.debut)}
                  </span>
                </>
              ) : estAujourdhui ? (
                <>
                  <span className={styles.focusEtiquette}>Journée bouclée</span>
                  <span className={styles.focusTitre}>Tous les caps du jour sont derrière toi.</span>
                </>
              ) : (
                <>
                  <span className={styles.focusEtiquette}>{labelJourVu}</span>
                  <span className={styles.focusTitre}>
                    {blocsJour.length} créneau{blocsJour.length > 1 ? 'x' : ''} · {formatDuree(totalPlanifie)}{' '}
                    planifiées
                  </span>
                  <span className={styles.focusDetail}>
                    de {blocsJour[0].bloc.heureDebut} à{' '}
                    {blocsJour.reduce((m, b) => (b.fin > m.fin ? b : m), blocsJour[0]).bloc.heureFin}
                  </span>
                </>
              )}
            </div>

            {sections.map((section) => {
              const blocsSection = section.entrees.filter((e) => e.type === 'bloc');
              const duree = blocsSection.reduce((t, e) => t + (e.type === 'bloc' ? e.fin - e.debut : 0), 0);
              return (
                <section key={section.cle} className={styles.moment}>
                  <h3 className={styles.momentTitre}>
                    <span className={`${styles.momentPastille} ${styles[`momentPastille_${section.cle}`]}`} />
                    {section.label}
                    <span className={styles.momentResume}>
                      {blocsSection.length} créneau{blocsSection.length > 1 ? 'x' : ''} · {formatDuree(duree)}
                    </span>
                  </h3>
                  <ol className={styles.fil}>
                    {section.entrees.map((e) => {
                      if (e.type === 'maintenant') {
                        return (
                          <li key="maintenant" className={styles.maintenant} aria-label={`Maintenant, ${heureCourante}`}>
                            <span className={styles.maintenantHeure}>{heureCourante}</span>
                            <span className={styles.maintenantLigne} />
                          </li>
                        );
                      }
                      if (e.type === 'libre') {
                        return (
                          <li key={`libre-${e.debut}`} className={styles.libre}>
                            {formatDuree(e.fin - e.debut)} de temps libre
                          </li>
                        );
                      }
                      const { bloc, debut, fin } = e;
                      const nature = natureDe(bloc.titre);
                      const passe = estAujourdhui && fin <= minutesActuelles;
                      const actif = estAujourdhui && debut <= minutesActuelles && minutesActuelles < fin;
                      return (
                        <li
                          key={bloc.id}
                          className={`${styles.creneau} ${styles[`nature_${nature}`]} ${
                            passe ? styles.creneauPasse : ''
                          } ${actif ? styles.creneauActif : ''} ${bloc.fixe ? styles.creneauFixe : ''}`}
                        >
                          <div className={styles.creneauHeure}>
                            <span className={styles.creneauDebut}>{bloc.heureDebut}</span>
                            <span className={styles.creneauFin}>{bloc.heureFin}</span>
                          </div>
                          <article className={styles.creneauCarte}>
                            <IconeNature nature={nature} className={styles.creneauIcone} />
                            <div className={styles.creneauTexte}>
                              <h4 className={styles.creneauTitre}>{bloc.titre}</h4>
                              <div className={styles.creneauMeta}>
                                <span>{LIBELLES_NATURE[nature]}</span>
                                <span>{formatDuree(fin - debut)}</span>
                                {bloc.questWeight > 0 && (
                                  <span className={styles.badgeQuete}>quête +{bloc.questWeight} %</span>
                                )}
                                {actif && <span className={styles.badgeEnCours}>En cours</span>}
                                {bloc.fixe && <span className={styles.badgeFixe}>Horaire fixe</span>}
                              </div>
                            </div>
                            {!bloc.fixe && (
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
                            )}
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </>
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
  // Plage horaire affichée : resserrée sur les créneaux (une heure de marge de
  // chaque côté), pour ne pas faire défiler des heures vides. Sans créneau :
  // une journée type.
  let heureMin = HEURE_MIN_DEFAUT;
  let heureMax = HEURE_MAX_DEFAUT;
  if (blocs.length > 0) {
    heureMin = Math.min(...blocs.map((b) => Math.floor(toMinutes(b.heureDebut) / 60))) - 1;
    heureMax = Math.max(...blocs.map((b) => Math.ceil(toMinutes(b.heureFin) / 60))) + 1;
  }
  heureMin = Math.max(0, heureMin);
  heureMax = Math.min(24, Math.max(heureMax, heureMin + 6));

  const nbHeures = heureMax - heureMin;
  const heures = Array.from({ length: nbHeures + 1 }, (_, i) => heureMin + i);
  const debutPlage = heureMin * 60;

  const styleGrille = {
    '--heures': nbHeures,
    '--hauteur-heure': '54px',
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
              const minuscule = fin - debut <= 30;
              const passe = key === jourActuel && fin <= minutesActuelles;
              const nature = natureDe(bloc.titre);
              return (
                <article
                  key={bloc.id}
                  className={`${styles.bloc} ${styles[`nature_${nature}`]} ${
                    compact ? styles.blocCompact : ''
                  } ${minuscule ? styles.blocMinuscule : ''} ${passe ? styles.blocPasse : ''} ${
                    bloc.fixe ? styles.blocFixe : ''
                  }`}
                  style={styleBloc}
                  title={`${bloc.heureDebut} – ${bloc.heureFin} · ${bloc.titre}`}
                >
                  <div className={styles.blocInfos}>
                    <div className={styles.blocTitre}>
                      <IconeNature nature={nature} className={styles.blocIcone} />
                      {bloc.titre}
                    </div>
                    {!compact && (
                      <div className={styles.blocHoraire}>
                        {bloc.heureDebut} – {bloc.heureFin}
                      </div>
                    )}
                    {bloc.questWeight > 0 && fin - debut >= 90 && (
                      <span className={styles.badge}>quête +{bloc.questWeight}%</span>
                    )}
                  </div>
                  {!bloc.fixe && (
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
                  )}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
