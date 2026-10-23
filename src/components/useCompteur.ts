import { useEffect, useRef, useState } from 'react';

// Un nombre qui défile jusqu'à sa nouvelle valeur au lieu de sauter
// (prime de l'affiche, cérémonie). Animations réduites : saut direct.
export function useCompteur(
  cible: number,
  { duree = 1200, delai = 0, depuis }: { duree?: number; delai?: number; depuis?: number } = {},
) {
  const [valeur, setValeur] = useState(depuis ?? cible);
  const actuelle = useRef(valeur);

  useEffect(() => {
    const de = actuelle.current;
    if (de === cible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      actuelle.current = cible;
      setValeur(cible);
      return;
    }
    const debut = performance.now() + delai;
    let id = 0;
    const pas = (t: number) => {
      const x = Math.min(1, Math.max(0, (t - debut) / duree));
      const doux = 1 - Math.pow(1 - x, 3);
      const v = Math.round(de + (cible - de) * doux);
      actuelle.current = v;
      setValeur(v);
      if (x < 1) id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [cible, duree, delai]);

  return valeur;
}
