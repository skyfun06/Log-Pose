import { useState } from 'react';
import type { CreneauRecap, Recap } from '../types';
import styles from './Recap.module.css';

interface RecapPageProps {
  recaps: Recap[];
  creneau: CreneauRecap | null;
  enPreparation: boolean;
  erreur: string | null;
  onRefaire: () => void;
}

// « 2026-10-11-matin » → date du jour concerné.
function dateDeCle(cle: string): Date {
  const [annee, mois, jour] = cle.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

// Nom lisible d'un récap : « Ce matin », « Hier soir », « lun. 5 oct. · soir ».
function nomRecap(recap: Recap): string {
  const date = dateDeCle(recap.cle);
  const aujourdhui = new Date();
  const hier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - 1);
  if (date.toDateString() === aujourdhui.toDateString()) return `Ce ${recap.moment}`;
  if (date.toDateString() === hier.toDateString()) return `Hier ${recap.moment}`;
  const jour = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${jour} · ${recap.moment}`;
}

function heureCourte(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function RecapPage({ recaps, creneau, enPreparation, erreur, onRefaire }: RecapPageProps) {
  const [cleChoisie, setCleChoisie] = useState<string | null>(null);

  // Par défaut on montre le plus récent ; un clic dans l'historique en choisit un autre.
  const recap = recaps.find((r) => r.cle === cleChoisie) ?? recaps[0] ?? null;
  const estActuel = recap !== null && recap.cle === creneau?.cle;
  const matin = recap?.moment === 'matin';

  const faites = recap?.habitudes.filter((h) => h.etat === 'fait').length ?? 0;

  return (
    <section className={styles.page}>
      <div className={styles.carte}>
        <header className={styles.entete}>
          <div className={styles.titreBloc}>
            <h1 className={styles.titre}>
              {recap ? `Récap · ${nomRecap(recap)}` : 'Récap'}
            </h1>
            <p className={styles.sousTitre}>
              {recap
                ? `Préparé à ${heureCourte(recap.creeLe)}. Un nouveau récap arrive chaque matin et chaque soir.`
                : 'Un récap du navire chaque matin et chaque soir.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.boutonRefaire}
            onClick={onRefaire}
            disabled={enPreparation}
          >
            {enPreparation ? 'Préparation…' : 'Refaire'}
          </button>
        </header>

        {recaps.length > 1 && (
          <nav className={styles.historique} aria-label="Récaps précédents">
            {recaps.map((r) => (
              <button
                key={r.cle}
                type="button"
                className={r.cle === recap?.cle ? `${styles.puce} ${styles.puceActive}` : styles.puce}
                onClick={() => setCleChoisie(r.cle)}
              >
                {nomRecap(r)}
              </button>
            ))}
          </nav>
        )}

        {erreur && <p className={styles.alerte}>{erreur}</p>}
        {recap?.erreurs.map((e) => (
          <p key={e} className={styles.alerte}>
            {e}
          </p>
        ))}

        {enPreparation && (
          <p className={styles.attente}>
            Le second relève le courrier et prépare le récap… Cela peut prendre quelques minutes.
          </p>
        )}

        {!recap && !enPreparation && !erreur && (
          <p className={styles.attente}>Aucun récap pour l'instant.</p>
        )}

        {recap && (
          <>
            {recap.mot && <blockquote className={styles.mot}>{recap.mot}</blockquote>}

            <div className={styles.grille}>
              <section className={styles.bloc}>
                <h2 className={styles.blocTitre}>
                  {matin ? "Au programme aujourd'hui" : 'Au programme demain'}
                </h2>
                {recap.planning.length === 0 ? (
                  <p className={styles.blocVide}>Rien de prévu.</p>
                ) : (
                  <ul className={styles.liste}>
                    {recap.planning.map((b) => (
                      <li key={`${b.heureDebut}-${b.titre}`} className={styles.ligne}>
                        <span className={styles.heure}>
                          {b.heureDebut} – {b.heureFin}
                        </span>
                        <span className={styles.texte}>{b.titre}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.bloc}>
                <h2 className={styles.blocTitre}>
                  {matin ? 'Habitudes à tenir' : 'Habitudes du jour'}
                  {!matin && recap.habitudes.length > 0 && (
                    <span className={styles.compteur}>
                      {faites} / {recap.habitudes.length}
                    </span>
                  )}
                </h2>
                {recap.habitudes.length === 0 ? (
                  <p className={styles.blocVide}>Aucune habitude suivie ce jour-là.</p>
                ) : (
                  <ul className={styles.liste}>
                    {recap.habitudes.map((h) => (
                      <li key={h.nom} className={styles.ligne}>
                        <span aria-hidden="true">
                          {h.etat === 'fait' ? '✅' : h.etat === 'rate' ? '❌' : '⚪'}
                        </span>
                        <span className={styles.texte}>{h.nom}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={styles.bloc}>
              <h2 className={styles.blocTitre}>
                Courrier important
                {recap.courrier.configure && recap.courrier.nonLus > 0 && (
                  <span className={styles.compteur}>
                    {recap.courrier.nonLus} non lu{recap.courrier.nonLus > 1 ? 's' : ''} cette semaine
                  </span>
                )}
              </h2>
              {!recap.courrier.configure ? (
                <p className={styles.blocVide}>
                  Aucune boîte Gmail reliée (voir l'onglet Courrier).
                </p>
              ) : recap.courrier.nouveaux.length === 0 ? (
                <p className={styles.blocVide}>
                  Rien de nouveau depuis {matin ? 'hier soir' : 'ce matin'}.
                </p>
              ) : (
                <ul className={styles.liste}>
                  {recap.courrier.nouveaux.map((mail) => (
                    <li key={mail.id}>
                      <a
                        className={styles.mail}
                        href={mail.lien ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className={styles.expediteur}>{mail.de}</span>
                        <span className={styles.texte}>{mail.objet}</span>
                        {mail.raison && <span className={styles.raison}>{mail.raison}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!estActuel && creneau && (
              <p className={styles.pied}>Tu consultes un ancien récap.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
