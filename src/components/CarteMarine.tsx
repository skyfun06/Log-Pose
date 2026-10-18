import type { Ile } from '../types';
import styles from './CarteMarine.module.css';

interface CarteMarineProps {
  iles: Ile[];
  ileActuelle: Ile;
  progression: number; // % de la quête de l'île actuelle
}

// Repère du dessin (unités du viewBox SVG).
const L = 1000;
const H = 500;

// Taille des îles sur la carte.
const ECHELLE_ILE = 1.45;

// Silhouettes d'îles (centrées sur 0,0), utilisées à tour de rôle.
const SILHOUETTES = [
  'M-34 4c-2-12 10-22 22-20 6-9 22-9 28 1 12-1 20 10 16 20-2 9-14 13-24 11-8 7-24 7-32-1-8 1-12-4-10-11z',
  'M-30-6c4-12 20-14 28-7 9-8 26-3 28 9 8 6 4 18-6 19-6 8-20 9-28 3-10 5-24 1-25-9-5-4-4-12 3-15z',
  'M-36 2c0-11 13-17 22-13 4-8 17-11 24-4 10-4 22 3 22 13 6 8-1 17-11 16-7 7-21 6-27 0-10 4-24 0-25-8-4 0-6-2-5-4z',
];

// Position des îles : réparties de gauche à droite, en zigzag.
function positions(n: number) {
  const ys = [292, 168, 304, 180, 284, 172, 298];
  return Array.from({ length: n }, (_, i) => ({
    x: n === 1 ? L / 2 : 96 + (i * 764) / (n - 1),
    y: ys[i % ys.length],
  }));
}

// Courbe douce (Catmull-Rom → Bézier) passant par tous les points.
function tracer(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

// Coupe un titre trop long en deux lignes, au milieu.
function deuxLignes(titre: string): string[] {
  if (titre.length <= 16) return [titre];
  const mots = titre.split(' ');
  let meilleur = 1;
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const gauche = mots.slice(0, i).join(' ').length;
    const diff = Math.abs(gauche - (titre.length - gauche));
    if (diff < ecart) [ecart, meilleur] = [diff, i];
  }
  return [mots.slice(0, meilleur).join(' '), mots.slice(meilleur).join(' ')];
}

// La Red Line : une bande verticale aux bords rocheux, centrée sur x.
function redLine(x: number) {
  const bord = (cote: number, decalage: number) => {
    const points: string[] = [];
    for (let y = -10; y <= H + 10; y += 18) {
      const dx = Math.sin(y * 0.11 + decalage) * 5 + Math.sin(y * 0.37 + decalage) * 3;
      points.push(`${(x + cote + dx).toFixed(1)} ${y}`);
    }
    return points;
  };
  const gauche = bord(-13, 0);
  const droite = bord(13, 2).reverse();
  return `M${[...gauche, ...droite].join(' L')} Z`;
}

function RoseDesVents({ x, y, r }: { x: number; y: number; r: number }) {
  const branches = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const long = i % 2 === 0 ? r : r * 0.55;
    const tx = x + Math.sin(angle) * long;
    const ty = y - Math.cos(angle) * long;
    const lx = x + Math.sin(angle + Math.PI / 2) * r * 0.13;
    const ly = y - Math.cos(angle + Math.PI / 2) * r * 0.13;
    const rx = x + Math.sin(angle - Math.PI / 2) * r * 0.13;
    const ry = y - Math.cos(angle - Math.PI / 2) * r * 0.13;
    return { i, tx, ty, lx, ly, rx, ry };
  });
  return (
    <g className={styles.rose}>
      <circle cx={x} cy={y} r={r * 0.78} className={styles.roseCercle} />
      {branches.map((b) => (
        <g key={b.i}>
          <polygon points={`${b.tx},${b.ty} ${b.lx},${b.ly} ${x},${y}`} className={styles.roseClair} />
          <polygon points={`${b.tx},${b.ty} ${b.rx},${b.ry} ${x},${y}`} className={styles.roseSombre} />
        </g>
      ))}
      <text x={x} y={y - r - 7} className={styles.roseNord}>
        N
      </text>
    </g>
  );
}

export function CarteMarine({ iles, ileActuelle, progression }: CarteMarineProps) {
  const pts = positions(iles.length);
  const indexActuel = Math.max(0, iles.findIndex((i) => i.id === ileActuelle.id));
  const suivante = iles[indexActuel + 1];

  // Route parcourue (jusqu'à l'île actuelle) et route à venir.
  const routeFaite = tracer(pts.slice(0, indexActuel + 1));
  const routeAVenir = tracer(pts.slice(indexActuel));

  // Mers : une zone par arc consécutif, séparées par la Red Line.
  const mers: { arc: string; debut: number; fin: number }[] = [];
  iles.forEach((ile, i) => {
    const derniere = mers[mers.length - 1];
    if (derniere && derniere.arc === ile.arc) derniere.fin = i;
    else mers.push({ arc: ile.arc, debut: i, fin: i });
  });
  const redLines = mers.slice(1).map((m) => (pts[m.debut - 1].x + pts[m.debut].x) / 2);

  const navire = pts[indexActuel];

  return (
    <section className={styles.carte} aria-label="Carte du voyage">
      <div className={styles.cartouche}>
        <span className={styles.eyebrow}>
          Cap actuel · île {ileActuelle.numero} sur {iles.length}
        </span>
        <h2 className={styles.ileTitre}>{ileActuelle.titre}</h2>
        <p className={styles.quete}>{ileActuelle.quete}</p>

        <div className={styles.progression}>
          <div className={styles.progressionLigne}>
            <span>Quête de l'île</span>
            <strong>{progression}%</strong>
          </div>
          <div className={styles.jauge}>
            <div className={styles.jaugeRemplie} style={{ width: `${progression}%` }} />
          </div>
        </div>

        {suivante && (
          <p className={styles.suivante}>
            Ensuite : <em>{suivante.titre}</em>
          </p>
        )}
      </div>

      <div className={styles.dessin}>
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Route des îles, actuellement île ${ileActuelle.numero}`}>
          {/* Lignes de rhumb rayonnant depuis la rose des vents. */}
          <g className={styles.rhumbs}>
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i * Math.PI) / 8;
              return (
                <line key={i} x1={922} y1={86} x2={922 + Math.cos(a) * 1400} y2={86 + Math.sin(a) * 1400} />
              );
            })}
          </g>

          {/* Noms des mers. */}
          {mers.map((m) => {
            const x = (pts[m.debut].x + pts[m.fin].x) / 2;
            return (
              <text key={m.arc + m.debut} x={x} y={H - 22} className={styles.mer}>
                {m.arc}
              </text>
            );
          })}

          {/* Red Line. */}
          {redLines.map((x) => (
            <g key={x} className={styles.redLine}>
              <path d={redLine(x)} />
              <text x={x} y={70} className={styles.redLineNom} transform={`rotate(90 ${x} 70)`}>
                RED LINE
              </text>
            </g>
          ))}

          {/* Route. */}
          <path d={routeAVenir} className={styles.routeAVenir} />
          {indexActuel > 0 && <path d={routeFaite} className={styles.routeFaite} />}

          {/* Îles. */}
          {iles.map((ile, i) => {
            const { x, y } = pts[i];
            const etat = i < indexActuel ? 'passee' : i === indexActuel ? 'actuelle' : 'avenir';
            const lignes = deuxLignes(ile.titre);
            const derniere = i === iles.length - 1;
            return (
              <g key={ile.id} className={`${styles.ile} ${styles[etat]}`}>
                {/* Le contour animé n'a pas d'attribut transform : une animation
                    CSS l'écraserait. Position et échelle sont portées par les g. */}
                <g transform={`translate(${x} ${y}) scale(${ECHELLE_ILE * 1.35})`}>
                  <path d={SILHOUETTES[i % SILHOUETTES.length]} className={styles.rivage} />
                </g>
                <g transform={`translate(${x} ${y}) scale(${ECHELLE_ILE})`}>
                  <path d={SILHOUETTES[i % SILHOUETTES.length]} className={styles.terre} />
                </g>
                {etat === 'passee' && (
                  <path d={`M${x - 10} ${y - 2} l7 7 14-15`} className={styles.coche} />
                )}
                {derniere && etat !== 'passee' && (
                  <path d={`M${x - 11} ${y - 11} l22 22 M${x + 11} ${y - 11} l-22 22`} className={styles.croix} />
                )}
                <text x={x} y={y + 60} className={styles.numero}>
                  {ile.numero}
                </text>
                {lignes.map((l, k) => (
                  <text key={l} x={x} y={y + 86 + k * 25} className={styles.nomIle}>
                    {l}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Le Going Merry, ancré à l'île actuelle. */}
          <g transform={`translate(${navire.x + 40} ${navire.y - 58}) scale(1.4)`}>
            <g className={styles.navire}>
              <ellipse cx="0" cy="22" rx="30" ry="6" className={styles.sillage} />
              <path d="M-24 8h48l-8 13h-32z" className={styles.coque} />
              <path d="M0-26v34" className={styles.mat} />
              <path d="M2-24c13 5 17 17 17 27H2z" className={styles.voile} />
              <path d="M-2-18c-10 5-13 13-13 21h13z" className={styles.voile} />
              <path d="M0-26l11 4-11 4z" className={styles.pavillon} />
            </g>
          </g>

          <RoseDesVents x={922} y={86} r={50} />
        </svg>
      </div>
    </section>
  );
}
