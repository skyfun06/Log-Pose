import { useEffect, useRef, useState } from 'react';
import { dateFiche, dateLisible } from '../data/formatCerveau';
import { lierFichiers } from '../data/liensCerveau';
import type { FicheCerveau } from '../types';
import styles from './GrapheCerveau.module.css';

// Graphe du second cerveau, façon Obsidian : chaque fichier est un point relié
// à sa catégorie (gros nœud doré) et aux fichiers qui lui ressemblent vraiment
// (voir data/liensCerveau.ts).
// Simulation de forces maison (répulsion, ressorts, rappel au centre) dessinée
// sur un canvas : on glisse les nœuds, on zoome à la molette, on déplace le
// fond ; le survol allume les voisins et estompe le reste.

interface Noeud {
  id: string;
  type: 'categorie' | 'fichier';
  nom: string;
  meta: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fixe: boolean; // tenu par la souris
}

interface Lien {
  a: number;
  b: number;
  longueur: number;
  force: number;
  categorie: boolean; // fichier → catégorie (sinon fichier ↔ fichier)
  communs?: string[]; // fichier ↔ fichier : les termes qui les relient
}

function construire(fichiers: FicheCerveau[]) {
  const noeuds: Omit<Noeud, 'x' | 'y' | 'vx' | 'vy' | 'fixe'>[] = [];
  const liens: Lien[] = [];
  const indexCategorie = new Map<string, number>();
  const compte = new Map<string, number>();
  for (const f of fichiers) compte.set(f.categorie, (compte.get(f.categorie) ?? 0) + 1);

  for (const [nom, n] of compte) {
    indexCategorie.set(nom, noeuds.length);
    noeuds.push({
      id: `categorie:${nom}`,
      type: 'categorie',
      nom,
      meta: `${n} fichier${n > 1 ? 's' : ''}`,
      r: 7 + Math.sqrt(n) * 2.4,
    });
  }

  const debutFichiers = noeuds.length;
  for (const f of fichiers) {
    noeuds.push({
      id: f.id,
      type: 'fichier',
      nom: f.nom,
      meta: [f.categorie, dateLisible(dateFiche(f))].filter(Boolean).join(' · '),
      r: 4.5,
    });
    liens.push({
      a: noeuds.length - 1,
      b: indexCategorie.get(f.categorie)!,
      longueur: 38,
      force: 0.7,
      categorie: true,
    });
  }

  for (const { a, b, score, communs } of lierFichiers(fichiers)) {
    liens.push({
      a: debutFichiers + a,
      b: debutFichiers + b,
      longueur: 60,
      force: 0.1 + 0.4 * score,
      categorie: false,
      communs,
    });
  }

  // Plus un fichier a de voisins, plus son point est gros (comme Obsidian).
  const degre = new Map<number, number>();
  for (const l of liens) {
    if (l.categorie) continue;
    degre.set(l.a, (degre.get(l.a) ?? 0) + 1);
    degre.set(l.b, (degre.get(l.b) ?? 0) + 1);
  }
  for (const [i, d] of degre) noeuds[i].r += Math.sqrt(d) * 1.3;

  return { noeuds, liens };
}

// --- Composant ---------------------------------------------------------------

interface Couleurs {
  lien: string;
  lienVif: string;
  fichier: string;
  categorie: string;
  texte: string;
  texteDoux: string;
  halo: string;
}

function lireCouleurs(el: HTMLElement): Couleurs {
  const css = getComputedStyle(el);
  const v = (nom: string, defaut: string) => css.getPropertyValue(nom).trim() || defaut;
  return {
    lien: 'rgba(230, 211, 166, 0.16)',
    lienVif: v('--gold-200', '#e7c57a'),
    fichier: v('--parch-200', '#e6d3a6'),
    categorie: v('--gold-200', '#e7c57a'),
    texte: v('--parch-050', '#fff8e8'),
    texteDoux: v('--parch-300', '#d9c090'),
    halo: 'rgba(231, 197, 122, 0.55)',
  };
}

// Réglages de la simulation.
const PORTEE_REPULSION = 220;
const RAPPEL_CENTRE = 0.05;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;

export function GrapheCerveau({
  fichiers,
  onOuvrir,
  onCategorie,
}: {
  fichiers: FicheCerveau[];
  onOuvrir: (id: string) => void;
  onCategorie: (nom: string) => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const [survol, setSurvol] = useState<{
    nom: string;
    meta: string;
    // Fichiers reliés, et pourquoi.
    lies: { nom: string; par: string }[];
    x: number;
    y: number;
  } | null>(null);

  // Le graphe n'est reconstruit que si les fichiers, leurs noms ou leurs
  // mots-clés changent (pas à chaque rafraîchissement de la liste).
  const signature = fichiers
    .map((f) => `${f.id}|${f.nom}|${f.categorie}|${f.note}|${f.analyse.etat === 'faite' ? f.analyse.motsCles.join(',') : ''}`)
    .join('\n');
  const cache = useRef<{ signature: string; graphe: ReturnType<typeof construire> } | null>(null);
  if (cache.current?.signature !== signature) {
    cache.current = { signature, graphe: construire(fichiers) };
  }
  const graphe = cache.current.graphe;

  // État de la simulation et de la vue, gardé hors de React (60 images/s).
  const etat = useRef({
    noeuds: [] as Noeud[],
    liens: [] as Lien[],
    alpha: 1,
    vue: { x: 0, y: 0, zoom: 1 },
    survole: -1,
    voisins: new Set<number>(),
    largeur: 0,
    hauteur: 0,
    aCadrer: true,
    sale: true,
  });

  // Zoom et recentrage, branchés par la boucle de dessin.
  const commandes = useRef<{ zoomer: (f: number) => void; cadrer: () => void } | null>(null);

  // Rappels toujours à jour sans relancer la boucle de dessin.
  const rappels = useRef({ onOuvrir, onCategorie });
  rappels.current = { onOuvrir, onCategorie };

  // Nouveau graphe : on garde la position des nœuds déjà connus.
  useEffect(() => {
    const e = etat.current;
    const anciens = new Map(e.noeuds.map((n) => [n.id, n]));
    const centres = new Map<string, { x: number; y: number }>();
    const nbCategories = graphe.noeuds.filter((n) => n.type === 'categorie').length;
    let k = 0;
    e.noeuds = graphe.noeuds.map((n) => {
      const ancien = anciens.get(n.id);
      if (ancien) return { ...ancien, ...n, fixe: false };
      if (n.type === 'categorie') {
        const angle = (k++ / Math.max(1, nbCategories)) * Math.PI * 2;
        const pos = { x: Math.cos(angle) * 110, y: Math.sin(angle) * 110 };
        centres.set(n.nom, pos);
        return { ...n, ...pos, vx: 0, vy: 0, fixe: false };
      }
      return { ...n, x: 0, y: 0, vx: 0, vy: 0, fixe: false };
    });
    // Les nouveaux fichiers naissent près de leur catégorie.
    for (const l of graphe.liens) {
      if (!l.categorie) continue;
      const f = e.noeuds[l.a];
      if (anciens.has(f.id)) continue;
      const c = e.noeuds[l.b];
      f.x = c.x + (Math.random() - 0.5) * 60;
      f.y = c.y + (Math.random() - 0.5) * 60;
    }
    e.liens = graphe.liens;
    e.survole = -1;
    e.voisins = new Set();
    e.alpha = anciens.size === 0 ? 1 : Math.max(e.alpha, 0.5);
    if (anciens.size === 0) e.aCadrer = true;
    e.sale = true;
  }, [graphe]);

  // Boucle : simulation + dessin, et toutes les interactions.
  useEffect(() => {
    const canvas = toile.current!;
    const boite = conteneur.current!;
    const ctx = canvas.getContext('2d')!;
    const e = etat.current;
    const couleurs = lireCouleurs(boite);
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let image = 0;

    const redimensionner = () => {
      const dpr = window.devicePixelRatio || 1;
      // Graphe qui réapparaît (onglet caché sur mobile) : on le recadre.
      if (e.largeur === 0 && boite.clientWidth > 0) e.aCadrer = true;
      e.largeur = boite.clientWidth;
      e.hauteur = boite.clientHeight;
      canvas.width = Math.round(e.largeur * dpr);
      canvas.height = Math.round(e.hauteur * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      e.sale = true;
    };
    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(boite);

    // Un pas de simulation (même principe que d3-force).
    const pas = () => {
      const { noeuds, liens } = e;
      const alpha = e.alpha;
      for (let i = 0; i < noeuds.length; i++) {
        const a = noeuds[i];
        for (let j = i + 1; j < noeuds.length; j++) {
          const b = noeuds[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          if (dx === 0 && dy === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
          }
          const d2 = Math.max(dx * dx + dy * dy, 30);
          // Portée limitée : les grappes lointaines ne se repoussent plus.
          if (d2 > PORTEE_REPULSION ** 2) continue;
          const charge = (a.type === 'categorie' && b.type === 'categorie' ? 380 : 140) * alpha;
          const f = charge / d2;
          a.vx -= dx * f;
          a.vy -= dy * f;
          b.vx += dx * f;
          b.vy += dy * f;
        }
      }
      for (const l of liens) {
        const a = noeuds[l.a];
        const b = noeuds[l.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - l.longueur) / d) * alpha * l.force * 0.5;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }
      for (const n of noeuds) {
        n.vx -= n.x * RAPPEL_CENTRE * alpha;
        n.vy -= n.y * RAPPEL_CENTRE * alpha;
        if (n.fixe) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.6;
        n.vy *= 0.6;
        n.x += n.vx;
        n.y += n.vy;
      }
      e.alpha += (0 - e.alpha) * 0.0228;
    };

    // Cadre tout le graphe dans la zone visible.
    const cadrer = () => {
      if (e.noeuds.length === 0 || e.largeur === 0) return false;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const n of e.noeuds) {
        x0 = Math.min(x0, n.x - n.r);
        y0 = Math.min(y0, n.y - n.r);
        x1 = Math.max(x1, n.x + n.r);
        y1 = Math.max(y1, n.y + n.r);
      }
      const marge = 48;
      const zoom = Math.min(
        (e.largeur - marge * 2) / Math.max(x1 - x0, 1),
        (e.hauteur - marge * 2) / Math.max(y1 - y0, 1),
        2.2,
      );
      e.vue.zoom = Math.max(ZOOM_MIN, zoom);
      e.vue.x = e.largeur / 2 - ((x0 + x1) / 2) * e.vue.zoom;
      e.vue.y = e.hauteur / 2 - ((y0 + y1) / 2) * e.vue.zoom;
      e.sale = true;
      return true;
    };

    const dessiner = () => {
      const { noeuds, liens, vue, survole, voisins } = e;
      ctx.clearRect(0, 0, e.largeur, e.hauteur);
      ctx.save();
      ctx.translate(vue.x, vue.y);
      ctx.scale(vue.zoom, vue.zoom);
      const actif = survole >= 0;
      const allume = (i: number) => !actif || i === survole || voisins.has(i);

      // Liens
      ctx.lineCap = 'round';
      for (const l of liens) {
        const a = noeuds[l.a];
        const b = noeuds[l.b];
        const vif = actif && (l.a === survole || l.b === survole);
        ctx.strokeStyle = vif ? couleurs.lienVif : couleurs.lien;
        ctx.globalAlpha = vif ? 0.85 : actif ? 0.35 : 1;
        ctx.lineWidth = (vif ? 1.6 : l.categorie ? 1 : 0.8) / Math.sqrt(vue.zoom);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nœuds
      noeuds.forEach((n, i) => {
        ctx.globalAlpha = allume(i) ? 1 : 0.18;
        const vedette = i === survole;
        ctx.shadowColor = couleurs.halo;
        ctx.shadowBlur = n.type === 'categorie' || vedette ? 14 : 0;
        ctx.fillStyle = n.type === 'categorie' || vedette ? couleurs.categorie : couleurs.fichier;
        ctx.beginPath();
        ctx.arc(n.x, n.y, vedette ? n.r + 1.5 : n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Cerne sombre : les points restent distincts quand ils se chevauchent.
        ctx.strokeStyle = 'rgba(21, 13, 5, 0.85)';
        ctx.lineWidth = 1.5 / vue.zoom;
        ctx.stroke();
      });

      // Étiquettes : catégories toujours, fichiers en zoomant (ou au survol).
      const opaciteFichiers = Math.min(1, Math.max(0, (vue.zoom - 1.25) * 2.5));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      noeuds.forEach((n, i) => {
        const proche = actif && (i === survole || voisins.has(i));
        let opacite = n.type === 'categorie' ? 1 : proche ? 1 : opaciteFichiers;
        if (actif && !allume(i)) opacite *= 0.15;
        if (opacite <= 0.02) return;
        // Taille constante à l'écran, quel que soit le zoom.
        const taille = (n.type === 'categorie' ? 11 : 14) / vue.zoom;
        ctx.globalAlpha = opacite;
        ctx.font =
          n.type === 'categorie'
            ? `700 ${taille}px Cinzel, serif`
            : `600 ${taille}px Cormorant, serif`;
        ctx.fillStyle = n.type === 'categorie' ? couleurs.categorie : i === survole ? couleurs.texte : couleurs.texteDoux;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        const nom = n.nom.length > 34 ? `${n.nom.slice(0, 32)}…` : n.nom;
        ctx.fillText(nom, n.x, n.y + n.r + 4 / vue.zoom);
        ctx.shadowBlur = 0;
      });
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    // Réduction des animations : on laisse le graphe se poser d'un coup.
    const boucle = () => {
      if (e.alpha > 0.004) {
        if (reduit) while (e.alpha > 0.004) pas();
        else pas();
        e.sale = true;
      }
      if (e.aCadrer && (reduit || e.alpha < 0.35) && cadrer()) e.aCadrer = false;
      if (e.sale) {
        dessiner();
        e.sale = false;
      }
      image = requestAnimationFrame(boucle);
    };
    // Un premier élan hors écran, pour ne pas montrer la pelote de départ.
    for (let i = 0; i < 80 && e.alpha > 0.004; i++) pas();
    image = requestAnimationFrame(boucle);

    // --- Souris / doigt -----------------------------------------------------

    const versMonde = (cx: number, cy: number) => ({
      x: (cx - e.vue.x) / e.vue.zoom,
      y: (cy - e.vue.y) / e.vue.zoom,
    });
    const position = (ev: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const noeudSous = (cx: number, cy: number) => {
      const p = versMonde(cx, cy);
      let meilleur = -1;
      let distMin = Infinity;
      e.noeuds.forEach((n, i) => {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < n.r + 6 / e.vue.zoom && d < distMin) {
          meilleur = i;
          distMin = d;
        }
      });
      return meilleur;
    };
    const survoler = (i: number, cx = 0, cy = 0) => {
      if (i === e.survole) return;
      e.survole = i;
      e.voisins = new Set();
      if (i >= 0) {
        for (const l of e.liens) {
          if (l.a === i) e.voisins.add(l.b);
          if (l.b === i) e.voisins.add(l.a);
        }
        // Bulle pour les fichiers ; une catégorie a déjà son étiquette.
        const n = e.noeuds[i];
        const lies = e.liens
          .filter((l) => l.communs && (l.a === i || l.b === i))
          .map((l) => ({ nom: e.noeuds[l.a === i ? l.b : l.a].nom, par: l.communs!.slice(0, 3).join(', ') }));
        setSurvol(n.type === 'fichier' ? { nom: n.nom, meta: n.meta, lies, x: cx, y: cy } : null);
      } else {
        setSurvol(null);
      }
      canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
      e.sale = true;
    };

    let geste: { type: 'noeud' | 'fond'; i: number; x: number; y: number; bouge: boolean } | null = null;

    const appuyer = (ev: PointerEvent) => {
      const p = position(ev);
      const i = noeudSous(p.x, p.y);
      canvas.setPointerCapture(ev.pointerId);
      geste = { type: i >= 0 ? 'noeud' : 'fond', i, x: p.x, y: p.y, bouge: false };
      if (i >= 0) {
        e.noeuds[i].fixe = true;
        e.alpha = Math.max(e.alpha, 0.3);
      } else {
        canvas.style.cursor = 'grabbing';
      }
    };
    const bouger = (ev: PointerEvent) => {
      const p = position(ev);
      if (!geste) {
        survoler(noeudSous(p.x, p.y), p.x, p.y);
        return;
      }
      const dx = p.x - geste.x;
      const dy = p.y - geste.y;
      if (Math.hypot(dx, dy) > 4) geste.bouge = true;
      if (!geste.bouge) return;
      if (geste.type === 'noeud') {
        const m = versMonde(p.x, p.y);
        const n = e.noeuds[geste.i];
        n.x = m.x;
        n.y = m.y;
        e.alpha = Math.max(e.alpha, 0.3);
      } else {
        e.vue.x += dx;
        e.vue.y += dy;
        geste.x = p.x;
        geste.y = p.y;
      }
      e.sale = true;
    };
    const relacher = (ev: PointerEvent) => {
      if (!geste) return;
      const g = geste;
      geste = null;
      if (g.type === 'noeud') e.noeuds[g.i].fixe = false;
      canvas.style.cursor = 'grab';
      if (!g.bouge && g.i >= 0) {
        const n = e.noeuds[g.i];
        if (n.type === 'fichier') rappels.current.onOuvrir(n.id);
        else rappels.current.onCategorie(n.nom);
      }
      if (ev.pointerType !== 'mouse') survoler(-1);
    };
    const quitter = () => {
      if (!geste) survoler(-1);
    };
    const molette = (ev: WheelEvent) => {
      ev.preventDefault();
      const p = position(ev);
      const avant = versMonde(p.x, p.y);
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, e.vue.zoom * Math.exp(-ev.deltaY * 0.0015)));
      e.vue.zoom = zoom;
      e.vue.x = p.x - avant.x * zoom;
      e.vue.y = p.y - avant.y * zoom;
      e.sale = true;
    };

    canvas.addEventListener('pointerdown', appuyer);
    canvas.addEventListener('pointermove', bouger);
    canvas.addEventListener('pointerup', relacher);
    canvas.addEventListener('pointercancel', relacher);
    canvas.addEventListener('pointerleave', quitter);
    canvas.addEventListener('wheel', molette, { passive: false });

    // Boutons de zoom / recentrage (hors canvas).
    const zoomer = (facteur: number) => {
      const cx = e.largeur / 2;
      const cy = e.hauteur / 2;
      const avant = versMonde(cx, cy);
      e.vue.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, e.vue.zoom * facteur));
      e.vue.x = cx - avant.x * e.vue.zoom;
      e.vue.y = cy - avant.y * e.vue.zoom;
      e.sale = true;
    };
    commandes.current = { zoomer, cadrer: () => void cadrer() };

    return () => {
      cancelAnimationFrame(image);
      observateur.disconnect();
      canvas.removeEventListener('pointerdown', appuyer);
      canvas.removeEventListener('pointermove', bouger);
      canvas.removeEventListener('pointerup', relacher);
      canvas.removeEventListener('pointercancel', relacher);
      canvas.removeEventListener('pointerleave', quitter);
      canvas.removeEventListener('wheel', molette);
    };
  }, []);

  return (
    <div ref={conteneur} className={styles.graphe}>
      <canvas
        ref={toile}
        className={styles.toile}
        role="img"
        aria-label={`Graphe de ${fichiers.length} fichiers reliés par catégorie et par sujets communs. La vue grille liste les mêmes fichiers.`}
      />
      {survol && (
        <div
          className={styles.bulle}
          style={{ left: survol.x, top: survol.y }}
          aria-hidden="true"
        >
          <span className={styles.bulleNom}>{survol.nom}</span>
          <span className={styles.bulleMeta}>{survol.meta}</span>
          {survol.lies.map((l) => (
            <span key={l.nom} className={styles.bulleLien}>
              ↔ {l.nom} <span className={styles.bulleMeta}>· {l.par}</span>
            </span>
          ))}
        </div>
      )}
      <div className={styles.commandes}>
        <button type="button" onClick={() => commandes.current?.zoomer(1.3)} aria-label="Zoomer">
          +
        </button>
        <button type="button" onClick={() => commandes.current?.zoomer(1 / 1.3)} aria-label="Dézoomer">
          −
        </button>
        <button type="button" onClick={() => commandes.current?.cadrer()} aria-label="Tout afficher" title="Tout afficher">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </svg>
        </button>
      </div>
      <p className={styles.legende}>
        <span className={styles.pastilleCategorie} aria-hidden="true" /> catégorie
        <span className={styles.pastilleFichier} aria-hidden="true" /> fichier
        <span className={styles.legendeDetail}>· relié aux fichiers qui partagent ses mots-clés</span>
      </p>
    </div>
  );
}
