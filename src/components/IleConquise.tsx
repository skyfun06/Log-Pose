import { useEffect } from 'react';
import type { Etape, Ile } from '../types';
import { Cranes } from './Cranes';
import { Festivites } from './Festivites';
import styles from './IleConquise.module.css';

interface IleConquiseProps {
  ile: Ile;
  etapes: Etape[];
  depuis: string | null; // date de départ vers cette île (conquête précédente)
  suivante: Ile | null;
  totalConquises: number;
  totalIles: number;
  onContinuer: () => void;
}

const jours = (de: string, a: Date) =>
  Math.max(1, Math.round((a.getTime() - new Date(de).getTime()) / 86_400_000));

// La scène de conquête : le drapeau se plante sur l'île, la quête est
// racontée en chiffres (durée, étapes, exploits), puis le cap suivant.
export function IleConquise({
  ile,
  etapes,
  depuis,
  suivante,
  totalConquises,
  totalIles,
  onContinuer,
}: IleConquiseProps) {
  const maintenant = new Date();
  const premiere = etapes.map((e) => e.creeLe).sort()[0];
  const debut = depuis ?? premiere ?? null;
  const duree = debut ? jours(debut, maintenant) : null;
  const exploits = etapes.filter((e) => e.difficulte === 3).length;
  const finale = suivante === null;

  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onContinuer();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onContinuer]);

  return (
    <div className={styles.overlay}>
      <Festivites variante="confettis" />
      <div
        className={styles.carte}
        role="dialog"
        aria-modal="true"
        aria-label={`Île conquise : ${ile.titre}`}
      >
        <svg className={styles.scene} viewBox="0 0 320 150" aria-hidden="true">
          <path d="M0 120q20-6 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" className={styles.vague} />
          <path
            d="M-20 132q20-6 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0"
            className={`${styles.vague} ${styles.vagueLoin}`}
          />
          <path
            d="M84 118c-4-22 18-40 40-36 10-16 40-16 50 2 22-2 36 18 30 36z"
            className={styles.terre}
          />
          <path d="M190 100q4-26-4-46" className={styles.tronc} />
          <path
            d="M186 54q-18-4-28 10M186 54q18-8 28 6M186 54q-4-18-18-22M186 54q10-14 26-12"
            className={styles.palme}
          />
          <g className={styles.drapeau}>
            <line x1="140" y1="90" x2="140" y2="26" className={styles.hampe} />
            <path d="M140 26q14-5 28 0t26 0v22q-13 5-26 0t-28 0z" className={styles.etendard} />
            <circle cx="163" cy="37" r="5" className={styles.crane} />
          </g>
        </svg>

        <span className={styles.tampon}>{finale ? 'Voyage accompli' : 'Île conquise'}</span>
        <span className={styles.repere}>
          Île {ile.numero} · {ile.arc}
        </span>
        <h2 className={styles.titre}>{ile.titre}</h2>

        <div className={styles.chiffres}>
          {duree !== null && (
            <div>
              <strong>{duree}</strong>
              <span>jour{duree > 1 ? 's' : ''} de traversée</span>
            </div>
          )}
          <div>
            <strong>{etapes.length}</strong>
            <span>
              étape{etapes.length > 1 ? 's' : ''} accomplie{etapes.length > 1 ? 's' : ''}
            </span>
          </div>
          <div>
            <strong>{exploits}</strong>
            <span>exploit{exploits > 1 ? 's' : ''}</span>
          </div>
          <div>
            <strong>
              {totalConquises}/{totalIles}
            </strong>
            <span>îles conquises</span>
          </div>
        </div>

        <ul className={styles.etapes}>
          {etapes.map((e, i) => (
            <li key={e.id} style={{ animationDelay: `${0.9 + i * 0.15}s` }}>
              <span className={styles.coche} aria-hidden="true">
                ✓
              </span>
              <span className={styles.etapeTexte}>{e.texte}</span>
              <Cranes niveau={e.difficulte} />
            </li>
          ))}
        </ul>

        {suivante ? (
          <p className={styles.suite}>
            Prochain cap : <strong>île {suivante.numero}</strong> · {suivante.titre}
          </p>
        ) : (
          <p className={styles.suite}>Toutes les îles sont à toi. Le One Piece t'attend.</p>
        )}

        <button type="button" className={styles.bouton} onClick={onContinuer} autoFocus>
          {suivante ? 'Mettre le cap' : 'Savourer la victoire'}
        </button>
      </div>
    </div>
  );
}
