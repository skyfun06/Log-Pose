import { useEffect, useRef } from 'react';

// Gerbe de fête plein écran, pour quelques secondes : pièces d'or qui
// tournent (prime) ou confettis de papier (conquête, recrue). Une gerbe jaillit
// du centre puis retombe ; une pluie tombe du haut. Rien si animations réduites.

type Variante = 'pieces' | 'confettis';

const COULEURS_CONFETTIS = ['#b33a2e', '#e7c57a', '#2aa79b', '#fff8e8', '#3b2a18', '#f5de72'];
const DUREE = 4200;

export function Festivites({
  variante = 'pieces',
  className,
}: {
  variante?: Variante;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const l = (el.width = window.innerWidth);
    const h = (el.height = window.innerHeight);
    const nombre = variante === 'pieces' ? 110 : 160;
    const elements = Array.from({ length: nombre }, (_, i) => {
      const gerbe = i < nombre * 0.55;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 9 + Math.random() * 10;
      return {
        x: gerbe ? l / 2 : Math.random() * l,
        y: gerbe ? h * 0.45 : -20 - Math.random() * h * 0.6,
        vx: gerbe ? Math.cos(angle) * v : (Math.random() - 0.5) * 1.5,
        vy: gerbe ? Math.sin(angle) * v : 2 + Math.random() * 3,
        r: variante === 'pieces' ? 7 + Math.random() * 7 : 4 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        tour: 0.12 + Math.random() * 0.2,
        couleur: COULEURS_CONFETTIS[i % COULEURS_CONFETTIS.length],
      };
    });

    let id = 0;
    const debut = performance.now();
    const image = (t: number) => {
      ctx.clearRect(0, 0, l, h);
      const fondu = Math.max(0, Math.min(1, (DUREE - (t - debut)) / 800));
      ctx.globalAlpha = fondu;
      for (const p of elements) {
        // Les confettis flottent : plus de frottement, chute plus lente.
        const confetti = variante === 'confettis';
        p.vy += confetti ? 0.18 : 0.32;
        p.vx *= confetti ? 0.97 : 0.99;
        if (confetti) p.vy = Math.min(p.vy, 3.2);
        p.x += p.vx + (confetti ? Math.sin(p.phase) * 0.8 : 0);
        p.y += p.vy;
        p.phase += p.tour;
        const largeur = Math.abs(Math.cos(p.phase)) * p.r + 1;
        if (confetti) {
          ctx.fillStyle = p.couleur;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase * 0.7);
          ctx.fillRect(-largeur / 2, -p.r * 0.6, largeur, p.r * 1.2);
          ctx.restore();
          continue;
        }
        // La pièce tourne sur elle-même : son ellipse s'aplatit.
        ctx.fillStyle = Math.cos(p.phase) > 0 ? '#f5de72' : '#c08a2e';
        ctx.strokeStyle = '#7a5520';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, largeur, p.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (largeur > p.r * 0.6) {
          ctx.fillStyle = '#7a5520';
          ctx.font = `700 ${Math.round(p.r * 1.1)}px Cinzel, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('฿', p.x, p.y + 1);
        }
      }
      ctx.globalAlpha = 1;
      if (t - debut < DUREE) id = requestAnimationFrame(image);
    };
    id = requestAnimationFrame(image);
    return () => cancelAnimationFrame(id);
  }, [variante]);

  return (
    <canvas
      ref={canvas}
      className={className}
      style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
