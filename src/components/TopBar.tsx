import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Vue } from '../types';
import styles from './TopBar.module.css';

interface TopBarProps {
  numero: number;
  arc: string;
  titre: string;
  totalIles: number;
  vue: Vue;
  // sens : 1 = vers la droite des onglets, -1 = vers la gauche (pour la transition).
  onChangerVue: (vue: Vue, sens: 1 | -1) => void;
  // Pages qui ont du nouveau (petit point doré sur l'onglet).
  nouveautes?: Partial<Record<Vue, boolean>>;
}

// Icônes gravées au trait (couleur héritée du texte).
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.ongletIcone}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Onglets du tourniquet, dans l'ordre. Pour ajouter une page : une entrée ici.
const ONGLETS: { vue: Vue; label: string; icone: ReactNode }[] = [
  {
    vue: 'carte',
    label: 'Carte',
    icone: (
      <Icone>
        <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </Icone>
    ),
  },
  {
    vue: 'recap',
    label: 'Récap',
    icone: (
      <Icone>
        <path d="M3 17h18M6 20.5h12" />
        <path d="M7 17a5 5 0 0 1 10 0" />
        <path d="M12 7.5v2M5.8 10.8l1.4 1.4M18.2 10.8l-1.4 1.4" />
      </Icone>
    ),
  },
  {
    vue: 'planning',
    label: 'Emploi du temps',
    icone: (
      <Icone>
        <path d="M6.5 3h11M6.5 21h11" />
        <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
      </Icone>
    ),
  },
  {
    vue: 'habitudes',
    label: 'Habitudes',
    icone: (
      <Icone>
        <path d="M5.5 21V3.5" />
        <path d="M5.5 4.5h12l-2.5 4 2.5 4h-12" />
      </Icone>
    ),
  },
  {
    vue: 'budget',
    label: 'Budget',
    icone: (
      <Icone>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M10 8v8M10 8h2.8a2 2 0 0 1 0 4H10M10 12h3.2a2 2 0 0 1 0 4H10M11.5 6.3V8M11.5 16v1.7" />
      </Icone>
    ),
  },
  {
    vue: 'courrier',
    label: 'Courrier',
    icone: (
      <Icone>
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="m3.5 6.5 8.5 6 8.5-6" />
        <circle cx="12" cy="14.5" r="1.8" fill="currentColor" stroke="none" />
      </Icone>
    ),
  },
  {
    vue: 'reseaux',
    label: 'Réseaux',
    icone: (
      <Icone>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
      </Icone>
    ),
  },
  {
    vue: 'going-merry',
    label: 'Going Merry',
    icone: (
      <Icone>
        <path d="M3 15.5h18l-3 4.5H6z" />
        <path d="M12 3v12.5" />
        <path d="M12 4c4 1.8 5.5 6 5.5 9.5H12M12 6.5c-2.8 1.6-4 4.4-4 7H12" />
      </Icone>
    ),
  },
];

// La boussole Log Pose : bulle de verre sur socle de bois. Son aiguille pivote
// vers l'onglet choisi (de -66° pour le premier à +66° pour le dernier).
function Boussole({ angle }: { angle: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={styles.boussole} viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-verre`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#8fe3d8" />
          <stop offset="55%" stopColor="#2aa79b" />
          <stop offset="100%" stopColor="#0f5c63" />
        </radialGradient>
        <linearGradient id={`${id}-bois`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2b16d" />
          <stop offset="100%" stopColor="#8c5a26" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="38.5" rx="15" ry="6" fill={`url(#${id}-bois)`} stroke="#4a2e12" strokeWidth="1" />
      <ellipse cx="20" cy="35.5" rx="12.5" ry="4.2" fill="#c8924f" stroke="#4a2e12" strokeWidth="0.8" />
      <circle cx="20" cy="19" r="16" fill={`url(#${id}-verre)`} stroke="#e7c57a" strokeWidth="1.6" />
      <circle cx="20" cy="19" r="11.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
      <g className={styles.aiguille} style={{ transform: `rotate(${angle}deg)` }}>
        <g className={styles.aiguilleVibre}>
          <polygon points="20,7 22.6,19 17.4,19" fill="#c8312a" />
          <polygon points="20,31 22.6,19 17.4,19" fill="#fbf4e4" />
          <circle cx="20" cy="19" r="1.9" fill="#3b2a18" stroke="#e7c57a" strokeWidth="0.8" />
        </g>
      </g>
      <ellipse cx="13.5" cy="10.5" rx="5" ry="2.8" fill="rgba(255,255,255,0.55)" transform="rotate(-32 13.5 10.5)" />
    </svg>
  );
}

export function TopBar({
  numero,
  arc,
  titre,
  totalIles,
  vue,
  onChangerVue,
  nouveautes = {},
}: TopBarProps) {
  const ruban = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const boutons = useRef(new Map<Vue, HTMLButtonElement>());
  const [plaque, setPlaque] = useState<{ x: number; largeur: number } | null>(null);
  const [plaqueAnimee, setPlaqueAnimee] = useState(false);
  const [bords, setBords] = useState({ gauche: false, droite: false });

  const index = Math.max(0, ONGLETS.findIndex((o) => o.vue === vue));
  const angle = -66 + (132 * index) / (ONGLETS.length - 1);

  // La plaque de laiton se cale sous l'onglet actif, et suit les
  // redimensionnements (chargement des polices, fenêtre, etc.).
  useLayoutEffect(() => {
    const mesurer = () => {
      const bouton = boutons.current.get(vue);
      if (bouton) setPlaque({ x: bouton.offsetLeft, largeur: bouton.offsetWidth });
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    if (liste.current) observateur.observe(liste.current);
    return () => observateur.disconnect();
  }, [vue]);

  // Pas de glissade à l'affichage initial : seulement aux changements suivants.
  useEffect(() => {
    if (plaque && !plaqueAnimee) {
      const id = requestAnimationFrame(() => setPlaqueAnimee(true));
      return () => cancelAnimationFrame(id);
    }
  }, [plaque, plaqueAnimee]);

  // Le ruban défile pour garder l'onglet actif au centre.
  useEffect(() => {
    boutons.current.get(vue)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [vue]);

  // Fondu sur les bords quand des onglets sont cachés de ce côté ; la molette
  // verticale fait défiler le ruban à l'horizontale.
  useEffect(() => {
    const el = ruban.current;
    if (!el) return;
    const majBords = () => {
      setBords({
        gauche: el.scrollLeft > 2,
        droite: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    };
    const molette = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    majBords();
    el.addEventListener('scroll', majBords, { passive: true });
    el.addEventListener('wheel', molette, { passive: false });
    const observateur = new ResizeObserver(majBords);
    observateur.observe(el);
    return () => {
      el.removeEventListener('scroll', majBords);
      el.removeEventListener('wheel', molette);
      observateur.disconnect();
    };
  }, []);

  // Page précédente / suivante, en boucle (après la dernière, la première).
  function voisine(delta: number): Vue {
    return ONGLETS[(index + delta + ONGLETS.length) % ONGLETS.length].vue;
  }

  // Sens d'un saut direct vers un onglet (clic, Début / Fin).
  function sensVers(cible: Vue): 1 | -1 {
    return ONGLETS.findIndex((o) => o.vue === cible) >= index ? 1 : -1;
  }

  // Flèches du clavier dans le ruban : on passe d'onglet en onglet.
  function auClavier(e: React.KeyboardEvent) {
    let cible: Vue | null = null;
    let sens: 1 | -1 = 1;
    if (e.key === 'ArrowRight') cible = voisine(1);
    else if (e.key === 'ArrowLeft') [cible, sens] = [voisine(-1), -1];
    else if (e.key === 'Home') [cible, sens] = [ONGLETS[0].vue, -1];
    else if (e.key === 'End') cible = ONGLETS[ONGLETS.length - 1].vue;
    if (!cible) return;
    e.preventDefault();
    onChangerVue(cible, sens);
    const vise = cible;
    requestAnimationFrame(() => boutons.current.get(vise)?.focus());
  }

  const classesRuban = [styles.ruban];
  if (bords.gauche) classesRuban.push(styles.fonduGauche);
  if (bords.droite) classesRuban.push(styles.fonduDroite);

  return (
    <header className={styles.bar}>
      <div className={styles.gauche}>
        <Boussole angle={angle} />
        <div className={styles.cap}>
          <span className={styles.repere}>
            Île {numero} · {arc}
          </span>
          <span className={styles.titre}>{titre}</span>
        </div>
      </div>

      <nav className={styles.tourniquet} aria-label="Pages">
        <button
          type="button"
          className={styles.fleche}
          aria-label="Page précédente"
          onClick={() => onChangerVue(voisine(-1), -1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6 8.5 12l6 6" />
          </svg>
        </button>

        <div ref={ruban} className={classesRuban.join(' ')}>
          <div ref={liste} className={styles.liste} role="tablist" onKeyDown={auClavier}>
            {plaque && (
              <span
                className={plaqueAnimee ? `${styles.plaque} ${styles.plaqueAnimee}` : styles.plaque}
                style={{ transform: `translateX(${plaque.x}px)`, width: plaque.largeur }}
                aria-hidden="true"
              />
            )}
            {ONGLETS.map((o) => {
              const actif = o.vue === vue;
              return (
                <button
                  key={o.vue}
                  ref={(el) => {
                    if (el) boutons.current.set(o.vue, el);
                    else boutons.current.delete(o.vue);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  tabIndex={actif ? 0 : -1}
                  className={actif ? `${styles.onglet} ${styles.ongletActif}` : styles.onglet}
                  onClick={() => onChangerVue(o.vue, sensVers(o.vue))}
                >
                  {o.icone}
                  <span>{o.label}</span>
                  {nouveautes[o.vue] && !actif && (
                    <span className={styles.nouveau} aria-label="nouveau" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className={styles.fleche}
          aria-label="Page suivante"
          onClick={() => onChangerVue(voisine(1), 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9.5 6 6 6-6 6" />
          </svg>
        </button>
      </nav>

      <div className={styles.route} aria-label={`Île ${numero} sur ${totalIles}`}>
        {Array.from({ length: totalIles }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={
              n === numero
                ? `${styles.escale} ${styles.escaleActive}`
                : n < numero
                  ? `${styles.escale} ${styles.escalePassee}`
                  : styles.escale
            }
          />
        ))}
      </div>
    </header>
  );
}
