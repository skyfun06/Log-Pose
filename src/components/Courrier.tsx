import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';
import type { ReleveCourrier } from '../types';
import styles from './Courrier.module.css';

// Date courte et lisible : « 14:05 » pour aujourd'hui, sinon « lun. 5 oct. ».
function dateCourte(iso: string) {
  const date = new Date(iso);
  const memeJour = date.toDateString() === new Date().toDateString();
  return memeJour
    ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function CourrierPage() {
  const [releve, setReleve] = useState<ReleveCourrier | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const relever = useCallback(async (forcer: boolean) => {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await fetch(`${API_URL}/api/mails${forcer ? '?forcer=1' : ''}`);
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error ?? `Le serveur relais a répondu ${reponse.status}.`);
      setReleve(data as ReleveCourrier);
    } catch (err) {
      setErreur(
        err instanceof TypeError || err instanceof SyntaxError
          ? 'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».'
          : err instanceof Error
            ? err.message
            : 'Erreur inconnue.',
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void relever(false);
  }, [relever]);

  const pret = releve?.configure === true ? releve : null;
  const plusieursBoites = (pret?.comptes.length ?? 0) > 1;

  return (
    <section className={styles.page}>
      <div className={styles.carte}>
        <header className={styles.entete}>
          <div className={styles.titreBloc}>
            <h1 className={styles.titre}>Courrier</h1>
            <p className={styles.sousTitre}>
              {pret
                ? `Les mails importants des ${pret.jours} derniers jours, triés par la vigie.`
                : 'Seuls les mails importants montent à bord.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.boutonRelever}
            onClick={() => void relever(true)}
            disabled={chargement}
          >
            {chargement ? 'Relevé en cours…' : 'Relever'}
          </button>
        </header>

        {erreur && <p className={styles.alerte}>{erreur}</p>}
        {pret?.erreurs.map((e) => (
          <p key={e} className={styles.alerte}>
            {e}
          </p>
        ))}

        {chargement && !pret && (
          <p className={styles.vide}>
            La vigie trie le courrier… Le premier relevé peut prendre quelques minutes, les
            suivants sont rapides.
          </p>
        )}

        {releve?.configure === false && (
          <div className={styles.aide}>
            <p>Aucune boîte Gmail n'est encore reliée. Pour chaque boîte :</p>
            <ol>
              <li>Active la validation en deux étapes sur le compte Google.</li>
              <li>
                Crée un mot de passe d'application sur{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
                  myaccount.google.com/apppasswords
                </a>
                .
              </li>
              <li>
                Ajoute la boîte dans le fichier <code>.env</code> :{' '}
                <code>GMAIL_COMPTES=adresse@gmail.com:motdepasse,autre@gmail.com:motdepasse</code>
              </li>
              <li>
                Relance <code>npm run server</code>, puis clique sur « Relever ».
              </li>
            </ol>
          </div>
        )}

        {pret && pret.mails.length === 0 && !chargement && (
          <p className={styles.vide}>Rien d'important à l'horizon. Mer calme.</p>
        )}

        {pret && pret.mails.length > 0 && (
          <ul className={styles.liste}>
            {pret.mails.map((mail) => (
              <li key={mail.id}>
                <a
                  className={mail.nonLu ? `${styles.mail} ${styles.mailNonLu}` : styles.mail}
                  href={mail.lien ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className={styles.ligneHaut}>
                    <span className={styles.expediteur}>{mail.de}</span>
                    <span className={styles.date}>{dateCourte(mail.date)}</span>
                  </div>
                  <div className={styles.objet}>{mail.objet}</div>
                  {mail.raison && <div className={styles.raison}>{mail.raison}</div>}
                  {plusieursBoites && <span className={styles.boite}>{mail.compte}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}

        {pret && (
          <p className={styles.pied}>
            {pret.ecartes} mail{pret.ecartes > 1 ? 's' : ''} écarté{pret.ecartes > 1 ? 's' : ''} par
            le tri
            {pret.nonTries > 0 ? ` · ${pret.nonTries} en attente de tri` : ''} · relevé à{' '}
            {new Date(pret.releveLe).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </section>
  );
}
