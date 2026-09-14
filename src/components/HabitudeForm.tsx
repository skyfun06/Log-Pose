import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CadenceHabitude, Habitude } from '../types';
import styles from './BlocForm.module.css';

interface HabitudeFormProps {
  habitudeInitiale?: Habitude;
  onValider: (habitude: {
    nom: string;
    cadence: CadenceHabitude;
    objectifHebdo: number;
    icone?: string;
  }) => void;
  onAnnuler: () => void;
}

export function HabitudeForm({ habitudeInitiale, onValider, onAnnuler }: HabitudeFormProps) {
  const [nom, setNom] = useState(habitudeInitiale?.nom ?? '');
  const [cadence, setCadence] = useState<CadenceHabitude>(
    habitudeInitiale?.cadence ?? 'quotidienne',
  );
  const [objectifHebdo, setObjectifHebdo] = useState(
    String(habitudeInitiale?.objectifHebdo && habitudeInitiale.cadence === 'hebdomadaire'
      ? habitudeInitiale.objectifHebdo
      : 3),
  );
  const [erreur, setErreur] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) {
      setErreur('Donne un nom à ton habitude.');
      return;
    }
    const obj = Number(objectifHebdo);
    onValider({
      nom: nom.trim(),
      cadence,
      objectifHebdo: cadence === 'hebdomadaire' && Number.isFinite(obj) ? obj : 7,
    });
  }

  return (
    <div className={styles.overlay} onClick={onAnnuler}>
      <form
        className={styles.formulaire}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className={styles.formTitre}>
          {habitudeInitiale ? 'Modifier l’habitude' : 'Nouvelle habitude'}
        </h2>

        <label className={styles.champLabel}>
          Nom
          <input
            type="text"
            className={styles.champ}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Muscu, Lecture, Eau 2L…"
            autoFocus
          />
        </label>

        <div className={styles.champLabel}>
          Cadence
          <div className={styles.joursCases}>
            <label className={styles.jourCase}>
              <input
                type="radio"
                name="cadence"
                checked={cadence === 'quotidienne'}
                onChange={() => setCadence('quotidienne')}
              />
              Quotidienne
            </label>
            <label className={styles.jourCase}>
              <input
                type="radio"
                name="cadence"
                checked={cadence === 'hebdomadaire'}
                onChange={() => setCadence('hebdomadaire')}
              />
              Hebdomadaire
            </label>
          </div>
        </div>

        {cadence === 'hebdomadaire' && (
          <label className={styles.champLabel}>
            Objectif par semaine (nombre de fois)
            <input
              type="number"
              className={styles.champ}
              min="1"
              max="7"
              value={objectifHebdo}
              onChange={(e) => setObjectifHebdo(e.target.value)}
              placeholder="3"
            />
          </label>
        )}

        {erreur && <p className={styles.erreur}>{erreur}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.boutonValider}>
            Valider
          </button>
          <button type="button" className={styles.boutonAnnuler} onClick={onAnnuler}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
