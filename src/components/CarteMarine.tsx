import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { avancementEtapes, type ResultatEtape } from '../state/useGameState';
import type { Difficulte, Etape, Ile } from '../types';
import { NOMS_DIFFICULTE } from '../data/difficulte';
import { Cranes } from './Cranes';
import { Navire } from './Navire';
import styles from './CarteMarine.module.css';

interface CarteMarineProps {
  iles: Ile[];
  ileActuelle: Ile; // île visée (ou la dernière, une fois tout conquis)
  ilesConquises: Record<number, string>;
  etapes: Record<number, Etape[]>;
  niveauNavire: number; // le navire de la carte est celui du palier de prime
  carnet: { serie: number; recrues: number; totalEquipage: number };
  onBasculerEtape: (ileId: number, etapeId: string) => ResultatEtape | null;
  onAjouterEtape: (ileId: number, texte: string, difficulte: Difficulte) => void;
  onSupprimerEtape: (ileId: number, etapeId: string) => void;
  onRevenir: () => void;
  onOuvrirCarnet: () => void;
  // Appelé quand le navire a fini une traversée (pour fêter une conquête).
  onFinNavigation?: () => void;
}

// Repère du dessin (unités du viewBox SVG). La carte s'allonge avec le
// nombre d'îles : on la fait défiler, et elle suit le navire.
const H = 420;
const PREMIERE_ILE = 190;
const ESPACEMENT = 178;

function largeurCarte(n: number) {
  return PREMIERE_ILE + (n - 1) * ESPACEMENT + 240;
}

const ECHELLE_ILE = 1.3;

// Le navire mouille un peu après l'île conquise, et s'arrête un peu avant
// l'île visée tant qu'elle n'est pas conquise.
const MOUILLAGE = 50;
const APPROCHE = 46;

// Village de départ, avant la première île.
const DEPART = { x: 60, y: 322 };

// Largeur du dessin du navire selon son niveau : la barque est petite dans
// son cadre, on la grossit davantage que le vaisseau-amiral.
const TAILLE_NAVIRE = [230, 200, 180, 165, 155];

const SILHOUETTES = [
  'M-34 4c-2-12 10-22 22-20 6-9 22-9 28 1 12-1 20 10 16 20-2 9-14 13-24 11-8 7-24 7-32-1-8 1-12-4-10-11z',
  'M-30-6c4-12 20-14 28-7 9-8 26-3 28 9 8 6 4 18-6 19-6 8-20 9-28 3-10 5-24 1-25-9-5-4-4-12 3-15z',
  'M-36 2c0-11 13-17 22-13 4-8 17-11 24-4 10-4 22 3 22 13 6 8-1 17-11 16-7 7-21 6-27 0-10 4-24 0-25-8-4 0-6-2-5-4z',
];

// Petites vagues dessinées çà et là sur la mer (x, y, délai d'animation),
// réparties pseudo-aléatoirement mais toujours aux mêmes endroits.
function vagues(largeur: number): [number, number, number][] {
  const liste: [number, number, number][] = [];
  for (let k = 0; k < Math.round(largeur / 85); k++) {
    const x = 40 + ((k * 211) % (largeur - 80));
    const y = 50 + ((k * 137) % 300);
    liste.push([x, y, (k * 0.7) % 4]);
  }
  return liste;
}

function positions(n: number) {
  const ys = [250, 140, 262, 150, 244, 146, 258];
  return Array.from({ length: n }, (_, i) => ({
    x: PREMIERE_ILE + i * ESPACEMENT,
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
    <g>
      <circle cx={x} cy={y} r={r * 0.78} className={styles.roseCercle} />
      {branches.map((b) => (
        <g key={b.i}>
          <polygon
            points={`${b.tx},${b.ty} ${b.lx},${b.ly} ${x},${y}`}
            className={styles.roseClair}
          />
          <polygon
            points={`${b.tx},${b.ty} ${b.rx},${b.ry} ${x},${y}`}
            className={styles.roseSombre}
          />
        </g>
      ))}
      <text x={x} y={y - r - 7} className={styles.roseNord}>
        N
      </text>
    </g>
  );
}

const douceur = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

interface Geometrie {
  total: number; // longueur de la route
  iles: number[]; // distance de chaque île le long de la route
}

// Géométrie déjà mesurée, par tracé de route.
const geometries = new Map<string, Geometrie>();

// Un seul parcours de la route (un point tous les 2 px) : pour chaque île, la
// distance du point le plus proche.
function mesurerRoute(chemin: SVGPathElement, pts: { x: number; y: number }[]): Geometrie {
  const total = chemin.getTotalLength();
  const meilleurs = pts.map(() => ({ distance: 0, ecart: Infinity }));
  for (let d = 0; d <= total; d += 2) {
    const q = chemin.getPointAtLength(d);
    pts.forEach((p, i) => {
      const e = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (e < meilleurs[i].ecart) meilleurs[i] = { distance: d, ecart: e };
    });
  }
  return { total, iles: meilleurs.map((m) => m.distance) };
}

interface Bravo {
  cle: number;
  titre: string;
  detail: string;
  exploit: boolean;
}

export function CarteMarine({
  iles,
  ileActuelle,
  ilesConquises,
  etapes,
  niveauNavire,
  carnet,
  onBasculerEtape,
  onAjouterEtape,
  onSupprimerEtape,
  onRevenir,
  onOuvrirCarnet,
  onFinNavigation,
}: CarteMarineProps) {
  const L = largeurCarte(iles.length);
  const pts = positions(iles.length);
  const indexActuel = Math.max(
    0,
    iles.findIndex((i) => i.id === ileActuelle.id),
  );
  const toutConquis = ilesConquises[ileActuelle.id] !== undefined;
  const avancement = toutConquis ? 1 : avancementEtapes(etapes[ileActuelle.id] ?? []);
  const route = tracer([DEPART, ...pts]);

  const mers: { arc: string; debut: number; fin: number }[] = [];
  iles.forEach((ile, i) => {
    const derniere = mers[mers.length - 1];
    if (derniere && derniere.arc === ile.arc) derniere.fin = i;
    else mers.push({ arc: ile.arc, debut: i, fin: i });
  });
  const redLines = mers.slice(1).map((m) => (pts[m.debut - 1].x + pts[m.debut].x) / 2);

  const defilement = useRef<HTMLDivElement>(null);
  const glisse = useRef<{ x: number; depart: number; bouge: boolean } | null>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const bateau = useRef<SVGGElement>(null);
  const sillage = useRef<SVGPathElement>(null);
  const traceFaite = useRef<SVGPathElement>(null);
  const finNavigation = useRef(onFinNavigation);
  useLayoutEffect(() => {
    finNavigation.current = onFinNavigation;
  });

  const [geo, setGeo] = useState<Geometrie | null>(() => geometries.get(route) ?? null);
  const [navigue, setNavigue] = useState(false);
  const [arrivee, setArrivee] = useState<number | null>(null);
  const [fiche, setFiche] = useState<number | null>(null);
  const [coteDeLaFiche, setCoteDeLaFiche] = useState<'gauche' | 'droite'>('droite');
  const [bravo, setBravo] = useState<Bravo | null>(null);

  // Mesure la route : où chaque île se trouve le long du tracé (une seule fois
  // par tracé, puis gardé en mémoire pour les retours sur la carte).
  useLayoutEffect(() => {
    const chemin = routeRef.current;
    if (!chemin) return;
    let g = geometries.get(route);
    if (!g) {
      g = mesurerRoute(chemin, positions(iles.length));
      geometries.set(route, g);
    }
    setGeo(g);
  }, [route, iles.length]);

  // Où le navire doit être : entre le dernier mouillage et l'île visée, selon
  // la part des étapes faites. Tout conquis : au mouillage de la dernière île.
  let cible: number | null = null;
  if (geo) {
    const n = geo.iles.length;
    if (toutConquis) cible = geo.iles[n - 1] - MOUILLAGE;
    else {
      const depuis = indexActuel === 0 ? 0 : geo.iles[indexActuel - 1] + MOUILLAGE;
      const vers = geo.iles[indexActuel] - APPROCHE;
      cible = depuis + (vers - depuis) * avancement;
    }
  }

  // Fait défiler la carte pour amener le point x (unités SVG) vers le centre.
  const centrerSur = useCallback(
    (x: number, doux: boolean) => {
      const el = defilement.current;
      if (!el) return;
      const echelle = el.scrollWidth / L;
      el.scrollTo({
        left: x * echelle - el.clientWidth * 0.45,
        behavior: doux ? 'smooth' : 'instant',
      });
    },
    [L],
  );

  const placer = useCallback(
    (d: number, sens: 1 | -1, trace: number, sillageVisible: boolean) => {
      const chemin = routeRef.current;
      if (!chemin || !geo) return;
      const dd = borne(d, 0, geo.total);
      const p = chemin.getPointAtLength(dd);
      const a = chemin.getPointAtLength(borne(dd - 3, 0, geo.total));
      const b = chemin.getPointAtLength(borne(dd + 3, 0, geo.total));
      const angle = borne((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, -24, 24);
      bateau.current?.setAttribute(
        'transform',
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${sens} 1)`,
      );
      traceFaite.current?.setAttribute('stroke-dasharray', `${trace.toFixed(1)} ${geo.total + 20}`);
      // En route, la carte suit le navire (sauf si on la fait glisser).
      if (sillageVisible && !glisse.current?.bouge) centrerSur(p.x, false);
      if (sillage.current) {
        const long = 120;
        const debut = sens === 1 ? Math.max(0, dd - long) : dd;
        const longueur = sens === 1 ? Math.min(dd, long) : Math.min(geo.total - dd, long);
        sillage.current.setAttribute(
          'stroke-dasharray',
          sillageVisible
            ? `0 ${debut.toFixed(1)} ${longueur.toFixed(1)} ${geo.total + 20}`
            : `0 ${geo.total + 20}`,
        );
      }
    },
    [geo, centrerSur],
  );

  // Navigation : quand la cible change, le navire file le long de la route ;
  // au mouillage, il dérive doucement.
  const position = useRef<number | null>(null);
  useEffect(() => {
    if (!geo || cible === null) return;
    const but = cible;
    if (position.current === null) {
      const chemin = routeRef.current;
      if (chemin) centrerSur(chemin.getPointAtLength(but).x, false);
    }
    const depart = position.current ?? but;
    // Point de départ de la prochaine traversée, même sans navigation (premier
    // affichage) : sans ça, le prochain changement ferait sauter le navire.
    position.current = depart;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const distance = Math.abs(but - depart);
    const duree = reduit || distance < 1 ? 0 : borne(1200 + distance * 5, 1500, 6500);
    const sens: 1 | -1 = but < depart ? -1 : 1;

    if (reduit) {
      position.current = but;
      placer(but, 1, but, false);
      if (distance >= 1) finNavigation.current?.();
      return;
    }

    let id = 0;
    let finie = duree === 0;
    if (finie) position.current = but;
    let finLe = performance.now();
    const debut = performance.now();
    if (duree > 0) setNavigue(true);
    const image = (t: number) => {
      if (!finie) {
        const x = Math.min(1, (t - debut) / duree);
        const d = depart + (but - depart) * douceur(x);
        position.current = d;
        placer(d, sens, d, true);
        if (x >= 1) {
          finie = true;
          position.current = but;
          finLe = t;
          setNavigue(false);
          setArrivee(Date.now());
          finNavigation.current?.();
        }
      } else {
        const amplitude = 9 * Math.min(1, (t - finLe) / 1500);
        const d = but + Math.sin((t - finLe) / 1100) * amplitude;
        placer(d, 1, but, false);
      }
      id = requestAnimationFrame(image);
    };
    id = requestAnimationFrame(image);
    return () => cancelAnimationFrame(id);
  }, [geo, cible, placer, centrerSur]);

  // La molette verticale fait défiler la carte à l'horizontale.
  useEffect(() => {
    const el = defilement.current;
    if (!el) return;
    const molette = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', molette, { passive: false });
    return () => el.removeEventListener('wheel', molette);
  }, []);

  // Côté où poser la fiche : à l'opposé de l'île telle qu'elle est à l'écran.
  function coteFiche(i: number): 'gauche' | 'droite' {
    const el = defilement.current;
    if (!el) return 'droite';
    const x = pts[i].x * (el.scrollWidth / L) - el.scrollLeft;
    return x < el.clientWidth / 2 ? 'droite' : 'gauche';
  }
  // Mesuré au clic (la position à l'écran dépend du défilement).
  function basculerFiche(i: number) {
    setCoteDeLaFiche(coteFiche(i));
    setFiche((f) => (f === i ? null : i));
  }

  useEffect(() => {
    if (arrivee === null) return;
    const t = setTimeout(() => setArrivee(null), 1800);
    return () => clearTimeout(t);
  }, [arrivee]);

  useEffect(() => {
    if (!bravo) return;
    const t = setTimeout(() => setBravo(null), bravo.exploit ? 3200 : 2400);
    return () => clearTimeout(t);
  }, [bravo]);

  useEffect(() => {
    if (fiche === null) return;
    const fermer = (e: KeyboardEvent) => e.key === 'Escape' && setFiche(null);
    window.addEventListener('keydown', fermer);
    return () => window.removeEventListener('keydown', fermer);
  }, [fiche]);

  function cocher(ile: Ile, etape: Etape) {
    const r = onBasculerEtape(ile.id, etape.id);
    if (!r || !r.faite) return;
    const liste = etapes[ile.id] ?? [];
    const total = liste.reduce((t, e) => t + e.difficulte, 0) || 1;
    const part = Math.round((etape.difficulte / total) * 100);
    if (r.conquise) {
      setFiche(null); // laisse voir le navire accoster
      setBravo({
        cle: Date.now(),
        titre: 'Terre !',
        detail: `${ile.nom} est en vue`,
        exploit: true,
      });
    } else {
      setBravo({
        cle: Date.now(),
        titre: etape.difficulte === 3 ? 'Exploit !' : 'Objectif accompli',
        detail: `${etape.texte} · +${part} % du trajet`,
        exploit: etape.difficulte === 3,
      });
    }
  }

  // Seule la conquête la plus récente peut être annulée.
  const derniereConquete = Object.entries(ilesConquises).sort((a, b) =>
    b[1].localeCompare(a[1]),
  )[0];
  const indexAnnulable = derniereConquete
    ? iles.findIndex((i) => i.id === Number(derniereConquete[0]))
    : -1;

  return (
    <section className={styles.carte} aria-label="Carte du voyage">
      <div className={styles.dessin}>
        <div
          ref={defilement}
          className={styles.defilement}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            glisse.current = { x: e.clientX, depart: e.currentTarget.scrollLeft, bouge: false };
          }}
          onPointerMove={(e) => {
            const g = glisse.current;
            if (!g) return;
            const dx = e.clientX - g.x;
            if (Math.abs(dx) > 4) g.bouge = true;
            if (g.bouge) e.currentTarget.scrollLeft = g.depart - dx;
          }}
          onPointerUp={() => {
            // Le clic qui termine un glissé ne doit pas ouvrir d'île.
            const g = glisse.current;
            setTimeout(() => {
              if (glisse.current === g) glisse.current = null;
            }, 0);
          }}
          onPointerLeave={() => (glisse.current = null)}
          onClickCapture={(e) => {
            if (glisse.current?.bouge) e.stopPropagation();
          }}
        >
          <svg
            viewBox={`0 0 ${L} ${H}`}
            style={{ aspectRatio: `${L} / ${H}`, '--largeur-carte': `${L}px` } as CSSProperties}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Route des îles : cap sur l'île ${ileActuelle.numero}, ${Math.round(avancement * 100)} % du trajet`}
            onClick={() => setFiche(null)}
          >
            <defs>
              <mask
                id="carte-route-faite"
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width={L}
                height={H}
              >
                <path
                  ref={traceFaite}
                  d={route}
                  className={styles.masqueRoute}
                  strokeDasharray={`0 ${L * 4}`}
                />
              </mask>
              <filter id="carte-flou" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>

            <g className={styles.rhumbs}>
              {Array.from({ length: 16 }, (_, i) => {
                const a = (i * Math.PI) / 8;
                return (
                  <line
                    key={i}
                    x1={L - 70}
                    y1={70}
                    x2={L - 70 + Math.cos(a) * 1400}
                    y2={70 + Math.sin(a) * 1400}
                  />
                );
              })}
            </g>

            {vagues(L).map(([x, y, delai], i) => (
              <path
                key={i}
                d={`M${x - 12} ${y}q6 -5 12 0t12 0`}
                className={styles.vaguelette}
                style={{ animationDelay: `-${delai}s` }}
              />
            ))}

            {mers.map((m) => {
              const x = (pts[m.debut].x + pts[m.fin].x) / 2;
              return (
                <text key={m.arc + m.debut} x={x} y={H - 16} className={styles.mer}>
                  {m.arc}
                </text>
              );
            })}

            {redLines.map((x) => (
              <g key={x} className={styles.redLine}>
                <path d={redLine(x)} />
                <text x={x} y={60} className={styles.redLineNom} transform={`rotate(90 ${x} 60)`}>
                  RED LINE
                </text>
              </g>
            ))}

            {/* Village de départ. */}
            <g aria-hidden="true">
              <path
                d={`M${DEPART.x - 24} ${DEPART.y + 12}q24 -18 48 0z`}
                className={styles.villageTerre}
              />
              <path
                d={`M${DEPART.x - 13} ${DEPART.y + 5}v-10l7 -6l7 6v10z`}
                className={styles.villageMaison}
              />
              <path
                d={`M${DEPART.x + 3} ${DEPART.y + 7}v-7l5 -4l5 4v7z`}
                className={styles.villageMaison}
              />
              <text x={DEPART.x} y={DEPART.y + 32} className={styles.villageNom}>
                Départ
              </text>
            </g>

            {/* Route : pointillés à venir, trait rouge révélé jusqu'au navire. */}
            <path ref={routeRef} d={route} className={styles.routeAVenir} />
            <path d={route} className={styles.routeFaite} mask="url(#carte-route-faite)" />
            <path
              ref={sillage}
              d={route}
              className={navigue ? `${styles.sillage} ${styles.sillageVisible}` : styles.sillage}
            />

            {iles.map((ile, i) => {
              const { x, y } = pts[i];
              const conquise = ilesConquises[ile.id] !== undefined;
              const etat = conquise ? 'passee' : i === indexActuel ? 'actuelle' : 'avenir';
              const lignes = deuxLignes(ile.nom);
              const derniere = i === iles.length - 1;
              const liste = etapes[ile.id] ?? [];
              const faites = liste.filter((e) => e.faiteLe).length;
              return (
                <g
                  key={ile.id}
                  className={[styles.ile, styles[etat], fiche === i ? styles.choisie : ''].join(
                    ' ',
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={`Île ${ile.numero}, ${ile.nom} : ${ile.titre}, ${faites} étapes sur ${liste.length}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    basculerFiche(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      basculerFiche(i);
                    }
                  }}
                >
                  <circle cx={x} cy={y + 20} r="62" className={styles.zoneClic} />
                  <g transform={`translate(${x} ${y}) scale(${ECHELLE_ILE * 1.35})`}>
                    <path d={SILHOUETTES[i % SILHOUETTES.length]} className={styles.rivage} />
                  </g>
                  <g transform={`translate(${x} ${y}) scale(${ECHELLE_ILE})`}>
                    <path d={SILHOUETTES[i % SILHOUETTES.length]} className={styles.terre} />
                  </g>
                  <path d={`M${x + 8} ${y - 4}q2 -14 -2 -24`} className={styles.palmierTronc} />
                  <path
                    d={`M${x + 6} ${y - 28}q-10 -2 -16 6M${x + 6} ${y - 28}q10 -4 16 3M${x + 6} ${y - 28}q-2 -10 -10 -12M${x + 6} ${y - 28}q6 -8 14 -7`}
                    className={styles.palmierFeuilles}
                  />
                  {conquise && (
                    <g className={styles.drapeau} transform={`translate(${x - 14} ${y - 6})`}>
                      <line x1="0" y1="0" x2="0" y2="-34" className={styles.hampe} />
                      <path
                        d="M0 -34q8 -3 16 0t14 0v12q-7 3 -14 0t-16 0z"
                        className={styles.etendard}
                      />
                      <circle cx="13" cy="-28" r="2.4" className={styles.etendardCrane} />
                    </g>
                  )}
                  {derniere && !conquise && (
                    <path
                      d={`M${x - 11} ${y - 11} l22 22 M${x + 11} ${y - 11} l-22 22`}
                      className={styles.croix}
                    />
                  )}
                  {/* Pastilles d'étapes : une par étape, pleine quand elle est faite. */}
                  {liste.map((e, k) => (
                    <circle
                      key={e.id}
                      cx={x + (k - (liste.length - 1) / 2) * 11}
                      cy={y + 36}
                      r="3.6"
                      className={e.faiteLe ? styles.pastilleFaite : styles.pastille}
                    />
                  ))}
                  <text x={x} y={y + 60} className={styles.numero}>
                    {ile.numero}
                  </text>
                  {lignes.map((l, k) => (
                    <text key={l} x={x} y={y + 82 + k * 22} className={styles.nomIle}>
                      {l}
                    </text>
                  ))}
                </g>
              );
            })}

            <g className={styles.mouettes} aria-hidden="true">
              <path
                d="M0 0q6 -6 12 0q6 -6 12 0"
                className={`${styles.mouette} ${styles.mouette1}`}
              />
              <path
                d="M0 0q5 -5 10 0q5 -5 10 0"
                className={`${styles.mouette} ${styles.mouette2}`}
              />
              <path d="M0 0q4 -4 8 0q4 -4 8 0" className={`${styles.mouette} ${styles.mouette3}`} />
            </g>

            <g
              ref={bateau}
              className={styles.bateau}
              transform={`translate(${DEPART.x} ${DEPART.y})`}
            >
              <ellipse cx="0" cy="4" rx="34" ry="7" className={styles.remous} />
              <ellipse
                cx="0"
                cy="4"
                rx="34"
                ry="7"
                className={`${styles.remous} ${styles.remous2}`}
              />
              {arrivee && (
                <ellipse key={arrivee} cx="0" cy="4" rx="34" ry="7" className={styles.gerbe} />
              )}
              <g
                className={navigue ? `${styles.coqueBateau} ${styles.enRoute}` : styles.coqueBateau}
              >
                <Navire
                  niveau={niveauNavire}
                  sansVagues
                  x={-TAILLE_NAVIRE[niveauNavire] / 2}
                  y={-TAILLE_NAVIRE[niveauNavire] * 0.51}
                  width={TAILLE_NAVIRE[niveauNavire]}
                  height={TAILLE_NAVIRE[niveauNavire] * 0.633}
                />
              </g>
            </g>

            <g className={styles.nuages} filter="url(#carte-flou)" aria-hidden="true">
              <ellipse
                cx="0"
                cy="110"
                rx="120"
                ry="38"
                className={`${styles.nuage} ${styles.nuage1}`}
              />
              <ellipse
                cx="0"
                cy="300"
                rx="160"
                ry="44"
                className={`${styles.nuage} ${styles.nuage2}`}
              />
            </g>

            <RoseDesVents x={L - 70} y={70} r={44} />
          </svg>
        </div>

        {/* Cap et carnet, en haut à gauche. */}
        <div className={styles.entete}>
          <button
            type="button"
            className={styles.cap}
            onClick={() => {
              if (geo) centrerSur(pts[indexActuel].x, true);
              setFiche(indexActuel);
            }}
            title="Voir les étapes de la quête"
          >
            <span className={styles.capEtiquette}>
              {toutConquis ? 'Voyage accompli' : `Cap sur l'île ${ileActuelle.numero}`}
            </span>
            <span className={styles.capJauge}>
              <span style={{ width: `${avancement * 100}%` }} />
            </span>
            <span className={styles.capPourcent}>{Math.round(avancement * 100)} %</span>
          </button>
          <button
            type="button"
            className={styles.carnet}
            onClick={onOuvrirCarnet}
            title="Équipage et exploits"
          >
            <span
              className={
                carnet.serie > 0 ? styles.flamme : `${styles.flamme} ${styles.flammeEteinte}`
              }
              aria-hidden="true"
            >
              <svg viewBox="0 0 16 16">
                <path d="M8 1.5c.6 2.6 3.9 4 3.9 7.6A3.9 3.9 0 0 1 8 13.4a3.9 3.9 0 0 1-3.9-4.3c.2-1.7 1.3-2.6 1.8-3.8.4 1 .8 1.6 1.4 1.9C7.5 5.4 7.5 3.4 8 1.5z" />
              </svg>
            </span>
            <span>
              <strong>{carnet.serie}</strong> j de série
            </span>
            <span className={styles.carnetSep}>·</span>
            <span>
              équipage <strong>{carnet.recrues}</strong>/{carnet.totalEquipage}
            </span>
          </button>
        </div>

        {bravo && (
          <div
            key={bravo.cle}
            className={bravo.exploit ? `${styles.bravo} ${styles.bravoExploit}` : styles.bravo}
            role="status"
          >
            <span className={styles.bravoEclat} aria-hidden="true" />
            <strong>{bravo.titre}</strong>
            <span>{bravo.detail}</span>
          </div>
        )}

        {fiche !== null && (
          <FicheIle
            key={fiche}
            ile={iles[fiche]}
            cote={fiche === indexActuel ? 'droite' : coteDeLaFiche}
            etat={
              ilesConquises[iles[fiche].id]
                ? 'conquise'
                : fiche === indexActuel
                  ? 'visee'
                  : 'avenir'
            }
            etapes={etapes[iles[fiche].id] ?? []}
            conquiseLe={ilesConquises[iles[fiche].id] ?? null}
            ecart={fiche - indexActuel}
            annulable={fiche === indexAnnulable}
            onCocher={(e) => cocher(iles[fiche], e)}
            onAjouter={(t, d) => onAjouterEtape(iles[fiche].id, t, d)}
            onSupprimer={(id) => onSupprimerEtape(iles[fiche].id, id)}
            onRevenir={() => {
              setFiche(null);
              onRevenir();
            }}
            onFermer={() => setFiche(null)}
          />
        )}
      </div>
    </section>
  );
}

interface FicheIleProps {
  ile: Ile;
  cote: 'gauche' | 'droite';
  etat: 'conquise' | 'visee' | 'avenir';
  etapes: Etape[];
  conquiseLe: string | null;
  ecart: number;
  annulable: boolean;
  onCocher: (e: Etape) => void;
  onAjouter: (texte: string, difficulte: Difficulte) => void;
  onSupprimer: (id: string) => void;
  onRevenir: () => void;
  onFermer: () => void;
}

// Fiche d'une île, posée sur le côté de la carte opposé à l'île : sa quête et
// ses étapes. Seules les étapes de l'île visée se cochent ; on peut préparer
// celles des îles suivantes à l'avance.
function FicheIle({
  ile,
  cote,
  etat,
  etapes,
  conquiseLe,
  ecart,
  annulable,
  onCocher,
  onAjouter,
  onSupprimer,
  onRevenir,
  onFermer,
}: FicheIleProps) {
  const [texte, setTexte] = useState('');
  const [difficulte, setDifficulte] = useState<Difficulte>(2);
  const avancement = avancementEtapes(etapes);

  function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!texte.trim()) return;
    onAjouter(texte, difficulte);
    setTexte('');
  }

  return (
    <aside
      className={styles.fiche}
      data-cote={cote}
      aria-label={`Île ${ile.numero} : ${ile.nom}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className={styles.ficheFermer} onClick={onFermer} aria-label="Fermer">
        ×
      </button>
      <span className={styles.ficheRepere}>
        Île {ile.numero} · {ile.arc}
        {etat === 'visee' && ' · cap actuel'}
      </span>
      <h3 className={styles.ficheTitre}>{ile.nom}</h3>
      <p className={styles.ficheObjectif}>{ile.titre}</p>
      <p className={styles.ficheSituation}>{ile.situation}</p>
      <p className={styles.ficheQuete}>
        <span>Quête</span> {ile.quete}
      </p>
      <p className={styles.fichePourquoi}>
        <span>Pourquoi</span> {ile.pourquoi}
      </p>

      {etat === 'visee' && (
        <div className={styles.ficheJauge} title={`${Math.round(avancement * 100)} % du trajet`}>
          <span style={{ width: `${avancement * 100}%` }} />
        </div>
      )}
      {etat === 'conquise' && conquiseLe && (
        <p className={styles.ficheConquise}>⚑ Conquise le {dateCourte(conquiseLe)}</p>
      )}
      {etat === 'avenir' && (
        <p className={styles.ficheAvenir}>
          À l'horizon : encore {ecart} île{ecart > 1 ? 's' : ''} avant. Prépare déjà tes étapes.
        </p>
      )}

      <ul className={styles.etapes}>
        {etapes.map((e) => (
          <li
            key={e.id}
            className={e.faiteLe ? `${styles.etape} ${styles.etapeFaite}` : styles.etape}
          >
            <button
              type="button"
              className={styles.case}
              disabled={etat !== 'visee'}
              onClick={() => onCocher(e)}
              aria-pressed={!!e.faiteLe}
              aria-label={e.faiteLe ? `Décocher : ${e.texte}` : `Accomplir : ${e.texte}`}
            >
              {e.faiteLe && (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8.5 3.2 3L13 4.5" />
                </svg>
              )}
            </button>
            <span className={styles.etapeTexte}>
              {e.texte}
              {e.faiteLe && <em> · {dateCourte(e.faiteLe)}</em>}
            </span>
            <Cranes niveau={e.difficulte} />
            {etat !== 'conquise' && !e.faiteLe && (
              <button
                type="button"
                className={styles.etapeSupprimer}
                onClick={() => onSupprimer(e.id)}
                aria-label={`Supprimer : ${e.texte}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
        {etapes.length === 0 && (
          <li className={styles.etapesVide}>Aucune étape : ajoute la première.</li>
        )}
      </ul>

      {etat !== 'conquise' && (
        <form className={styles.ajout} onSubmit={ajouter}>
          <input
            type="text"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Nouvelle étape…"
            className={styles.ajoutChamp}
          />
          <div className={styles.ajoutLigne}>
            <div className={styles.difficultes} role="radiogroup" aria-label="Difficulté">
              {([1, 2, 3] as Difficulte[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={difficulte === d}
                  className={
                    difficulte === d
                      ? `${styles.difficulte} ${styles.difficulteChoisie}`
                      : styles.difficulte
                  }
                  onClick={() => setDifficulte(d)}
                >
                  <Cranes niveau={d} />
                  {NOMS_DIFFICULTE[d]}
                </button>
              ))}
            </div>
            <button type="submit" className={styles.ajoutBouton} disabled={!texte.trim()}>
              Ajouter
            </button>
          </div>
        </form>
      )}

      {annulable && (
        <button type="button" className={styles.ficheAnnuler} onClick={onRevenir}>
          Annuler la conquête
        </button>
      )}
    </aside>
  );
}
