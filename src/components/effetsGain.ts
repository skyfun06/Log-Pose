// Effets d'un gain : des pièces de berry jaillissent du bouton et filent vers
// la prime de l'affiche, un « +10 € » s'envole. Éléments posés directement
// dans <body> et retirés à la fin (rien à gérer côté React).

const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function centre(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Durée (ms) avant que la première pièce touche la prime.
export const ARRIVEE_PIECES = 760;

export function jaillirPieces(source: Element, cible: Element, montant: number) {
  if (reduit()) return;
  const de = centre(source.getBoundingClientRect());
  const a = centre(cible.getBoundingClientRect());
  const nombre = Math.min(14, 4 + Math.round(Math.log10(Math.max(1, montant)) * 3));

  for (let i = 0; i < nombre; i++) {
    const piece = document.createElement('img');
    piece.src = '/assets/berry.png';
    piece.alt = '';
    piece.setAttribute('aria-hidden', 'true');
    Object.assign(piece.style, {
      position: 'fixed',
      left: `${de.x - 11}px`,
      top: `${de.y - 11}px`,
      width: '22px',
      height: '22px',
      zIndex: '90',
      pointerEvents: 'none',
      filter:
        'drop-shadow(0 2px 3px rgba(0,0,0,.5)) sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.15)',
    });
    document.body.appendChild(piece);

    // Trajectoire en cloche : d'abord projetée vers le haut, en éventail,
    // puis aspirée par la prime.
    const ecart = (i - (nombre - 1) / 2) * 14 + (Math.random() - 0.5) * 20;
    const sommet = { x: de.x + ecart * 2.2, y: Math.min(de.y, a.y) - 60 - Math.random() * 70 };
    const dx1 = sommet.x - de.x;
    const dy1 = sommet.y - de.y;
    const dx2 = a.x - de.x + (Math.random() - 0.5) * 30;
    const dy2 = a.y - de.y + (Math.random() - 0.5) * 10;
    const tours = 360 + Math.random() * 360;

    const anim = piece.animate(
      [
        { transform: 'translate(0,0) scale(0.4) rotate(0deg)', opacity: 0 },
        {
          transform: `translate(${dx1 * 0.6}px, ${dy1 * 0.75}px) scale(1.15) rotate(${tours * 0.3}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${dx1}px, ${dy1}px) scale(1) rotate(${tours * 0.5}deg)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${dx2}px, ${dy2}px) scale(0.5) rotate(${tours}deg)`, opacity: 0.2 },
      ],
      {
        duration: 820 + Math.random() * 160,
        delay: i * 38,
        easing: 'cubic-bezier(.45,.05,.55,.95)',
        fill: 'both',
      },
    );
    anim.onfinish = () => piece.remove();
    anim.oncancel = () => piece.remove();
  }
}

export function texteFlottant(source: Element, texte: string) {
  if (reduit()) return;
  const de = centre(source.getBoundingClientRect());
  const el = document.createElement('span');
  el.textContent = texte;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: `${de.x}px`,
    top: `${de.y - 10}px`,
    zIndex: '91',
    pointerEvents: 'none',
    fontFamily: 'Cinzel, serif',
    fontWeight: '900',
    fontSize: '22px',
    color: '#f5de72',
    textShadow: '0 2px 0 #5a3c12, 0 0 14px rgba(245,222,114,.7)',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, -26px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -70px) scale(1)', opacity: 0 },
    ],
    { duration: 1200, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' },
  );
  anim.onfinish = () => el.remove();
}

// Relance une animation CSS portée par une classe (même si elle est déjà là).
export function rejouer(el: Element | null, classe: string, delai = 0) {
  if (!el || reduit()) return;
  window.setTimeout(() => {
    el.classList.remove(classe);
    void (el as HTMLElement).offsetWidth;
    el.classList.add(classe);
  }, delai);
}
