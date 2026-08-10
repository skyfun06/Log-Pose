import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BlocPlanning, JourSemaine } from '../types';
import styles from './BlocForm.module.css';

interface BlocFormProps {
  blocInitial?: BlocPlanning;
  onValider: (bloc: Omit<BlocPlanning, 'id'>) => void;
  onAnnuler: () => void;
}

const JOURS_ORDRE: JourSemaine[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

const JOURS_LABELS: Record<JourSemaine, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mer: 'Mer',
  jeu: 'Jeu',
  ven: 'Ven',
  sam: 'Sam',
  dim: 'Dim',
};

export function BlocForm({ blocInitial, onValider, onAnnuler }: BlocFormProps) {
  const [titre, setTitre] = useState(blocInitial?.titre ?? '');
  const [heureDebut, setHeureDebut] = useState(blocInitial?.heureDebut ?? '09:00');
  const [heureFin, setHeureFin] = useState(blocInitial?.heureFin ?? '10:00');
  const [jours, setJours] = useState<JourSemaine[]>(blocInitial?.jours ?? []);
  const [questWeight, setQuestWeight] = useState(
    blocInitial && blocInitial.questWeight > 0 ? String(blocInitial.questWeight) : '',
  );
  const [erreur, setErreur] = useState('');

  function toggleJour(jour: JourSemaine) {
    setJours((prev) => (prev.includes(jour) ? prev.filter((j) => j !== jour) : [...prev, jour]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!titre.trim()) {
      setErreur('Le titre est obligatoire.');
      return;
    }
    if (jours.length === 0) {
      setErreur('Sélectionne au moins un jour.');
      return;
    }
    if (heureFin <= heureDebut) {
      setErreur("L'heure de fin doit être après l'heure de début.");
      return;
    }

    const poids = Number(questWeight);

    onValider({
      titre: titre.trim(),
      heureDebut,
      heureFin,
      jours: JOURS_ORDRE.filter((j) => jours.includes(j)),
      questWeight: Number.isFinite(poids) && poids > 0 ? poids : 0,
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
          {blocInitial ? 'Modifier le créneau' : 'Ajouter un créneau'}
        </h2>

        <label className={styles.champLabel}>
          Titre
          <input
            type="text"
            className={styles.champ}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Prospection"
            autoFocus
          />
        </label>

        <div className={styles.ligneHoraires}>
          <label className={styles.champLabel}>
            Début
            <input
              type="time"
              className={styles.champ}
              value={heureDebut}
              onChange={(e) => setHeureDebut(e.target.value)}
            />
          </label>
          <label className={styles.champLabel}>
            Fin
            <input
              type="time"
              className={styles.champ}
              value={heureFin}
              onChange={(e) => setHeureFin(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.champLabel}>
          Jours
          <div className={styles.joursCases}>
            {JOURS_ORDRE.map((jour) => (
              <label key={jour} className={styles.jourCase}>
                <input
                  type="checkbox"
                  checked={jours.includes(jour)}
                  onChange={() => toggleJour(jour)}
                />
                {JOURS_LABELS[jour]}
              </label>
            ))}
          </div>
        </div>

        <label className={styles.champLabel}>
          Recharge le log pose de (%)
          <input
            type="number"
            className={styles.champ}
            min="0"
            max="100"
            value={questWeight}
            onChange={(e) => setQuestWeight(e.target.value)}
            placeholder="0"
          />
        </label>

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
