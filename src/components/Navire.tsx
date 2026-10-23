import { NAVIRES } from '../data/paliers';
import styles from './Navire.module.css';

// Le navire du joueur, gravé au trait : il grandit avec les paliers (coque
// plus longue, plus de mâts et de voiles, pavillon puis dorures).
// niveau = index dans NAVIRES (0 barque … 4 vaisseau-amiral).

interface Gabarit {
  x0: number; // poupe
  x1: number; // proue
  pont: number;
  quille: number;
  chateau: number; // hauteur du château arrière (0 = aucun)
  mats: { x: number; h: number; voiles: number }[];
  latine: boolean; // voile triangulaire (barque, caravelle)
  pavillon: boolean;
  dorures: boolean;
}

const GABARITS: Gabarit[] = [
  {
    x0: 42,
    x1: 80,
    pont: 55,
    quille: 61,
    chateau: 0,
    mats: [{ x: 60, h: 26, voiles: 0 }],
    latine: true,
    pavillon: false,
    dorures: false,
  },
  {
    x0: 32,
    x1: 90,
    pont: 54,
    quille: 62,
    chateau: 4,
    mats: [
      { x: 50, h: 30, voiles: 1 },
      { x: 70, h: 26, voiles: 0 },
    ],
    latine: true,
    pavillon: false,
    dorures: false,
  },
  {
    x0: 26,
    x1: 96,
    pont: 53,
    quille: 62,
    chateau: 5,
    mats: [
      { x: 48, h: 36, voiles: 2 },
      { x: 72, h: 34, voiles: 2 },
    ],
    latine: false,
    pavillon: true,
    dorures: false,
  },
  {
    x0: 18,
    x1: 104,
    pont: 52,
    quille: 63,
    chateau: 8,
    mats: [
      { x: 38, h: 32, voiles: 2 },
      { x: 60, h: 42, voiles: 3 },
      { x: 82, h: 36, voiles: 2 },
    ],
    latine: false,
    pavillon: true,
    dorures: false,
  },
  {
    x0: 10,
    x1: 112,
    pont: 51,
    quille: 64,
    chateau: 10,
    mats: [
      { x: 32, h: 36, voiles: 3 },
      { x: 58, h: 46, voiles: 3 },
      { x: 84, h: 40, voiles: 3 },
    ],
    latine: false,
    pavillon: true,
    dorures: true,
  },
];

function voileCarree(x: number, y: number, w: number, h: number) {
  return `M${x - w} ${y}L${x + w} ${y}Q${x + w + 1.6} ${y + h / 2} ${x + w - 1} ${y + h}Q${x} ${y + h + 3} ${x - w + 1} ${y + h}Q${x - w - 1.6} ${y + h / 2} ${x - w} ${y}Z`;
}

interface NavireProps {
  niveau: number;
  className?: string;
  // Placement quand le navire est dessiné dans un autre SVG (carte marine).
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sansVagues?: boolean;
}

export function Navire({ niveau, className, x, y, width, height, sansVagues }: NavireProps) {
  const g = GABARITS[Math.max(0, Math.min(GABARITS.length - 1, niveau))];
  const milieu = (g.x0 + g.x1) / 2;
  const plusHaut = g.mats.reduce((a, b) => (b.h > a.h ? b : a));

  const coque = [
    `M${g.x0} ${g.pont - g.chateau}`,
    `L${g.x0 + 10} ${g.pont - g.chateau}`,
    `L${g.x0 + 12} ${g.pont}`,
    `Q${milieu} ${g.pont + 2} ${g.x1} ${g.pont - 4}`,
    `Q${g.x1 - 4} ${g.quille - 2} ${g.x1 - 10} ${g.quille}`,
    `L${g.x0 + 6} ${g.quille}`,
    `Q${g.x0 + 1} ${g.quille - 2} ${g.x0} ${g.pont - g.chateau}Z`,
  ].join('');

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      className={[styles.navire, g.dorures ? styles.dore : '', className ?? ''].join(' ')}
      viewBox="0 0 120 76"
      role="img"
      aria-label={NAVIRES[niveau]}
    >
      {/* Mâts et voiles */}
      {g.mats.map((m, i) => {
        const haut = g.pont - m.h;
        const hauteurVoile = (m.h - 8) / Math.max(1, m.voiles);
        const largeur = 5 + m.h / 7;
        return (
          <g key={i}>
            <line x1={m.x} y1={g.pont} x2={m.x} y2={haut - 2} className={styles.mat} />
            {Array.from({ length: m.voiles }, (_, v) => (
              <path
                key={v}
                d={voileCarree(
                  m.x,
                  haut + 2 + v * hauteurVoile,
                  largeur - v * 0.6,
                  hauteurVoile - 2.5,
                )}
                className={styles.voile}
              />
            ))}
          </g>
        );
      })}
      {g.latine && (
        <path
          d={`M${g.mats[g.mats.length - 1].x + 1} ${g.pont - g.mats[g.mats.length - 1].h}L${g.mats[g.mats.length - 1].x + 1} ${g.pont - 4}L${g.x1 - 2} ${g.pont - 5}Z`}
          className={styles.voile}
        />
      )}
      {/* Beaupré */}
      {niveau > 0 && (
        <line x1={g.x1 - 3} y1={g.pont - 4} x2={g.x1 + 8} y2={g.pont - 12} className={styles.mat} />
      )}

      {/* Pavillon pirate au sommet du plus grand mât */}
      {g.pavillon && (
        <g>
          <path
            d={`M${plusHaut.x} ${g.pont - plusHaut.h - 2}q5 -2 10 0t0 6q-5 -2 -10 0z`}
            className={styles.pavillon}
          />
          <circle
            cx={plusHaut.x + 5}
            cy={g.pont - plusHaut.h + 1}
            r="1.1"
            className={styles.crane}
          />
        </g>
      )}
      {/* Fanions des autres mâts (vaisseau-amiral) */}
      {g.dorures &&
        g.mats
          .filter((m) => m !== plusHaut)
          .map((m, i) => (
            <path
              key={i}
              d={`M${m.x} ${g.pont - m.h - 2}l7 1.5l-7 1.5z`}
              className={styles.fanion}
            />
          ))}

      <path d={coque} className={styles.coque} />
      {/* Bordages et sabords */}
      <path
        d={`M${g.x0 + 4} ${g.pont + 3}Q${milieu} ${g.pont + 5} ${g.x1 - 4} ${g.pont - 1}`}
        className={styles.bordage}
      />
      {niveau >= 2 &&
        Array.from({ length: niveau + 1 }, (_, i) => {
          const x = g.x0 + 18 + (i * (g.x1 - g.x0 - 34)) / niveau;
          return (
            <rect
              key={i}
              x={x}
              y={g.pont + 4.5}
              width="2.6"
              height="2"
              rx="0.4"
              className={styles.sabord}
            />
          );
        })}
      {g.dorures && (
        <circle cx={g.x0 + 5} cy={g.pont - g.chateau - 3} r="1.6" className={styles.lanterne} />
      )}

      {/* Vagues */}
      {!sansVagues && (
        <>
          <path
            d="M4 66q6 -3 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0"
            className={styles.vague}
          />
          <path
            d="M14 71q6 -2.5 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0"
            className={`${styles.vague} ${styles.vagueLoin}`}
          />
        </>
      )}
    </svg>
  );
}
