import { useState } from 'react';
import type { CadenceHabitude, EtatHabitude, Habitude, MarquesHabitudes } from '../types';
import { HabitudeForm } from './HabitudeForm';
import styles from './Habitudes.module.css';

interface HabitudesPageProps {
  quotidiennes: Habitude[];
  hebdomadaires: Habitude[];
  marques: MarquesHabitudes;
  onAjouter: (h: { nom: string; cadence: CadenceHabitude; objectifHebdo: number; icone?: string }) => void;
  onModifier: (id: string, patch: Partial<Omit<Habitude, 'id'>>) => void;
  onSupprimer: (id: string) => void;
  onMarquer: (id: string, dateISO: string, etat: EtatHabitude | null) => void;
}

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const LETTRES_JOUR = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // getDay() : 0 = dimanche

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function joursDansMois(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

// Lundi de la semaine (ISO) contenant `d`, en date ISO « YYYY-MM-DD ».
function lundiDeLaSemaine(d: Date): string {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = (copie.getDay() + 6) % 7; // 0 = lundi
  copie.setDate(copie.getDate() - jour);
  return dateISO(copie.getFullYear(), copie.getMonth(), copie.getDate());
}

function dimancheDeLaSemaine(d: Date): string {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = (copie.getDay() + 6) % 7;
  copie.setDate(copie.getDate() + (6 - jour));
  return dateISO(copie.getFullYear(), copie.getMonth(), copie.getDate());
}

// État suivant dans le cycle neutre → fait → raté → neutre.
function etatSuivant(actuel: EtatHabitude | undefined): EtatHabitude | null {
  if (actuel === undefined) return 'fait';
  if (actuel === 'fait') return 'rate';
  return null;
}

interface StatsHabitude {
  faits: number;
  rates: number;
  consideres: number; // jours (ou occurrences) pris en compte pour le taux
  taux: number; // %
  streak: number; // série en cours (jours faits consécutifs jusqu'à aujourd'hui)
  cetteSemaine: number; // faits dans la semaine en cours (hebdo)
}

export function HabitudesPage({
  quotidiennes,
  hebdomadaires,
  marques,
  onAjouter,
  onModifier,
  onSupprimer,
  onMarquer,
}: HabitudesPageProps) {
  const aujourdhui = new Date();
  const [annee, setAnnee] = useState(aujourdhui.getFullYear());
  const [mois, setMois] = useState(aujourdhui.getMonth());

  const [formOuvert, setFormOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Habitude | null>(null);
  const [cadenceVue, setCadenceVue] = useState<CadenceHabitude>('quotidienne');

  const nbJours = joursDansMois(annee, mois);
  const jours = Array.from({ length: nbJours }, (_, i) => i + 1);
  const estMoisCourant =
    annee === aujourdhui.getFullYear() && mois === aujourdhui.getMonth();
  const jourAujourdhui = aujourdhui.getDate();
  const isoAujourdhui = dateISO(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());

  // Nombre de jours « écoulés » du mois affiché (pour un taux honnête) :
  // le mois entier si passé, jusqu'à aujourd'hui si mois courant, 0 si futur.
  const moisEstPasse =
    annee < aujourdhui.getFullYear() ||
    (annee === aujourdhui.getFullYear() && mois < aujourdhui.getMonth());
  const moisEstFutur =
    annee > aujourdhui.getFullYear() ||
    (annee === aujourdhui.getFullYear() && mois > aujourdhui.getMonth());
  const joursEcoules = moisEstPasse ? nbJours : moisEstFutur ? 0 : jourAujourdhui;

  const lundi = lundiDeLaSemaine(aujourdhui);
  const dimanche = dimancheDeLaSemaine(aujourdhui);

  function changerMois(delta: number) {
    const d = new Date(annee, mois + delta, 1);
    setAnnee(d.getFullYear());
    setMois(d.getMonth());
  }

  function revenirMoisCourant() {
    setAnnee(aujourdhui.getFullYear());
    setMois(aujourdhui.getMonth());
  }

  function calculerStats(h: Habitude): StatsHabitude {
    const parDate = marques[h.id] ?? {};
    let faits = 0;
    let rates = 0;
    for (let d = 1; d <= nbJours; d++) {
      const etat = parDate[dateISO(annee, mois, d)];
      if (etat === 'fait') faits++;
      else if (etat === 'rate') rates++;
    }

    // Série en cours : jours faits consécutifs en remontant depuis aujourd'hui.
    let streak = 0;
    if (h.cadence === 'quotidienne') {
      const curseur = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
      for (;;) {
        const iso = dateISO(curseur.getFullYear(), curseur.getMonth(), curseur.getDate());
        if (parDate[iso] === 'fait') {
          streak++;
          curseur.setDate(curseur.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Faits dans la semaine en cours (habitudes hebdomadaires).
    let cetteSemaine = 0;
    for (const [iso, etat] of Object.entries(parDate)) {
      if (etat === 'fait' && iso >= lundi && iso <= dimanche) cetteSemaine++;
    }

    let consideres: number;
    let taux: number;
    if (h.cadence === 'quotidienne') {
      consideres = joursEcoules;
      taux = consideres > 0 ? Math.round((faits / consideres) * 100) : 0;
    } else {
      // Objectif attendu ≈ objectif hebdo × nombre de semaines écoulées du mois.
      const semaines = Math.max(1, Math.round(joursEcoules / 7));
      const attendu = h.objectifHebdo * semaines;
      consideres = attendu;
      taux = attendu > 0 ? Math.min(100, Math.round((faits / attendu) * 100)) : 0;
    }

    return { faits, rates, consideres, taux, streak, cetteSemaine };
  }

  function ouvrirAjout() {
    setEnEdition(null);
    setFormOuvert(true);
  }

  function ouvrirEdition(h: Habitude) {
    setEnEdition(h);
    setFormOuvert(true);
  }

  function handleValider(data: {
    nom: string;
    cadence: CadenceHabitude;
    objectifHebdo: number;
  }) {
    if (enEdition) onModifier(enEdition.id, data);
    else onAjouter(data);
    setFormOuvert(false);
    setEnEdition(null);
  }

  const total = quotidiennes.length + hebdomadaires.length;

  return (
    <section className={styles.page}>
      <div className={styles.entete}>
        <h1 className={styles.titre}>Habitudes</h1>
        <div className={styles.controles}>
          <div className={styles.navMois}>
            <button
              type="button"
              className={styles.fleche}
              aria-label="Mois précédent"
              onClick={() => changerMois(-1)}
            >
              ❮
            </button>
            <button
              type="button"
              className={styles.moisLabel}
              onClick={revenirMoisCourant}
              title="Revenir au mois courant"
            >
              {MOIS[mois]} {annee}
            </button>
            <button
              type="button"
              className={styles.fleche}
              aria-label="Mois suivant"
              onClick={() => changerMois(1)}
            >
              ❯
            </button>
          </div>
          <div className={styles.basculeVue} role="tablist" aria-label="Type d'habitudes">
            <button
              type="button"
              role="tab"
              aria-selected={cadenceVue === 'quotidienne'}
              className={`${styles.basculeBtn} ${cadenceVue === 'quotidienne' ? styles.basculeBtnActif : ''}`}
              onClick={() => setCadenceVue('quotidienne')}
            >
              Quotidiennes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cadenceVue === 'hebdomadaire'}
              className={`${styles.basculeBtn} ${cadenceVue === 'hebdomadaire' ? styles.basculeBtnActif : ''}`}
              onClick={() => setCadenceVue('hebdomadaire')}
            >
              Hebdomadaires
            </button>
          </div>
          <button type="button" className={styles.boutonAjouter} onClick={ouvrirAjout}>
            + Habitude
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className={styles.vide}>
          <div className={styles.videIcone} aria-hidden="true">
            🧭
          </div>
          <p className={styles.videTitre}>Aucune habitude suivie</p>
          <p className={styles.videTexte}>
            Ajoute-les avec le bouton « + Habitude », ou demande au Capitaine : il te posera les
            bonnes questions (quotidienne ou hebdomadaire) et remplira ta grille.
          </p>
        </div>
      ) : (
        <div className={styles.panneau}>
          <div className={styles.grilleScroll}>
            <table className={styles.grille}>
              <thead>
                <tr>
                  <th className={styles.thHabitude}>Habitude</th>
                  {jours.map((d) => {
                    const jourSemaine = new Date(annee, mois, d).getDay();
                    const estAuj = estMoisCourant && d === jourAujourdhui;
                    const weekend = jourSemaine === 0 || jourSemaine === 6;
                    return (
                      <th
                        key={d}
                        className={`${styles.thJour} ${estAuj ? styles.thJourAuj : ''} ${
                          weekend ? styles.thWeekend : ''
                        }`}
                      >
                        <span className={styles.thLettre}>{LETTRES_JOUR[jourSemaine]}</span>
                        <span className={styles.thNum}>{d}</span>
                      </th>
                    );
                  })}
                  <th className={styles.thBilan}>Bilan</th>
                </tr>
              </thead>

              <tbody>
                <SectionLignes
                  titre={cadenceVue === 'quotidienne' ? 'Quotidiennes' : 'Hebdomadaires'}
                  messageVide={
                    cadenceVue === 'quotidienne'
                      ? 'Aucune habitude quotidienne. Ajoute-en avec « + Habitude ».'
                      : 'Aucune habitude hebdomadaire. Ajoute-en avec « + Habitude ».'
                  }
                  habitudes={cadenceVue === 'quotidienne' ? quotidiennes : hebdomadaires}
                  jours={jours}
                  annee={annee}
                  mois={mois}
                  marques={marques}
                  estMoisCourant={estMoisCourant}
                  jourAujourdhui={jourAujourdhui}
                  isoAujourdhui={isoAujourdhui}
                  calculerStats={calculerStats}
                  onMarquer={onMarquer}
                  onEditer={ouvrirEdition}
                  onSupprimer={onSupprimer}
                  nbColonnes={nbJours + 2}
                />
              </tbody>
            </table>
          </div>

          <div className={styles.legende}>
            <span><span className={`${styles.pastille} ${styles.pFait}`}>✓</span> fait</span>
            <span><span className={`${styles.pastille} ${styles.pRate}`}>✕</span> raté</span>
            <span><span className={`${styles.pastille} ${styles.pNeutre}`} /> prévu</span>
            <span className={styles.legendeAstuce}>Clique une case pour changer son état.</span>
          </div>
        </div>
      )}

      {formOuvert && (
        <HabitudeForm
          habitudeInitiale={enEdition ?? undefined}
          onValider={handleValider}
          onAnnuler={() => {
            setFormOuvert(false);
            setEnEdition(null);
          }}
        />
      )}
    </section>
  );
}

// Un groupe (Quotidiennes / Hebdomadaires) : une ligne titre puis une ligne
// par habitude.
function SectionLignes({
  titre,
  messageVide,
  habitudes,
  jours,
  annee,
  mois,
  marques,
  estMoisCourant,
  jourAujourdhui,
  isoAujourdhui,
  calculerStats,
  onMarquer,
  onEditer,
  onSupprimer,
  nbColonnes,
}: {
  titre: string;
  messageVide: string;
  habitudes: Habitude[];
  jours: number[];
  annee: number;
  mois: number;
  marques: MarquesHabitudes;
  estMoisCourant: boolean;
  jourAujourdhui: number;
  isoAujourdhui: string;
  calculerStats: (h: Habitude) => StatsHabitude;
  onMarquer: (id: string, dateISO: string, etat: EtatHabitude | null) => void;
  onEditer: (h: Habitude) => void;
  onSupprimer: (id: string) => void;
  nbColonnes: number;
}) {
  return (
    <>
      <tr className={styles.ligneSection}>
        <td className={styles.tdSection} colSpan={nbColonnes}>
          {titre}
        </td>
      </tr>
      {habitudes.length === 0 && (
        <tr className={styles.ligneVideSection}>
          <td className={styles.tdVideSection} colSpan={nbColonnes}>
            {messageVide}
          </td>
        </tr>
      )}
      {habitudes.map((h) => {
        const stats = calculerStats(h);
        const parDate = marques[h.id] ?? {};
        return (
          <tr key={h.id} className={styles.ligneHabitude}>
            <td className={styles.tdHabitude}>
              <div className={styles.habitudeNom}>
                <span className={styles.habitudeTexte}>{h.nom}</span>
                {stats.streak >= 2 && (
                  <span className={styles.flamme} title={`${stats.streak} jours d'affilée`}>
                    🔥{stats.streak}
                  </span>
                )}
              </div>
              <div className={styles.habitudeBas}>
                {h.cadence === 'hebdomadaire' && (
                  <span className={styles.tagObjectif}>obj {h.objectifHebdo}×/sem</span>
                )}
                <div className={styles.habitudeActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    aria-label="Modifier l'habitude"
                    onClick={() => onEditer(h)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    aria-label="Supprimer l'habitude"
                    onClick={() => {
                      if (confirm(`Supprimer l'habitude « ${h.nom} » et son historique ?`)) {
                        onSupprimer(h.id);
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </td>

            {jours.map((d) => {
              const iso = dateISO(annee, mois, d);
              const etat = parDate[iso];
              const estAuj = estMoisCourant && d === jourAujourdhui;
              const futur = iso > isoAujourdhui;
              return (
                <td key={d} className={styles.tdCellule}>
                  <button
                    type="button"
                    className={`${styles.case} ${
                      etat === 'fait' ? styles.caseFait : etat === 'rate' ? styles.caseRate : ''
                    } ${estAuj ? styles.caseAuj : ''} ${futur ? styles.caseFutur : ''}`}
                    aria-label={`${h.nom}, jour ${d} : ${
                      etat === 'fait' ? 'fait' : etat === 'rate' ? 'raté' : 'prévu'
                    }`}
                    onClick={() => onMarquer(h.id, iso, etatSuivant(etat))}
                  >
                    {etat === 'fait' ? '✓' : etat === 'rate' ? '✕' : ''}
                  </button>
                </td>
              );
            })}

            <td className={styles.tdBilan}>
              {h.cadence === 'quotidienne' ? (
                <>
                  <span className={styles.bilanTaux}>{stats.taux}%</span>
                  <span className={styles.bilanDetail}>
                    {stats.faits} fait{stats.faits > 1 ? 's' : ''}
                    {stats.rates > 0 && ` · ${stats.rates} raté${stats.rates > 1 ? 's' : ''}`}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.bilanTaux}>{stats.taux}%</span>
                  <span className={styles.bilanDetail}>
                    {estMoisCourant && `sem. ${stats.cetteSemaine}/${h.objectifHebdo} · `}
                    {stats.faits} ce mois
                  </span>
                </>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
