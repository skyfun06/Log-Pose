import { categorie } from '../data/categoriesCerveau';
import { formatFichier } from '../data/formatCerveau';
import { useCategoriesCerveau } from '../state/useCategoriesCerveau';
import { urlFichier } from '../state/useCerveau';
import type { FicheCerveau } from '../types';

// Icône d'une catégorie, gravée au trait (couleur héritée du texte).
export function IconeCategorie({ nom, className }: { nom: string; className?: string }) {
  const categories = useCategoriesCerveau();
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={categorie(nom, categories).icone} />
    </svg>
  );
}

// Vignette d'un fichier : sa miniature pour une image, sinon l'icône de sa
// catégorie avec le format (PDF, DOCX...).
export function Vignette({ fiche, className }: { fiche: FicheCerveau; className?: string }) {
  if (fiche.apercu) {
    return (
      <span className={className} data-vignette="image">
        <img src={`${urlFichier(fiche.id)}?apercu=1`} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <span className={className} data-vignette="icone">
      <IconeCategorie nom={fiche.categorie} />
      <span data-format>{formatFichier(fiche)}</span>
    </span>
  );
}
