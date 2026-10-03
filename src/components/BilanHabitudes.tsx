import { useEffect, useMemo, useRef, useState } from 'react';
import type { Habitude, MarquesHabitudes } from '../types';
import styles from './BilanHabitudes.module.css';

interface BilanHabitudesProps {
  habitudes: Habitude[];
  marques: MarquesHabitudes;
  onFermer: () => void;
}

const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const NB_MOIS = 6;

interface StatMois {
  label: string;
  faits: number;
  rates: number;
  taux: number; // % de réussite = faits / (faits + ratés)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Agrège les marques par mois sur les NB_MOIS derniers mois (mois courant inclus).
function calculerStats(marques: MarquesHabitudes): StatMois[] {
  const base = new Date();
  base.setDate(1);
  const mois: StatMois[] = [];
  for (let i = NB_MOIS - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const prefixe = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    let faits = 0;
    let rates = 0;
    for (const parDate of Object.values(marques)) {
      for (const [date, etat] of Object.entries(parDate)) {
        if (date.startsWith(prefixe)) {
          if (etat === 'fait') faits++;
          else if (etat === 'rate') rates++;
        }
      }
    }
    const total = faits + rates;
    mois.push({
      label: MOIS_COURTS[d.getMonth()],
      faits,
      rates,
      taux: total > 0 ? Math.round((faits / total) * 100) : 0,
    });
  }
  return mois;
}

export function BilanHabitudes({ habitudes, marques, onFermer }: BilanHabitudesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pret, setPret] = useState(false);
  const stats = useMemo(() => calculerStats(marques), [marques]);

  // Dessine le graphe sur le canvas (haute résolution pour un export net).
  useEffect(() => {
    let annule = false;
    const dessiner = () => {
      if (annule) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const L = 760;
      const H = 440;
      const dpr = 2;
      canvas.width = L * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      // Fond parchemin
      ctx.fillStyle = '#f4e6c5';
      ctx.fillRect(0, 0, L, H);
      ctx.strokeStyle = 'rgba(122, 90, 46, 0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, L - 12, H - 12);

      // Titre
      ctx.fillStyle = '#2c1e12';
      ctx.textAlign = 'left';
      ctx.font = "700 30px 'Cinzel', Georgia, serif";
      ctx.fillText('Bilan des habitudes', 40, 56);
      ctx.font = "italic 16px 'Cormorant', Georgia, serif";
      ctx.fillStyle = '#4a3520';
      const auj = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      ctx.fillText(
        `${habitudes.length} habitude${habitudes.length > 1 ? 's' : ''} suivie${
          habitudes.length > 1 ? 's' : ''
        } · taux de réussite mensuel · édité le ${auj}`,
        40,
        80,
      );

      // Zone du graphe
      const gaucheAxe = 64;
      const hautGraphe = 110;
      const basGraphe = H - 70;
      const droiteGraphe = L - 40;
      const hauteurGraphe = basGraphe - hautGraphe;

      // Grille horizontale (0, 25, 50, 75, 100 %)
      ctx.textAlign = 'right';
      ctx.font = "600 12px 'Cormorant', Georgia, serif";
      for (let p = 0; p <= 100; p += 25) {
        const y = basGraphe - (p / 100) * hauteurGraphe;
        ctx.strokeStyle = 'rgba(122, 90, 46, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gaucheAxe, y);
        ctx.lineTo(droiteGraphe, y);
        ctx.stroke();
        ctx.fillStyle = '#7a5a2e';
        ctx.fillText(`${p}%`, gaucheAxe - 8, y + 4);
      }

      // Barres
      const n = stats.length;
      const pas = (droiteGraphe - gaucheAxe) / n;
      const largeurBarre = Math.min(70, pas * 0.56);
      stats.forEach((s, i) => {
        const cx = gaucheAxe + pas * (i + 0.5);
        const h = (s.taux / 100) * hauteurGraphe;
        const x = cx - largeurBarre / 2;
        const y = basGraphe - h;

        // Dégradé doré
        const grad = ctx.createLinearGradient(0, y, 0, basGraphe);
        grad.addColorStop(0, '#f5de72');
        grad.addColorStop(1, '#c08a2e');
        ctx.fillStyle = grad;
        const r = h > 12 ? 6 : 0;
        // Barre à coins arrondis en haut
        ctx.beginPath();
        ctx.moveTo(x, basGraphe);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + largeurBarre - r, y);
        ctx.quadraticCurveTo(x + largeurBarre, y, x + largeurBarre, y + r);
        ctx.lineTo(x + largeurBarre, basGraphe);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(138, 106, 46, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Valeur au-dessus
        ctx.fillStyle = '#2c1e12';
        ctx.textAlign = 'center';
        ctx.font = "700 15px 'Playfair Display', Georgia, serif";
        ctx.fillText(`${s.taux}%`, cx, y - 8);

        // Détail (faits/ratés) sous la valeur
        ctx.fillStyle = '#7a5a2e';
        ctx.font = "600 11px 'Cormorant', Georgia, serif";
        ctx.fillText(`${s.faits}✓ ${s.rates}✕`, cx, y - 24 < hautGraphe ? y + 16 : y - 24);

        // Label du mois
        ctx.fillStyle = '#2c1e12';
        ctx.font = "700 14px 'Cinzel', Georgia, serif";
        ctx.fillText(s.label, cx, basGraphe + 22);
      });

      // Axe
      ctx.strokeStyle = 'rgba(122, 90, 46, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gaucheAxe, hautGraphe - 6);
      ctx.lineTo(gaucheAxe, basGraphe);
      ctx.lineTo(droiteGraphe, basGraphe);
      ctx.stroke();

      setPret(true);
    };

    // On attend que les polices web soient prêtes pour un rendu net.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(dessiner);
    } else {
      dessiner();
    }
    return () => {
      annule = true;
    };
  }, [stats, habitudes.length]);

  function exporter() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      a.href = url;
      a.download = `bilan-habitudes-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  const aucuneDonnee = stats.every((s) => s.faits === 0 && s.rates === 0);

  return (
    <div className={styles.overlay} onClick={onFermer}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header className={styles.entete}>
          <h2 className={styles.titre}>Bilan des habitudes</h2>
          <button
            type="button"
            className={styles.fermer}
            onClick={onFermer}
            aria-label="Fermer le bilan"
          >
            ×
          </button>
        </header>

        <div className={styles.corps}>
          <canvas ref={canvasRef} className={styles.canvas} />
          {aucuneDonnee && (
            <p className={styles.aucune}>
              Aucune habitude cochée sur les {NB_MOIS} derniers mois. Coche tes habitudes pour voir
              ton bilan se remplir.
            </p>
          )}
        </div>

        <footer className={styles.pied}>
          <button
            type="button"
            className={styles.boutonExport}
            onClick={exporter}
            disabled={!pret}
          >
            ⬇ Exporter en image
          </button>
          <button type="button" className={styles.boutonFermer} onClick={onFermer}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
