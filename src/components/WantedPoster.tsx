import { useRef, useState } from 'react';
import type { FormEvent, Ref } from 'react';
import photoAffiche from '../assets/photo-affiche.png';
import { BERRYS_PAR_EURO, PALIERS } from '../data/paliers';
import { ARRIVEE_PIECES, jaillirPieces, rejouer, texteFlottant } from './effetsGain';
import { useCompteur } from './useCompteur';
import styles from './WantedPoster.module.css';

interface WantedPosterProps {
  nom: string;
  bounty: number;
  // Palier dont l'affiche porte les marques (épithète, cachet, aura).
  rang: number;
  onAjouterGain: (montant: number, note?: string) => void;
  onOuvrirAscension: () => void;
}

export function WantedPoster({
  nom,
  bounty,
  rang,
  onAjouterGain,
  onOuvrirAscension,
}: WantedPosterProps) {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState('');
  const [note, setNote] = useState('');

  const affiche = useRef<HTMLButtonElement>(null);
  const zonePrime = useRef<HTMLDivElement>(null);
  const boutonValider = useRef<HTMLButtonElement>(null);

  // La prime défile quand les pièces touchent l'affiche.
  const bountyAffiche = useCompteur(bounty, { duree: 1100, delai: ARRIVEE_PIECES });
  const eurosAffiches = bountyAffiche / BERRYS_PAR_EURO;

  // Gain : pièces, « +10 € » qui s'envole, l'affiche encaisse le choc.
  function gagner(montant: number, source: Element | null, note?: string) {
    if (source && zonePrime.current) {
      jaillirPieces(source, zonePrime.current, montant);
      texteFlottant(source, `+${montant.toLocaleString('fr-FR')} €`);
    }
    rejouer(affiche.current, styles.encaisse, ARRIVEE_PIECES);
    onAjouterGain(montant, note);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const montant = Number(valeur.replace(',', '.'));
    if (Number.isFinite(montant) && montant > 0) {
      gagner(montant, boutonValider.current, note.trim() || undefined);
      setValeur('');
      setNote('');
      setOuvert(false);
    }
  }

  return (
    <aside className={styles.colonne}>
      <AfficheWanted
        nom={nom}
        bounty={bountyAffiche}
        bountyFinal={bounty}
        euros={eurosAffiches}
        rang={rang}
        refAffiche={affiche}
        refPrime={zonePrime}
        onClick={onOuvrirAscension}
      />

      <div className={styles.atouts}>
        {[10, 50, 100].map((montant) => (
          <button
            key={montant}
            type="button"
            className={styles.atout}
            onClick={(e) => gagner(montant, e.currentTarget)}
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
          <input
            type="text"
            placeholder="D'où vient ce gain ? (facultatif)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={styles.champ}
          />
          <div className={styles.actionsFormulaire}>
            <button ref={boutonValider} type="submit" className={styles.boutonValider}>
              Valider
            </button>
            <button
              type="button"
              className={styles.boutonAnnuler}
              onClick={() => {
                setOuvert(false);
                setValeur('');
                setNote('');
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

interface AfficheWantedProps {
  nom: string;
  bounty: number; // prime affichée (peut défiler)
  bountyFinal?: number; // sert à fixer la taille du texte pendant le défilé
  euros: number;
  rang: number; // palier dont l'affiche porte les marques
  className?: string;
  refAffiche?: Ref<HTMLButtonElement>;
  refPrime?: Ref<HTMLDivElement>;
  onClick?: () => void;
}

// L'avis de recherche seul (sans les boutons de gain) : réutilisé par la
// cérémonie de palier.
export function AfficheWanted({
  nom,
  bounty,
  bountyFinal = bounty,
  euros,
  rang,
  className,
  refAffiche,
  refPrime,
  onClick,
}: AfficheWantedProps) {
  const [berryDispo, setBerryDispo] = useState(true);
  const palier = PALIERS[rang];
  // Les grosses primes rapetissent pour rester entre les volutes de l'affiche.
  const longueur = Math.max(bounty, bountyFinal).toLocaleString('fr-FR').length;
  const taillePrime = Math.min(11.5, 68 / (longueur * 0.59 + 0.85));

  return (
    <button
      type="button"
      ref={refAffiche}
      className={[styles.affiche, className ?? ''].join(' ')}
      data-ere={palier.ere}
      onClick={onClick}
      title={onClick ? "Voir l'ascension" : undefined}
      tabIndex={onClick ? 0 : -1}
    >
      <span className={styles.aura} aria-hidden="true" />
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
        {palier.epithete && (
          <span key={palier.epithete} className={styles.epithete}>
            « {palier.epithete} »
          </span>
        )}
      </div>

      <div className={styles.nom}>{nom}</div>

      <div ref={refPrime} className={styles.zonePrime}>
        <div className={styles.montantPrime} style={{ fontSize: `${taillePrime}cqw` }}>
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
          {bounty.toLocaleString('fr-FR')}
        </div>
        <div className={styles.montantEuros}>
          {euros.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
        </div>
      </div>

      {rang > 0 && (
        <span key={rang} className={styles.sceau} aria-label={`Palier ${rang + 1}`}>
          <span className={styles.sceauNumero}>{rang + 1}</span>
        </span>
      )}
    </button>
  );
}
