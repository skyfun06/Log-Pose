import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CATEGORIES_CERVEAU,
  categorie as trouverCategorie,
  devinerCategorie,
  nomDepuisFichier,
} from '../data/categoriesCerveau';
import { tailleLisible } from '../data/formatCerveau';
import type { FicheCerveau, InfosCerveau } from '../types';
import { IconeCategorie, Vignette } from './CerveauIcones';
import base from './BlocForm.module.css';
import styles from './CerveauForm.module.css';

type CerveauFormProps = {
  onValider: (infos: InfosCerveau) => Promise<void>;
  onAnnuler: () => void;
} & (
  | {
      // Dépôt d'un nouveau fichier (plusieurs fichiers : un formulaire chacun).
      fichier: File;
      position: { numero: number; total: number };
      fiche?: undefined;
    }
  | { fiche: FicheCerveau; fichier?: undefined; position?: undefined }
);

// Popup qui accompagne chaque fichier rangé dans le second cerveau : un nom,
// une catégorie, et quelques infos facultatives pour le retrouver.
export function CerveauForm({ fichier, position, fiche, onValider, onAnnuler }: CerveauFormProps) {
  const [nom, setNom] = useState(fiche?.nom ?? (fichier ? nomDepuisFichier(fichier) : ''));
  const [categorie, setCategorie] = useState(fiche?.categorie ?? (fichier ? devinerCategorie(fichier) : 'Autre'));
  const [date, setDate] = useState(fiche?.date ?? '');
  const [montant, setMontant] = useState(
    fiche?.montant !== null && fiche?.montant !== undefined ? String(fiche.montant).replace('.', ',') : '',
  );
  const [note, setNote] = useState(fiche?.note ?? '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  // Aperçu local de l'image avant envoi.
  const [apercu, setApercu] = useState<string | null>(null);
  useEffect(() => {
    if (!fichier?.type.startsWith('image/')) return;
    const url = URL.createObjectURL(fichier);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  // Échap ferme la popup.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !envoi) onAnnuler();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [envoi, onAnnuler]);

  const choix = trouverCategorie(categorie);
  const avecMontant = choix.avecMontant || montant !== '';

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) {
      setErreur('Donne-lui un nom : c’est par là que tu le retrouveras.');
      return;
    }
    const valeur = montant.trim() === '' ? null : Number(montant.replace(/\s/g, '').replace(',', '.'));
    if (valeur !== null && !Number.isFinite(valeur)) {
      setErreur('Le montant doit être un nombre, ex : 87,40.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      await onValider({
        nom: nom.trim(),
        categorie,
        date: date || null,
        montant: avecMontant ? valeur : null,
        note: note.trim(),
      });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
      setEnvoi(false);
    }
  }

  return (
    <div className={base.overlay} onClick={() => !envoi && onAnnuler()}>
      <form
        className={`${base.formulaire} ${styles.formulaire}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={valider}
        aria-label={fiche ? 'Modifier la fiche' : 'Ranger un fichier'}
      >
        <div className={styles.titreLigne}>
          <h2 className={base.formTitre}>{fiche ? 'Modifier la fiche' : 'Ranger dans la cale'}</h2>
          {position && position.total > 1 && (
            <span className={styles.compteur}>
              {position.numero} / {position.total}
            </span>
          )}
        </div>

        <div className={styles.fichier}>
          {fiche ? (
            <Vignette fiche={fiche} className={styles.vignette} />
          ) : apercu ? (
            <span className={styles.vignette} data-vignette="image">
              <img src={apercu} alt="" />
            </span>
          ) : (
            <span className={styles.vignette} data-vignette="icone">
              <IconeCategorie nom={categorie} />
            </span>
          )}
          <span className={styles.fichierTexte}>
            <span className={styles.fichierNom}>{fiche?.fichier.nomOrigine ?? fichier?.name}</span>
            <span className={styles.fichierTaille}>
              {tailleLisible(fiche?.fichier.taille ?? fichier?.size ?? 0)}
            </span>
          </span>
        </div>

        <label className={base.champLabel}>
          Nom
          <input
            type="text"
            className={base.champ}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={120}
            placeholder="Facture EDF septembre"
            autoFocus
          />
        </label>

        <div className={base.champLabel}>
          Catégorie
          <div className={styles.categories} role="radiogroup" aria-label="Catégorie">
            {CATEGORIES_CERVEAU.map((c) => (
              <button
                key={c.nom}
                type="button"
                role="radio"
                aria-checked={categorie === c.nom}
                className={categorie === c.nom ? `${styles.categorie} ${styles.categorieActive}` : styles.categorie}
                onClick={() => setCategorie(c.nom)}
              >
                <IconeCategorie nom={c.nom} className={styles.categorieIcone} />
                {c.nom}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.ligne}>
          <label className={base.champLabel}>
            <span>
              Date du document <span className={styles.facultatif}>facultatif</span>
            </span>
            <input type="date" className={base.champ} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {avecMontant && (
            <label className={base.champLabel}>
              <span>
                Montant (€) <span className={styles.facultatif}>facultatif</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                className={base.champ}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="87,40"
              />
            </label>
          )}
        </div>

        <label className={base.champLabel}>
          <span>
            Un mot pour le retrouver <span className={styles.facultatif}>facultatif</span>
          </span>
          <textarea
            className={`${base.champ} ${styles.note}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={`ex : ${choix.exempleNote}`}
          />
        </label>

        {!fiche && (
          <p className={styles.astuce}>
            La vigie lira aussi le fichier : laisse la date ou le montant vides, elle les repérera
            souvent toute seule.
          </p>
        )}

        {erreur && <p className={base.erreur}>{erreur}</p>}

        <div className={base.formActions}>
          <button type="submit" className={base.boutonValider} disabled={envoi}>
            {envoi ? 'Rangement…' : fiche ? 'Enregistrer' : 'Ranger'}
          </button>
          <button type="button" className={base.boutonAnnuler} onClick={onAnnuler} disabled={envoi}>
            {position && position.total > 1 ? 'Passer' : 'Annuler'}
          </button>
        </div>
      </form>
    </div>
  );
}
