import { useEffect, useState } from 'react';
import { bilanDuJour, dateDeIso, suiviSemaine, type BilanJour, type SuiviHebdo } from '../data/bilanJournee';
import { jourDuBilan } from '../state/useRecaps';
import type {
  BlocRecap,
  CreneauRecap,
  EtatHabitude,
  Habitude,
  HabitudeDuJour,
  MarquesHabitudes,
  Recap,
} from '../types';
import styles from './Recap.module.css';

interface RecapPageProps {
  recaps: Recap[];
  creneau: CreneauRecap | null;
  enPreparation: boolean;
  erreur: string | null;
  onRefaire: () => void;
  // Habitudes du jour en direct : cochables depuis le récap d'aujourd'hui.
  habitudesDuJour: HabitudeDuJour[];
  onCocherHabitude: (id: string, etat: EtatHabitude | null) => void;
  // Marques réelles : le bilan d'un ancien récap compte ce qui a été coché
  // ensuite (le récap du soir est préparé avant qu'on ait tout coché).
  toutesHabitudes: Habitude[];
  marquesHabitudes: MarquesHabitudes;
  joursMalades: string[];
}

// « 2026-10-11-matin » → date du jour concerné.
function dateDeCle(cle: string): Date {
  const [annee, mois, jour] = cle.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

// Nom court d'un récap : « Ce matin », « Hier soir », « ven. 16 oct. · soir ».
function nomRecap(recap: Recap): string {
  const date = dateDeCle(recap.cle);
  const aujourdhui = new Date();
  const hier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - 1);
  if (date.toDateString() === aujourdhui.toDateString()) return `Ce ${recap.moment}`;
  if (date.toDateString() === hier.toDateString()) return `Hier ${recap.moment}`;
  const jour = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${jour} · ${recap.moment}`;
}

// « Dimanche 19 octobre »
function dateLongue(cle: string): string {
  const texte = dateDeCle(cle).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function heureCourte(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// « 8 h », « 45 min », « 1 h 30 »
function duree(bloc: BlocRecap): string {
  const total = minutes(bloc.heureFin) - minutes(bloc.heureDebut);
  if (!Number.isFinite(total) || total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

// Heure actuelle, rafraîchie chaque minute (pour le créneau « en cours »).
function useMaintenant() {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return maintenant;
}

export function RecapPage({
  recaps,
  creneau,
  enPreparation,
  erreur,
  onRefaire,
  habitudesDuJour,
  onCocherHabitude,
  toutesHabitudes,
  marquesHabitudes,
  joursMalades,
}: RecapPageProps) {
  const [cleChoisie, setCleChoisie] = useState<string | null>(null);
  const maintenant = useMaintenant();

  // Par défaut on montre le plus récent ; flèches et historique en choisissent un autre.
  const index = Math.max(0, recaps.findIndex((r) => r.cle === cleChoisie));
  const recap = recaps[index] ?? null;
  const estActuel = recap !== null && recap.cle === creneau?.cle;
  const matin = recap?.moment === 'matin';
  // Récap d'aujourd'hui : les habitudes sont celles du jour, en direct.
  const enDirect = recap !== null && dateDeCle(recap.cle).toDateString() === maintenant.toDateString();

  // Bilan (la veille le matin, le jour même le soir) et objectifs de la
  // semaine, toujours recalculés à partir des marques réelles.
  const bilan = recap
    ? bilanDuJour(toutesHabitudes, marquesHabitudes, joursMalades, jourDuBilan(recap.cle, recap.moment))
    : null;
  const semaine = recap
    ? suiviSemaine(toutesHabitudes, marquesHabitudes, joursMalades, recap.cle.slice(0, 10), recap.moment === 'matin')
    : [];

  return (
    <section className={styles.page}>
      <article className={styles.journal}>
        {/* ---------- Bandeau : moment de la journée ---------- */}
        <header className={matin || !recap ? `${styles.bandeau} ${styles.bandeauMatin}` : `${styles.bandeau} ${styles.bandeauSoir}`}>
          <Ciel soir={!matin && recap !== null} />
          <div className={styles.bandeauTexte}>
            <span className={styles.surtitre}>
              {recap ? (matin ? 'Récap du matin' : 'Récap du soir') : 'Journal de bord'}
            </span>
            <h1 className={styles.titre}>{recap ? dateLongue(recap.cle) : 'Récap'}</h1>
            <p className={styles.sousTitre}>
              {recap
                ? `${estActuel ? 'Préparé' : 'Écrit'} à ${heureCourte(recap.creeLe)} par ton second`
                : 'Un récap du navire chaque matin et chaque soir.'}
            </p>
          </div>
          <div className={styles.bandeauActions}>
            {recaps.length > 1 && (
              <div className={styles.feuilleter}>
                <button
                  type="button"
                  className={styles.fleche}
                  onClick={() => setCleChoisie(recaps[index + 1]?.cle ?? null)}
                  disabled={index >= recaps.length - 1}
                  aria-label="Récap précédent"
                  title={recaps[index + 1] ? nomRecap(recaps[index + 1]) : undefined}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14.5 6 8.5 12l6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.fleche}
                  onClick={() => setCleChoisie(recaps[index - 1]?.cle ?? null)}
                  disabled={index === 0}
                  aria-label="Récap suivant"
                  title={recaps[index - 1] ? nomRecap(recaps[index - 1]) : undefined}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9.5 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.boutonRefaire}
              onClick={onRefaire}
              disabled={enPreparation}
              title="Repréparer le récap du moment"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={enPreparation ? styles.tourne : undefined}>
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v3.8h-3.8" />
              </svg>
              {enPreparation ? 'Préparation…' : 'Refaire'}
            </button>
          </div>
        </header>

        <div className={styles.corps}>
          {erreur && <p className={styles.alerte}>{erreur}</p>}
          {recap?.erreurs.map((e) => (
            <p key={e} className={styles.alerte}>
              {e}
            </p>
          ))}

          {enPreparation && (
            <p className={styles.attente}>
              Ton second relève le courrier et prépare le récap… Cela peut prendre quelques minutes.
            </p>
          )}

          {!recap && !enPreparation && !erreur && (
            <p className={styles.attente}>Aucun récap pour l'instant.</p>
          )}

          {recap && (
            <>
              {!estActuel && creneau && (
                <p className={styles.ancien}>
                  Tu relis un ancien récap ·{' '}
                  <button type="button" className={styles.lien} onClick={() => setCleChoisie(null)}>
                    revenir au dernier
                  </button>
                </p>
              )}

              {recap.mot && (
                <figure className={styles.lettre}>
                  <blockquote className={styles.mot}>{recap.mot}</blockquote>
                  <figcaption className={styles.signature}>— Ton second</figcaption>
                </figure>
              )}

              {bilan && <Indicateurs recap={recap} bilan={bilan} semaine={semaine} />}

              <div className={styles.grille}>
                <Priorites recap={recap} />
                {bilan && <BilanDuJour bilan={bilan} matin={matin} />}
              </div>

              <div className={styles.grille}>
                <Programme recap={recap} enDirect={estActuel && matin} maintenant={maintenant} />
                <div className={styles.colonne}>
                  {enDirect && (
                    <ChecklistDuJour
                      habitudes={habitudesDuJour}
                      onCocher={onCocherHabitude}
                      titre={matin ? 'Check-list du jour' : 'Avant de jeter l’ancre'}
                    />
                  )}
                  <ObjectifsSemaine semaine={semaine} />
                </div>
              </div>

              <Courrier recap={recap} />
            </>
          )}

          {recaps.length > 1 && (
            <nav className={styles.historique} aria-label="Tous les récaps">
              <span className={styles.historiqueTitre}>Journal des récaps</span>
              <div className={styles.puces}>
                {recaps.map((r) => (
                  <button
                    key={r.cle}
                    type="button"
                    aria-current={r.cle === recap?.cle ? 'true' : undefined}
                    className={r.cle === recap?.cle ? `${styles.puce} ${styles.puceActive}` : styles.puce}
                    onClick={() => setCleChoisie(r.cle)}
                  >
                    <span className={r.moment === 'matin' ? styles.puceSoleil : styles.puceLune} aria-hidden="true" />
                    {nomRecap(r)}
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
      </article>
    </section>
  );
}

// Soleil levant sur l'horizon, ou lune et étoiles le soir.
function Ciel({ soir }: { soir: boolean }) {
  return (
    <svg className={styles.ciel} viewBox="0 0 120 80" aria-hidden="true">
      {soir ? (
        <>
          <circle cx="22" cy="18" r="1.2" className={styles.etoile} />
          <circle cx="96" cy="12" r="1" className={styles.etoile} />
          <circle cx="104" cy="34" r="1.3" className={styles.etoile} />
          <circle cx="14" cy="44" r="0.9" className={styles.etoile} />
          <path className={styles.astre} d="M68 16a18 18 0 1 0 14 29 15 15 0 0 1-14-29z" />
        </>
      ) : (
        <>
          <g className={styles.rayons}>
            {[-70, -45, -20, 0, 20, 45, 70].map((a) => (
              <path key={a} d="M60 34V14" transform={`rotate(${a} 60 58)`} />
            ))}
          </g>
          <circle cx="60" cy="58" r="18" className={styles.astre} />
        </>
      )}
      <path className={styles.vague} d="M0 60c10-4 20-4 30 0s20 4 30 0 20-4 30 0 20 4 30 0v20H0z" />
      <path className={styles.vague2} d="M0 68c10-3 20-3 30 0s20 3 30 0 20-3 30 0 20 3 30 0v12H0z" />
    </svg>
  );
}

// Trois chiffres pour saisir la journée d'un coup d'œil : le programme, le
// bilan des habitudes (hier le matin, aujourd'hui le soir) et la semaine.
function Indicateurs({ recap, bilan, semaine }: { recap: Recap; bilan: BilanJour; semaine: SuiviHebdo[] }) {
  const matin = recap.moment === 'matin';
  const premier = recap.planning[0];
  const part = bilan.attendues > 0 ? bilan.faites / bilan.attendues : 0;
  const atteints = semaine.filter((h) => h.statut === 'atteint').length;
  const enDanger = semaine.filter((h) => h.statut === 'serre' || h.statut === 'hors-portee').length;

  return (
    <div className={styles.indicateurs}>
      <div className={styles.indicateur}>
        <span className={styles.indicateurValeur}>{recap.planning.length}</span>
        <span className={styles.indicateurLabel}>
          créneau{recap.planning.length > 1 ? 'x' : ''} {matin ? "aujourd'hui" : 'demain'}
        </span>
        <span className={styles.indicateurDetail}>
          {premier ? `On largue les amarres à ${premier.heureDebut}` : 'Journée libre'}
        </span>
      </div>

      <div className={styles.indicateur}>
        <span className={styles.indicateurValeur}>
          {bilan.faites}
          <span className={styles.indicateurSur}>/{bilan.attendues}</span>
        </span>
        <span className={styles.indicateurLabel}>quotidiennes tenues {matin ? 'hier' : "aujourd'hui"}</span>
        {bilan.malade ? (
          <span className={styles.indicateurDetail}>Jour malade : repos</span>
        ) : (
          <span className={styles.jauge} role="img" aria-label={`${Math.round(part * 100)} % tenues`}>
            <span style={{ width: `${part * 100}%` }} />
          </span>
        )}
      </div>

      <div className={styles.indicateur}>
        <span className={styles.indicateurValeur}>
          {atteints}
          <span className={styles.indicateurSur}>/{semaine.length}</span>
        </span>
        <span className={styles.indicateurLabel}>objectifs de la semaine</span>
        <span className={styles.indicateurDetail}>
          {semaine.length === 0
            ? 'Aucune habitude hebdomadaire'
            : enDanger > 0
              ? `${enDanger} à surveiller de près`
              : 'Tout est dans les temps'}
        </span>
      </div>
    </div>
  );
}

// La route du jour : une frise des créneaux, le créneau en cours mis en avant.
function Programme({ recap, enDirect, maintenant }: { recap: Recap; enDirect: boolean; maintenant: Date }) {
  const matin = recap.moment === 'matin';
  const minuteActuelle = maintenant.getHours() * 60 + maintenant.getMinutes();
  const dateRecap = dateDeCle(recap.cle).toDateString();
  const aujourdhui = enDirect && dateRecap === maintenant.toDateString();

  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>{matin ? 'La route du jour' : 'Cap sur demain'}</h2>
      {recap.planning.length === 0 ? (
        <p className={styles.blocVide}>Rien de prévu : mer libre.</p>
      ) : (
        <ol className={styles.frise}>
          {recap.planning.map((b) => {
            const debut = minutes(b.heureDebut);
            const fin = minutes(b.heureFin);
            const etat = !aujourdhui
              ? ''
              : minuteActuelle >= fin
                ? styles.etapePassee
                : minuteActuelle >= debut
                  ? styles.etapeEnCours
                  : '';
            return (
              <li key={`${b.heureDebut}-${b.titre}`} className={`${styles.etape} ${etat}`}>
                <span className={styles.etapeHeure}>{b.heureDebut}</span>
                <span className={styles.etapePoint} aria-hidden="true" />
                <span className={styles.etapeCorps}>
                  <span className={styles.etapeTitre}>{b.titre}</span>
                  <span className={styles.etapeMeta}>
                    jusqu'à {b.heureFin}
                    {duree(b) && ` · ${duree(b)}`}
                    {etat === styles.etapeEnCours && <strong className={styles.enCours}>en cours</strong>}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Habitudes « encore à jouer » aujourd'hui : pas encore marquées, et pour une
// hebdomadaire, objectif de la semaine pas encore atteint.
function resteAFaire(h: HabitudeDuJour): boolean {
  return !h.etat && (h.cadence !== 'hebdomadaire' || h.faitsCetteSemaine < h.objectifHebdo);
}

// Check-list du récap d'aujourd'hui : on coche directement ici. Ce qui reste
// à faire est en grand ; ce qui est réglé se replie sur une ligne.
function ChecklistDuJour({
  habitudes,
  onCocher,
  titre,
}: {
  habitudes: HabitudeDuJour[];
  onCocher: (id: string, etat: EtatHabitude | null) => void;
  titre: string;
}) {
  const faites = habitudes.filter((h) => h.etat === 'fait');
  const ratees = habitudes.filter((h) => h.etat === 'rate');
  const quotidiennes = habitudes.filter((h) => resteAFaire(h) && h.cadence !== 'hebdomadaire');
  const hebdo = habitudes.filter((h) => resteAFaire(h) && h.cadence === 'hebdomadaire');
  const reglees = habitudes.filter((h) => h.etat);
  const total = habitudes.length;
  const part = total > 0 ? faites.length / total : 0;

  return (
    <section className={styles.bloc}>
      <div className={styles.checkEntete}>
        <Anneau part={part} />
        <div>
          <h2 className={styles.checkTitre}>{titre}</h2>
          <p className={styles.checkSous}>
            {total === 0
              ? "Aucune habitude à tenir aujourd'hui."
              : quotidiennes.length + hebdo.length === 0
                ? "Tout est réglé pour aujourd'hui. Beau travail, capitaine."
                : `${faites.length} tenue${faites.length > 1 ? 's' : ''} sur ${total} · coche au fil de la journée`}
          </p>
        </div>
      </div>

      {quotidiennes.length > 0 && (
        <GroupeHabitudes titre="Aujourd'hui" habitudes={quotidiennes} onCocher={onCocher} />
      )}
      {hebdo.length > 0 && (
        <GroupeHabitudes titre="Cette semaine" habitudes={hebdo} onCocher={onCocher} />
      )}

      {reglees.length > 0 && (
        <div className={styles.reglees}>
          <span className={styles.groupeTitre}>
            Réglées · {faites.length} tenue{faites.length > 1 ? 's' : ''}
            {ratees.length > 0 && `, ${ratees.length} ratée${ratees.length > 1 ? 's' : ''}`}
          </span>
          <div className={styles.regleesListe}>
            {reglees.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`${styles.reglee} ${h.etat === 'fait' ? styles.regleeFaite : styles.regleeRatee}`}
                onClick={() => onCocher(h.id, null)}
                title="Annuler"
                aria-label={`Annuler « ${h.nom} » (${h.etat === 'fait' ? 'tenue' : 'ratée'})`}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d={h.etat === 'fait' ? 'm3.5 8.5 3 3 6-7' : 'm4.5 4.5 7 7M11.5 4.5l-7 7'} />
                </svg>
                {h.nom}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function GroupeHabitudes({
  titre,
  habitudes,
  onCocher,
}: {
  titre: string;
  habitudes: HabitudeDuJour[];
  onCocher: (id: string, etat: EtatHabitude | null) => void;
}) {
  return (
    <div className={styles.groupe}>
      <span className={styles.groupeTitre}>
        {titre} · {habitudes.length}
      </span>
      <ul className={styles.aFaire}>
        {habitudes.map((h) => (
          <li key={h.id} className={styles.aFaireLigne}>
            <button
              type="button"
              className={styles.aFaireBouton}
              onClick={() => onCocher(h.id, 'fait')}
              aria-label={`Marquer « ${h.nom} » comme tenue`}
            >
              <span className={styles.caseVide} aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              </span>
              <span className={styles.aFaireNom}>{h.nom}</span>
              {h.cadence === 'hebdomadaire' && (
                <span className={styles.aFaireSemaine}>
                  {h.faitsCetteSemaine}/{h.objectifHebdo}
                </span>
              )}
            </button>
            <button
              type="button"
              className={styles.rater}
              onClick={() => onCocher(h.id, 'rate')}
              aria-label={`Marquer « ${h.nom} » comme ratée`}
              title="Ratée"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Anneau({ part }: { part: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className={styles.anneau} role="img" aria-label={`${Math.round(part * 100)} % tenues`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className={styles.anneauFond} />
        <circle
          cx="24"
          cy="24"
          r={r}
          className={styles.anneauPlein}
          strokeDasharray={`${c * part} ${c}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className={styles.anneauTexte}>{Math.round(part * 100)}%</span>
    </span>
  );
}

// Les 3 priorités choisies par le second dans le programme, et son conseil.
function Priorites({ recap }: { recap: Recap }) {
  const matin = recap.moment === 'matin';
  const priorites = recap.priorites ?? [];
  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>{matin ? 'Les priorités du jour' : 'Les priorités de demain'}</h2>
      {priorites.length === 0 ? (
        <p className={styles.blocVide}>
          {recap.priorites === undefined
            ? 'Ce récap date d’avant les priorités.'
            : 'Que de la routine au programme : rien à prioriser.'}
        </p>
      ) : (
        <ol className={styles.priorites}>
          {priorites.map((p, i) => (
            <li key={`${p.heureDebut}-${p.titre}`} className={styles.priorite}>
              <span className={styles.prioriteRang} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.prioriteCorps}>
                <span className={styles.prioriteTexte}>{p.titre}</span>
                <span className={styles.prioriteHeure}>à {p.heureDebut}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {recap.conseil && (
        <p className={styles.conseil}>
          <span className={styles.conseilTitre}>Le conseil du second</span>
          {recap.conseil}
        </p>
      )}
    </section>
  );
}

// Ce qui a été réussi (avec les séries) et ce qui est à rattraper.
function BilanDuJour({ bilan, matin }: { bilan: BilanJour; matin: boolean }) {
  const quand = matin ? 'hier' : "aujourd'hui";
  const jour = dateDeIso(bilan.iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const aRattraper = [...bilan.ratees.map((nom) => ({ nom, rate: true })), ...bilan.oubliees.map((nom) => ({ nom, rate: false }))];

  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>
        {matin ? 'Le bilan d’hier' : 'Le bilan du jour'}
        <span className={styles.blocDate}>{jour}</span>
      </h2>
      {bilan.malade && <p className={styles.blocVide}>Jour malade : seules les habitudes qui comptent même malade sont prises en compte.</p>}

      <h3 className={styles.sousTitreBloc}>
        <span className={styles.pastilleVerte} aria-hidden="true" />
        Réussi {quand} · {bilan.reussites.length}
      </h3>
      {bilan.reussites.length === 0 ? (
        <p className={styles.blocVide}>Rien de coché comme tenu {quand}.</p>
      ) : (
        <ul className={styles.reussites}>
          {bilan.reussites.map((r) => (
            <li key={r.nom} className={styles.reussite}>
              <span className={styles.reussiteNom}>{r.nom}</span>
              {r.serie >= 2 && (
                <span className={styles.serie} title={`${r.serie} jours d'affilée`}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 1.5c.6 2.2 3.5 3.6 3.5 7a3.5 3.5 0 0 1-7 0c0-1.6.8-2.5 1.6-3.2.1 1.2.7 1.9 1.4 2.1C7.2 5.6 7.4 3.4 8 1.5z" />
                  </svg>
                  {r.serie} j
                </span>
              )}
              {r.hebdo && <span className={styles.hebdoBadge}>hebdo</span>}
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.sousTitreBloc}>
        <span className={styles.pastilleRouge} aria-hidden="true" />
        À rattraper · {aRattraper.length}
      </h3>
      {aRattraper.length === 0 ? (
        <p className={styles.blocVide}>Rien : journée sans fausse note.</p>
      ) : (
        <ul className={styles.rattraper}>
          {aRattraper.map((h) => (
            <li key={h.nom} className={h.rate ? styles.rattraperRate : styles.rattraperOubli}>
              {h.nom}
              <span className={styles.rattraperEtat}>{h.rate ? 'ratée' : 'pas cochée'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const LIBELLE_STATUT: Record<SuiviHebdo['statut'], string> = {
  atteint: 'atteint',
  'en-route': 'dans les temps',
  serre: 'plus de marge',
  'hors-portee': 'hors de portée',
};

// Où en sont les objectifs hebdomadaires, ceux en danger d'abord.
function ObjectifsSemaine({ semaine }: { semaine: SuiviHebdo[] }) {
  if (semaine.length === 0) return null;
  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>Les objectifs de la semaine</h2>
      <ul className={styles.objectifs}>
        {semaine.map((h) => (
          <li key={h.nom} className={`${styles.objectif} ${styles[`statut-${h.statut}`] ?? ''}`}>
            <div className={styles.objectifHaut}>
              <span className={styles.objectifNom}>{h.nom}</span>
              <span className={styles.objectifCompte}>
                {h.faits}/{h.objectif}
              </span>
            </div>
            <span className={styles.objectifJauge} aria-hidden="true">
              <span style={{ width: `${h.objectif > 0 ? Math.min(1, h.faits / h.objectif) * 100 : 100}%` }} />
            </span>
            <span className={styles.objectifStatut}>
              {LIBELLE_STATUT[h.statut]}
              {h.statut !== 'atteint' &&
                ` · encore ${h.objectif - h.faits} en ${h.joursRestants} jour${h.joursRestants > 1 ? 's' : ''}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Courrier({ recap }: { recap: Recap }) {
  const matin = recap.moment === 'matin';
  const { courrier } = recap;
  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>Courrier important</h2>
      {!courrier.configure ? (
        <p className={styles.blocVide}>Aucune boîte Gmail reliée (voir l'onglet Courrier).</p>
      ) : courrier.nouveaux.length === 0 ? (
        <p className={styles.blocVide}>
          Rien de nouveau depuis {matin ? 'hier soir' : 'ce matin'}. Mer calme.
        </p>
      ) : (
        <ul className={styles.mails}>
          {courrier.nouveaux.map((mail) => (
            <li key={mail.id}>
              <a className={styles.mail} href={mail.lien ?? undefined} target="_blank" rel="noreferrer">
                <span className={styles.sceau} aria-hidden="true">
                  {mail.de.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <span className={styles.mailCorps}>
                  <span className={styles.expediteur}>{mail.de}</span>
                  <span className={styles.objet}>{mail.objet}</span>
                  {mail.raison && <span className={styles.raison}>{mail.raison}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
