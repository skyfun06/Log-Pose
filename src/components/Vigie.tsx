import { useEffect } from 'react';
import type { JourDeBord } from '../data/carnet';
import { EQUIPAGE, type Membre } from '../data/equipage';
import type { Etape, Ile } from '../types';
import { Cranes } from './Cranes';
import { Festivites } from './Festivites';
import { Portrait } from './Portrait';
import styles from './Vigie.module.css';

function useEchap(fermer: () => void) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [fermer]);
}

const euros = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;

interface RapportVigieProps {
  hier: JourDeBord | null; // la veille (null = rien fait hier)
  derniereSortie: string | null; // dernier jour en mer avant aujourd'hui (ISO)
  serie: number;
  meilleureSerie: number;
  joursEnMer: number;
  prochaine: Membre | null;
  cap: { ile: Ile; etape: Etape | null; avancement: number } | null;
  onFermer: () => void;
}

// Le rapport du matin : ce que tu as fait hier, la série, la prochaine recrue
// et le cap du jour. C'est la raison de revenir chaque jour : voir le fruit
// d'hier et savoir quoi faire aujourd'hui.
export function RapportVigie({
  hier,
  derniereSortie,
  serie,
  meilleureSerie,
  joursEnMer,
  prochaine,
  cap,
  onFermer,
}: RapportVigieProps) {
  useEchap(onFermer);
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const precedente = prochaine ? [...EQUIPAGE].reverse().find((m) => m.jours <= joursEnMer) : null;
  const base = precedente?.jours ?? 0;
  const progression = prochaine ? (joursEnMer - base) / (prochaine.jours - base) : 1;
  const absence =
    !hier && derniereSortie
      ? Math.round((Date.now() - new Date(derniereSortie).getTime()) / 86_400_000)
      : null;

  return (
    <div className={styles.overlay} onClick={onFermer}>
      <article
        className={styles.rapport}
        role="dialog"
        aria-modal="true"
        aria-label="Rapport de la vigie"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.tete}>
          <Portrait role="vigie" recrute taille={44} />
          <div>
            <span className={styles.surtitre}>Rapport de la vigie</span>
            <h2 className={styles.date}>{date}</h2>
          </div>
        </header>

        {/* La série : le cœur du rapport. */}
        <section className={serie > 0 ? styles.serie : `${styles.serie} ${styles.serieEteinte}`}>
          <span className={styles.flamme} aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="M8 1.5c.6 2.6 3.9 4 3.9 7.6A3.9 3.9 0 0 1 8 13.4a3.9 3.9 0 0 1-3.9-4.3c.2-1.7 1.3-2.6 1.8-3.8.4 1 .8 1.6 1.4 1.9C7.5 5.4 7.5 3.4 8 1.5z" />
            </svg>
          </span>
          <div className={styles.serieTexte}>
            <strong>
              {serie} jour{serie > 1 ? 's' : ''}
            </strong>
            <span>
              {serie > 0
                ? serie >= meilleureSerie && serie > 1
                  ? 'Record battu. Tiens-le encore aujourd’hui.'
                  : `de série · record : ${meilleureSerie} j. Ne la brise pas aujourd’hui.`
                : absence
                  ? `Le navire est à quai depuis ${absence} jours. Une seule action aujourd'hui relance la série.`
                  : "Le vent est retombé hier. Une seule action aujourd'hui relance la série."}
            </span>
          </div>
        </section>

        <section className={styles.hier}>
          <h3 className={styles.intertitre}>Hier</h3>
          {hier ? (
            <>
              <div className={styles.tuiles}>
                <div>
                  <strong>{hier.habitudes.length}</strong>
                  <span>
                    habitude{hier.habitudes.length > 1 ? 's' : ''} tenue
                    {hier.habitudes.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div>
                  <strong>{hier.etapes.length}</strong>
                  <span>
                    étape{hier.etapes.length > 1 ? 's' : ''} franchie
                    {hier.etapes.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div>
                  <strong>{euros(hier.gains)}</strong>
                  <span>gagnés</span>
                </div>
              </div>
              {hier.etapes.length > 0 && (
                <ul className={styles.etapes}>
                  {hier.etapes.map((e, i) => (
                    <li key={i}>
                      <span>{e.texte}</span>
                      <Cranes niveau={e.difficulte} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className={styles.vide}>Pas de sortie en mer hier.</p>
          )}
        </section>

        <section className={styles.equipage}>
          {prochaine ? (
            <>
              <Portrait role={prochaine.role} recrute={false} taille={40} />
              <div className={styles.equipageTexte}>
                <span>
                  Encore <strong>{prochaine.jours - joursEnMer}</strong> jour
                  {prochaine.jours - joursEnMer > 1 ? 's' : ''} en mer pour recruter{' '}
                  <strong>{prochaine.titre}</strong>
                </span>
                <span className={styles.jauge}>
                  <span style={{ width: `${progression * 100}%` }} />
                </span>
              </div>
            </>
          ) : (
            <span className={styles.equipageTexte}>
              L'équipage est au complet. Quel capitaine !
            </span>
          )}
        </section>

        {cap && (
          <section className={styles.cap}>
            <h3 className={styles.intertitre}>Cap du jour</h3>
            <p>
              Île {cap.ile.numero} · <strong>{cap.ile.nom}</strong> ({cap.ile.titre}) ·{' '}
              {Math.round(cap.avancement * 100)} % du trajet
            </p>
            {cap.etape && (
              <p className={styles.capEtape}>
                Prochaine étape : <strong>{cap.etape.texte}</strong>{' '}
                <Cranes niveau={cap.etape.difficulte} />
              </p>
            )}
          </section>
        )}

        <button type="button" className={styles.bouton} onClick={onFermer} autoFocus>
          Hisser les voiles
        </button>
      </article>
    </div>
  );
}

// Un membre rejoint l'équipage.
export function NouvelleRecrue({ membre, onFermer }: { membre: Membre; onFermer: () => void }) {
  useEchap(onFermer);
  return (
    <div className={styles.overlay} onClick={onFermer}>
      <Festivites variante="confettis" />
      <article
        className={`${styles.rapport} ${styles.recrue}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Nouvelle recrue : ${membre.titre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.surtitre}>Nouvelle recrue · {membre.jours} jours en mer</span>
        <div className={styles.recruePortrait}>
          <Portrait role={membre.role} recrute taille={110} />
        </div>
        <h2 className={styles.recrueNom}>{membre.titre}</h2>
        <p className={styles.recrueApport}>{membre.apport}</p>
        <blockquote className={styles.citation}>« {membre.citation} »</blockquote>
        <button type="button" className={styles.bouton} onClick={onFermer} autoFocus>
          Bienvenue à bord
        </button>
      </article>
    </div>
  );
}
