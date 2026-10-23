import { useEffect, useState } from 'react';
import { BERRYS_PAR_EURO, ERES, NAVIRES, PALIERS } from '../data/paliers';
import { Festivites } from './Festivites';
import { Navire } from './Navire';
import { useCompteur } from './useCompteur';
import { AfficheWanted } from './WantedPoster';
import styles from './Ceremonie.module.css';

interface CeremonieProps {
  nom: string;
  depuis: number; // dernier palier célébré
  jusqua: number; // palier atteint
  prime: number; // euros
  butins: Record<number, string>;
  // origine : centre du bouton, d'où le nouveau décor se déploie.
  onLeverLancre: (origine?: { x: number; y: number }) => void;
}

// Chronologie (ms) : le journal arrive, la prime défile sur l'affiche, le
// tampon frappe (l'affiche prend ses nouvelles marques), puis les récompenses
// se retournent une à une.
const ARRIVEE_JOURNAL = 800;
const DUREE_COMPTEUR = 1600;
const TAMPON = ARRIVEE_JOURNAL + DUREE_COMPTEUR + 80;

const euros = (n: number) => `${n.toLocaleString('fr-FR')} €`;
const berrys = (e: number) => `฿ ${(e * BERRYS_PAR_EURO).toLocaleString('fr-FR')}`;

type Carte =
  | { genre: 'rang'; numero: number; titre: string }
  | { genre: 'epithete'; texte: string }
  | { genre: 'navire'; niveau: number }
  | { genre: 'ere'; ere: keyof typeof ERES }
  | { genre: 'cap'; titre: string; seuil: number };

// La une du Journal économique mondial, le jour où la prime franchit un
// palier. Tout tient sur un écran : l'affiche qui change sous tes yeux à
// gauche, les récompenses en cartes à droite.
export function Ceremonie({ nom, depuis, jusqua, prime, butins, onLeverLancre }: CeremonieProps) {
  const avant = PALIERS[depuis];
  const palier = PALIERS[jusqua];
  const suivant = PALIERS[jusqua + 1] ?? null;
  const franchis = jusqua - depuis;
  const nouvelleEre = avant.ere !== palier.ere;
  const promesses = PALIERS.map((_, i) => i)
    .filter((i) => i > depuis && i <= jusqua && butins[i])
    .map((i) => butins[i]);

  const cartes: Carte[] = [{ genre: 'rang', numero: jusqua + 1, titre: palier.titre }];
  if (palier.epithete && palier.epithete !== avant.epithete)
    cartes.push({ genre: 'epithete', texte: palier.epithete });
  if (palier.navire !== avant.navire) cartes.push({ genre: 'navire', niveau: palier.navire });
  if (nouvelleEre) cartes.push({ genre: 'ere', ere: palier.ere });
  if (cartes.length < 4 && suivant)
    cartes.push({ genre: 'cap', titre: suivant.titre, seuil: suivant.seuil });

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bounty = useCompteur(prime * BERRYS_PAR_EURO, {
    depuis: avant.seuil * BERRYS_PAR_EURO,
    delai: ARRIVEE_JOURNAL,
    duree: DUREE_COMPTEUR,
  });
  const [frappe, setFrappe] = useState(reduit);
  useEffect(() => {
    if (reduit) return;
    const t = setTimeout(() => setFrappe(true), TAMPON);
    return () => clearTimeout(t);
  }, [reduit]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onLeverLancre();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onLeverLancre]);

  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.overlay} data-ere={palier.ere}>
      <span className={styles.rayons} aria-hidden="true" />
      {frappe && !reduit && <Festivites variante="pieces" />}

      <article
        className={frappe && !reduit ? `${styles.journal} ${styles.secoue}` : styles.journal}
        role="dialog"
        aria-modal="true"
        aria-label={palier.une}
      >
        <header className={styles.manchette}>
          <span className={styles.nomJournal}>Journal économique mondial</span>
          <span className={styles.edition}>
            {nouvelleEre ? `Nouvelle ère · ${ERES[palier.ere].nom}` : 'Édition spéciale'} · {date}
          </span>
        </header>

        <h2 className={styles.une}>{palier.une}</h2>

        <div className={styles.corps}>
          <div className={styles.colonneAffiche}>
            <AfficheWanted
              nom={nom}
              bounty={bounty}
              bountyFinal={prime * BERRYS_PAR_EURO}
              euros={bounty / BERRYS_PAR_EURO}
              rang={frappe ? jusqua : depuis}
              className={styles.affiche}
            />
            {frappe && (
              <span className={styles.tampon} aria-hidden="true">
                {nouvelleEre ? 'Nouvelle ère' : 'Prime relevée'}
              </span>
            )}
          </div>

          <div className={styles.colonneDroite}>
            <p className={styles.chapeau}>
              <strong>{nom}</strong> devient <strong>{palier.titre}</strong>
              {franchis > 1 && <> · {franchis} paliers d'un coup</>}.
            </p>

            <ul
              className={frappe ? `${styles.recompenses} ${styles.revelees}` : styles.recompenses}
            >
              {cartes.map((c, i) => (
                <li
                  key={c.genre}
                  className={styles.recompense}
                  data-genre={c.genre}
                  style={{ animationDelay: `${0.15 + i * 0.18}s` }}
                >
                  <CarteRecompense carte={c} />
                </li>
              ))}
            </ul>

            {promesses.length > 0 && (
              <p className={styles.butin}>
                <span>Butin débloqué</span>« {promesses.join(' », « ')} » — tu l'as mérité.
              </p>
            )}

            <button
              type="button"
              className={styles.bouton}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onLeverLancre({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
              }}
              autoFocus
            >
              Lever l'ancre
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}

function CarteRecompense({ carte }: { carte: Carte }) {
  switch (carte.genre) {
    case 'rang':
      return (
        <>
          <span className={styles.medaille}>{carte.numero}</span>
          <span className={styles.recompenseEtiquette}>Nouveau rang</span>
          <strong className={styles.recompenseValeur}>{carte.titre}</strong>
        </>
      );
    case 'epithete':
      return (
        <>
          <span className={styles.timbre}>« {carte.texte} »</span>
          <span className={styles.recompenseEtiquette}>Épithète</span>
          <strong className={styles.recompenseValeur}>sur ton affiche</strong>
        </>
      );
    case 'navire':
      return (
        <>
          <span className={styles.navire}>
            <Navire niveau={carte.niveau} />
          </span>
          <span className={styles.recompenseEtiquette}>Nouveau navire</span>
          <strong className={styles.recompenseValeur}>{NAVIRES[carte.niveau]}</strong>
        </>
      );
    case 'ere':
      return (
        <>
          <span className={styles.nuancier} data-ere={carte.ere} />
          <span className={styles.recompenseEtiquette}>Nouvelle ère</span>
          <strong className={styles.recompenseValeur}>{ERES[carte.ere].nom}</strong>
        </>
      );
    case 'cap':
      return (
        <>
          <span className={styles.prochain}>{berrys(carte.seuil)}</span>
          <span className={styles.recompenseEtiquette}>Prochain cap · {euros(carte.seuil)}</span>
          <strong className={styles.recompenseValeur}>{carte.titre}</strong>
        </>
      );
  }
}
