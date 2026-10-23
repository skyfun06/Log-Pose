import { useEffect, useRef } from 'react';
import type { Ere } from '../data/paliers';
import styles from './Atmosphere.module.css';

// L'air de chaque ère, en particules sur tout l'écran (derrière les cartes) :
// embruns dans l'East Blue, bulles dans la Grand Line, braises dans le
// Nouveau Monde, étincelles et éclairs pour l'Empereur, paillettes d'or pour
// le Roi. Un seul canvas, des sprites pré-rendus : léger pour le processeur.

type Forme = 'embrun' | 'bulle' | 'braise' | 'etincelle' | 'paillette';

interface Reglage {
  forme: Forme;
  nombre: number;
  couleurs: string[];
  taille: [number, number];
  vx: [number, number];
  vy: [number, number];
  eclairs?: boolean;
}

const REGLAGES: Record<Ere, Reglage> = {
  'east-blue': {
    forme: 'embrun',
    nombre: 40,
    couleurs: ['#fff3d6', '#e7f4f2'],
    taille: [1, 2.6],
    vx: [0.05, 0.3],
    vy: [-0.32, -0.08],
  },
  'grand-line': {
    forme: 'bulle',
    nombre: 50,
    couleurs: ['#8fe3d8', '#5fd0c2', '#d8fff8'],
    taille: [2, 5.5],
    vx: [-0.12, 0.12],
    vy: [-0.7, -0.25],
  },
  'nouveau-monde': {
    forme: 'braise',
    nombre: 80,
    couleurs: ['#ff8a3d', '#ff5a3c', '#ffc46b'],
    taille: [1, 3],
    vx: [-0.25, 0.25],
    vy: [-1.15, -0.4],
  },
  empereur: {
    forme: 'etincelle',
    nombre: 70,
    couleurs: ['#c9a2ff', '#9d6cf0', '#ffe27a'],
    taille: [1, 2.6],
    vx: [-0.4, 0.4],
    vy: [-0.5, 0.2],
    eclairs: true,
  },
  roi: {
    forme: 'paillette',
    nombre: 90,
    couleurs: ['#ffe98a', '#ffd35a', '#fff6c8'],
    taille: [1.6, 3.6],
    vx: [-0.2, 0.2],
    vy: [0.25, 0.8],
  },
};

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  taille: number;
  couleur: string;
  phase: number;
  age: number;
  vie: number; // en images
  reglage: Reglage;
  meurt: boolean; // reste d'une ancienne ère : s'éteint sans renaître
}

const hasard = ([a, b]: [number, number]) => a + Math.random() * (b - a);

// Petit halo lumineux pré-rendu par couleur (drawImage est bien moins cher
// que shadowBlur à chaque image).
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(couleur: string): HTMLCanvasElement {
  let s = sprites.get(couleur);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 32;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, couleur);
  g.addColorStop(0.25, couleur);
  g.addColorStop(1, 'transparent');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  sprites.set(couleur, s);
  return s;
}

function naitre(r: Reglage, l: number, h: number, partout: boolean): Particule {
  const monte = r.vy[1] <= 0.25 && r.vy[0] < 0;
  return {
    x: Math.random() * l,
    // Les particules qui montent naissent en bas, celles qui tombent en haut.
    y: partout ? Math.random() * h : monte ? h + 10 : -10,
    vx: hasard(r.vx),
    vy: hasard(r.vy),
    taille: hasard(r.taille),
    couleur: r.couleurs[Math.floor(Math.random() * r.couleurs.length)],
    phase: Math.random() * Math.PI * 2,
    // Au premier affichage, l'écran est déjà peuplé (pas de fondu d'entrée).
    age: partout ? 60 + Math.random() * 200 : 0,
    vie: 500 + Math.random() * 500,
    reglage: r,
    meurt: false,
  };
}

export function Atmosphere({ ere }: { ere: Ere }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const particules = useRef<Particule[]>([]);
  const reglage = useRef<Reglage>(REGLAGES[ere]);

  // Changement d'ère : les anciennes particules s'éteignent, les nouvelles
  // prennent le relais au fil des secondes.
  useEffect(() => {
    reglage.current = REGLAGES[ere];
    particules.current.forEach((p) => (p.meurt = true));
  }, [ere]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let l = 0;
    let h = 0;
    const redim = () => {
      l = window.innerWidth;
      h = window.innerHeight;
      el.width = l * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redim();
    window.addEventListener('resize', redim);

    if (particules.current.length === 0) {
      const r = reglage.current;
      particules.current = Array.from({ length: r.nombre }, () => naitre(r, l, h, true));
    }

    let id = 0;
    let prochainEclair = performance.now() + 5000 + Math.random() * 6000;
    let eclair: {
      points: [number, number][];
      branches: [number, number][][];
      jusqua: number;
    } | null = null;

    const image = (t: number) => {
      ctx.clearRect(0, 0, l, h);
      const r = reglage.current;
      const liste = particules.current;

      // Renouvellement : on garde le bon nombre de particules vivantes.
      const vivantes = liste.filter((p) => !p.meurt).length;
      if (vivantes < r.nombre && Math.random() < 0.25) liste.push(naitre(r, l, h, false));

      for (let i = liste.length - 1; i >= 0; i--) {
        const p = liste[i];
        p.age++;
        p.phase += 0.03;
        p.x += p.vx + Math.sin(p.phase) * (p.reglage.forme === 'braise' ? 0.35 : 0.15);
        p.y += p.vy;
        const dehors = p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > l + 20;
        // Fondu d'entrée et de sortie ; une particule « meurt » plus vite.
        const fin = p.meurt ? Math.min(p.vie, p.age + 60) : p.vie;
        if (p.meurt && p.vie > p.age + 60) p.vie = p.age + 60;
        const alpha = Math.min(1, p.age / 50, (fin - p.age) / 50);
        if (p.age >= p.vie || dehors) {
          if (p.meurt || liste.length > r.nombre) liste.splice(i, 1);
          else liste[i] = naitre(r, l, h, false);
          continue;
        }
        dessiner(ctx, p, Math.max(0, alpha));
      }

      // Empereur : un éclair de Haki des rois de temps en temps.
      if (r.eclairs && t > prochainEclair) {
        eclair = tracerEclair(l, h, t + 220);
        prochainEclair = t + 7000 + Math.random() * 9000;
        flash.current?.animate(
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 0.3, offset: 0.3 },
            { opacity: 0.8, offset: 0.4 },
            { opacity: 0 },
          ],
          {
            duration: 520,
            easing: 'ease-out',
          },
        );
      }
      if (eclair) {
        if (t > eclair.jusqua) eclair = null;
        else dessinerEclair(ctx, eclair);
      }

      id = requestAnimationFrame(image);
    };
    id = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', redim);
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className={styles.atmosphere} aria-hidden="true" />
      <div ref={flash} className={styles.flash} aria-hidden="true" />
    </>
  );
}

function dessiner(ctx: CanvasRenderingContext2D, p: Particule, alpha: number) {
  const s = p.taille;
  ctx.globalAlpha = alpha;
  switch (p.reglage.forme) {
    case 'embrun':
      ctx.globalAlpha = alpha * (0.35 + 0.25 * Math.sin(p.phase * 2));
      ctx.drawImage(sprite(p.couleur), p.x - s * 3, p.y - s * 3, s * 6, s * 6);
      break;
    case 'bulle':
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = p.couleur;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - s * 0.45, p.y - s * 0.45, 1.2, 1.2);
      break;
    case 'braise': {
      const vacille = 0.6 + 0.4 * Math.sin(p.phase * 5);
      ctx.globalAlpha = alpha * vacille;
      ctx.drawImage(sprite(p.couleur), p.x - s * 4, p.y - s * 4, s * 8, s * 8);
      break;
    }
    case 'etincelle': {
      const scintille = Math.max(0, Math.sin(p.phase * 4));
      ctx.globalAlpha = alpha * scintille;
      ctx.drawImage(sprite(p.couleur), p.x - s * 4, p.y - s * 4, s * 8, s * 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 0.6, p.y - s * 2, 1.2, s * 4);
      ctx.fillRect(p.x - s * 2, p.y - 0.6, s * 4, 1.2);
      break;
    }
    case 'paillette': {
      // Une paillette qui tourne : sa largeur oscille.
      const largeur = Math.abs(Math.cos(p.phase * 3)) * s * 1.6 + 0.4;
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.abs(Math.sin(p.phase * 3)));
      ctx.fillStyle = p.couleur;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.phase);
      ctx.fillRect(-largeur / 2, -s, largeur, s * 2);
      ctx.restore();
      break;
    }
  }
  ctx.globalAlpha = 1;
}

function tracerEclair(l: number, h: number, jusqua: number) {
  const depart: [number, number] = [l * (0.15 + Math.random() * 0.7), -10];
  const points: [number, number][] = [depart];
  const branches: [number, number][][] = [];
  let [x, y] = depart;
  const bas = h * (0.45 + Math.random() * 0.35);
  while (y < bas) {
    x += (Math.random() - 0.5) * 70;
    y += 22 + Math.random() * 30;
    points.push([x, y]);
    if (Math.random() < 0.22) {
      const branche: [number, number][] = [[x, y]];
      let [bx, by] = [x, y];
      const sens = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 4; k++) {
        bx += sens * (15 + Math.random() * 30);
        by += 15 + Math.random() * 25;
        branche.push([bx, by]);
      }
      branches.push(branche);
    }
  }
  return { points, branches, jusqua };
}

function dessinerEclair(
  ctx: CanvasRenderingContext2D,
  e: { points: [number, number][]; branches: [number, number][][] },
) {
  const trait = (pts: [number, number][], largeur: number, couleur: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = largeur;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  };
  trait(e.points, 9, '#7e40c4', 0.25);
  trait(e.points, 3, '#d6b4ff', 0.9);
  trait(e.points, 1.2, '#ffffff', 1);
  e.branches.forEach((b) => {
    trait(b, 4, '#7e40c4', 0.2);
    trait(b, 1.2, '#e6d2ff', 0.8);
  });
  ctx.globalAlpha = 1;
}
