import { useState } from 'react';
import type { FormEvent } from 'react';
import photoAffiche from '../assets/photo-affiche.png';
import styles from './WantedPoster.module.css';

interface WantedPosterProps {
  nom: string;
  bounty: number;
  prime: number;
  onAjouterGain: (montant: number) => void;
}

export function WantedPoster({ nom, bounty, prime, onAjouterGain }: WantedPosterProps) {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState('');
  const [berryDispo, setBerryDispo] = useState(true);

  const bountyFormate = bounty.toLocaleString('fr-FR');
  const primeFormatee = prime.toLocaleString('fr-FR');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const montant = Number(valeur.replace(',', '.'));
    if (Number.isFinite(montant) && montant > 0) {
      onAjouterGain(montant);
      setValeur('');
      setOuvert(false);
    }
  }

  return (
    <aside className={styles.colonne}>
      <div className={styles.affiche}>
        <img src="/assets/affiche-wanted.png" alt="Avis de recherche" className={styles.cadre} />

        <div className={styles.zonePhoto}>
          <img
            src={photoAffiche}
            alt=""
            className={styles.photo}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className={styles.photoPlaceholder} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="8" r="4.5" />
              <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z" />
            </svg>
          </span>
        </div>

        <div className={styles.nom}>{nom}</div>

        <div className={styles.zonePrime}>
          <div className={styles.montantPrime}>
            {berryDispo ? (
              <img
                src="/assets/berry.png"
                alt="Berry"
                className={styles.berryIcone}
                onError={() => setBerryDispo(false)}
              />
            ) : (
              <span aria-hidden="true">฿</span>
            )}
            {bountyFormate}
          </div>
          <div className={styles.montantEuros}>{primeFormatee} €</div>
        </div>
      </div>

      <div className={styles.atouts}>
        {[10, 50, 100].map((montant) => (
          <button
            key={montant}
            type="button"
            className={styles.atout}
            onClick={() => onAjouterGain(montant)}
          >
            +{montant} €
          </button>
        ))}
      </div>

      {ouvert ? (
        <form className={styles.formulaire} onSubmit={handleSubmit}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoFocus
            placeholder="Montant en €"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            className={styles.champ}
          />
          <div className={styles.actionsFormulaire}>
            <button type="submit" className={styles.boutonValider}>
              Valider
            </button>
            <button
              type="button"
              className={styles.boutonAnnuler}
              onClick={() => {
                setOuvert(false);
                setValeur('');
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button className={styles.boutonGain} onClick={() => setOuvert(true)}>
          + montant libre
        </button>
      )}
    </aside>
  );
}
