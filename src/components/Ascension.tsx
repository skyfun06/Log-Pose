import { useEffect, useState } from 'react';
import {
  BERRYS_PAR_EURO,
  ERES,
  NAVIRES,
  PALIERS,
  deblocages,
  positionPalier,
} from '../data/paliers';
import { EQUIPAGE, equipageRecrute, prochaineRecrue } from '../data/equipage';
import type { Etape, Gain, Ile } from '../types';
import { Cranes } from './Cranes';
import { Portrait } from './Portrait';
import { Navire } from './Navire';
import styles from './Ascension.module.css';

interface AscensionProps {
  prime: number;
  gains: Gain[];
  atteintLe: Record<number, string>;
  butins: Record<number, string>;
  onDefinirButin: (index: number, texte: string) => void;
  onSupprimerGain: (id: string) => void;
  onRemettreAZero: () => void;
  onFermer: () => void;
  ongletInitial?: Onglet;
  // Voyage et régularité (onglets Équipage et Exploits).
  iles: Ile[];
  etapes: Record<number, Etape[]>;
  ilesConquises: Record<number, string>;
  joursEnMer: number;
  serie: number;
  meilleureSerie: number;
}

export type Onglet = 'route' | 'equipage' | 'exploits' | 'registre';

const euros = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
const berrys = (e: number) => `฿ ${(e * BERRYS_PAR_EURO).toLocaleString('fr-FR')}`;
const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Panneau d'ascension : où en est le personnage, la route des paliers avec
// ce que chacun débloque et le butin réel promis, et le registre des gains.
export function Ascension({
  prime,
  gains,
  atteintLe,
  butins,
  onDefinirButin,
  onSupprimerGain,
  onRemettreAZero,
  onFermer,
  ongletInitial = 'route',
  iles,
  etapes,
  ilesConquises,
  joursEnMer,
  serie,
  meilleureSerie,
}: AscensionProps) {
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial);
  const { index, actuel, suivant, avancement, reste } = positionPalier(prime);

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [onFermer]);

  return (
    <div className={styles.overlay} onClick={onFermer}>
      <div
        className={styles.panneau}
        role="dialog"
        aria-modal="true"
        aria-label="Ascension"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
          ×
        </button>

        <header className={styles.tete}>
          <div className={styles.teteNavire}>
            <Navire niveau={actuel.navire} />
            <span className={styles.nomNavire}>{NAVIRES[actuel.navire]}</span>
          </div>
          <div className={styles.teteInfos}>
            <span className={styles.ere}>{ERES[actuel.ere].nom}</span>
            <h2 className={styles.rang}>{actuel.titre}</h2>
            {actuel.epithete && <span className={styles.epithete}>« {actuel.epithete} »</span>}
            <span className={styles.prime}>
              {berrys(prime)} <span className={styles.primeEuros}>· {euros(prime)} gagnés</span>
            </span>
            {suivant && (
              <div className={styles.jauge}>
                <div className={styles.jaugeRail}>
                  <div className={styles.jaugeRemplie} style={{ width: `${avancement * 100}%` }} />
                </div>
                <span className={styles.jaugeTexte}>
                  {Math.floor(avancement * 100)} % vers {suivant.titre} · encore{' '}
                  {euros(Math.ceil(reste))}
                </span>
              </div>
            )}
          </div>
        </header>

        <div className={styles.onglets} role="tablist">
          {(
            [
              ['route', 'Route des primes'],
              ['equipage', `Équipage (${equipageRecrute(joursEnMer).length}/${EQUIPAGE.length})`],
              ['exploits', 'Exploits'],
              ['registre', `Gains (${gains.length})`],
            ] as [Onglet, string][]
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={onglet === cle}
              className={onglet === cle ? styles.ongletActif : styles.onglet}
              onClick={() => setOnglet(cle)}
            >
              {libelle}
            </button>
          ))}
        </div>

        <div className={styles.corps}>
          {onglet === 'route' ? (
            <ol className={styles.route}>
              {PALIERS.map((p, i) => {
                const etat = i <= index ? 'atteint' : i === index + 1 ? 'vise' : 'loin';
                return (
                  <li key={p.titre} className={styles.etape} data-etat={etat} data-ere={p.ere}>
                    <span className={styles.medaille}>{i + 1}</span>
                    <div className={styles.etapeCorps}>
                      <div className={styles.etapeTete}>
                        <span className={styles.etapeTitre}>
                          {p.titre}
                          {p.epithete && <em> « {p.epithete} »</em>}
                        </span>
                        <span className={styles.etapeSeuil}>
                          {berrys(p.seuil)} <span>· {euros(p.seuil)}</span>
                        </span>
                      </div>
                      <ul className={styles.deblocages}>
                        {deblocages(i).map((d) => (
                          <li key={d.genre} data-genre={d.genre}>
                            {d.texte}
                          </li>
                        ))}
                      </ul>
                      <div className={styles.etapePied}>
                        {etat === 'atteint' ? (
                          <span className={styles.atteint}>
                            ✓{' '}
                            {i === 0
                              ? 'Point de départ'
                              : atteintLe[i]
                                ? `Atteint le ${dateCourte(atteintLe[i])}`
                                : 'Atteint'}
                          </span>
                        ) : etat === 'vise' ? (
                          <span className={styles.vise}>
                            Cap en cours · {Math.floor(avancement * 100)} %
                          </span>
                        ) : (
                          <span className={styles.loin}>À conquérir</span>
                        )}
                        {i > 0 && (
                          <ChampButin
                            valeur={butins[i] ?? ''}
                            obtenu={etat === 'atteint'}
                            onChange={(t) => onDefinirButin(i, t)}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : onglet === 'equipage' ? (
            <Equipage joursEnMer={joursEnMer} serie={serie} meilleureSerie={meilleureSerie} />
          ) : onglet === 'exploits' ? (
            <Exploits
              iles={iles}
              etapes={etapes}
              ilesConquises={ilesConquises}
              atteintLe={atteintLe}
              joursEnMer={joursEnMer}
              meilleureSerie={meilleureSerie}
            />
          ) : (
            <Registre
              gains={gains}
              onSupprimer={onSupprimerGain}
              onRemettreAZero={onRemettreAZero}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Récompense réelle promise pour un palier (« un resto », « un nouveau
// clavier »…), enregistrée en quittant le champ.
function ChampButin({
  valeur,
  obtenu,
  onChange,
}: {
  valeur: string;
  obtenu: boolean;
  onChange: (texte: string) => void;
}) {
  const [texte, setTexte] = useState(valeur);
  useEffect(() => setTexte(valeur), [valeur]);
  return (
    <label className={obtenu ? `${styles.butin} ${styles.butinObtenu}` : styles.butin}>
      <span className={styles.butinEtiquette}>{obtenu ? 'Butin gagné' : 'Butin promis'}</span>
      <input
        type="text"
        value={texte}
        placeholder="Ta récompense réelle…"
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => texte !== valeur && onChange(texte.trim())}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

function Registre({
  gains,
  onSupprimer,
  onRemettreAZero,
}: {
  gains: Gain[];
  onSupprimer: (id: string) => void;
  onRemettreAZero: () => void;
}) {
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  if (gains.length === 0) {
    return (
      <p className={styles.vide}>
        Aucun gain pour l'instant. Chaque euro gagné s'inscrit ici, avec sa date : ajoute-les sous
        l'affiche WANTED.
      </p>
    );
  }

  return (
    <>
      <ul className={styles.registre}>
        {gains
          .slice()
          .reverse()
          .map((g) => (
            <li key={g.id} className={styles.gain}>
              <span className={styles.gainMontant}>+{euros(g.montant)}</span>
              <span className={styles.gainInfos}>
                <span className={styles.gainNote}>{g.note ?? 'Gain'}</span>
                <span className={styles.gainDate}>{dateCourte(g.date)}</span>
              </span>
              {aConfirmer === g.id ? (
                <span className={styles.confirmer}>
                  Annuler ce gain ?
                  <button type="button" onClick={() => onSupprimer(g.id)}>
                    Oui
                  </button>
                  <button type="button" onClick={() => setAConfirmer(null)}>
                    Non
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.supprimer}
                  onClick={() => setAConfirmer(g.id)}
                  aria-label="Annuler ce gain"
                  title="Annuler ce gain (erreur de saisie)"
                >
                  ×
                </button>
              )}
            </li>
          ))}
      </ul>
      <div className={styles.remise}>
        {aConfirmer === 'tout' ? (
          <span className={styles.confirmer}>
            Effacer tous les gains et repartir de 0 € ?
            <button type="button" onClick={onRemettreAZero}>
              Oui
            </button>
            <button type="button" onClick={() => setAConfirmer(null)}>
              Non
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={styles.boutonRemise}
            onClick={() => setAConfirmer('tout')}
          >
            Remettre la prime à 0 €
          </button>
        )}
      </div>
    </>
  );
}

// L'équipage : recruté au fil des jours en mer (jamais perdu).
function Equipage({
  joursEnMer,
  serie,
  meilleureSerie,
}: {
  joursEnMer: number;
  serie: number;
  meilleureSerie: number;
}) {
  const prochaine = prochaineRecrue(joursEnMer);
  return (
    <>
      <div className={styles.bilan}>
        <div>
          <strong>{joursEnMer}</strong>
          <span>jours en mer</span>
        </div>
        <div>
          <strong>{serie}</strong>
          <span>jours de série</span>
        </div>
        <div>
          <strong>{meilleureSerie}</strong>
          <span>meilleure série</span>
        </div>
      </div>
      <p className={styles.explication}>
        Chaque jour où tu avances (une habitude tenue, une étape cochée ou un gain) compte comme un
        jour en mer. L'équipage grandit avec eux, et personne ne quitte le navire.
        {prochaine && (
          <>
            {' '}
            Prochaine recrue dans <strong>{prochaine.jours - joursEnMer}</strong> jour
            {prochaine.jours - joursEnMer > 1 ? 's' : ''} : {prochaine.titre}.
          </>
        )}
      </p>
      <ul className={styles.equipage}>
        {EQUIPAGE.map((m) => {
          const recrute = joursEnMer >= m.jours;
          return (
            <li
              key={m.role}
              className={recrute ? styles.membre : `${styles.membre} ${styles.membreVerrouille}`}
            >
              <Portrait role={m.role} recrute={recrute} taille={52} />
              <div className={styles.membreTexte}>
                <span className={styles.membreTitre}>{recrute ? m.titre : '???'}</span>
                <span className={styles.membreApport}>
                  {recrute ? m.apport : `Rejoint l'équipage à ${m.jours} jours en mer`}
                </span>
                {recrute && <em className={styles.membreCitation}>« {m.citation} »</em>}
              </div>
              <span className={styles.membreJours}>{m.jours} j</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface Exploit {
  date: string;
  genre: 'ile' | 'etape' | 'palier';
  titre: string;
  detail: string;
  difficulte?: Etape['difficulte'];
}

// Le tableau d'honneur : îles conquises, étapes « exploit » et paliers de
// prime, du plus récent au plus ancien.
function Exploits({
  iles,
  etapes,
  ilesConquises,
  atteintLe,
  joursEnMer,
  meilleureSerie,
}: {
  iles: Ile[];
  etapes: Record<number, Etape[]>;
  ilesConquises: Record<number, string>;
  atteintLe: Record<number, string>;
  joursEnMer: number;
  meilleureSerie: number;
}) {
  const liste: Exploit[] = [];
  let etapesFaites = 0;
  let exploitsFaits = 0;
  for (const ile of iles) {
    if (ilesConquises[ile.id]) {
      liste.push({
        date: ilesConquises[ile.id],
        genre: 'ile',
        titre: ile.titre,
        detail: `Île ${ile.numero} conquise`,
      });
    }
    for (const e of etapes[ile.id] ?? []) {
      if (!e.faiteLe) continue;
      etapesFaites++;
      if (e.difficulte === 3) {
        exploitsFaits++;
        liste.push({
          date: e.faiteLe,
          genre: 'etape',
          titre: e.texte,
          detail: ile.titre,
          difficulte: 3,
        });
      }
    }
  }
  for (const [i, date] of Object.entries(atteintLe)) {
    const p = PALIERS[Number(i)];
    if (p)
      liste.push({
        date,
        genre: 'palier',
        titre: p.titre,
        detail: `Palier de prime · ${berrys(p.seuil)}`,
      });
  }
  liste.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className={styles.bilan}>
        <div>
          <strong>{Object.keys(ilesConquises).length}</strong>
          <span>îles conquises</span>
        </div>
        <div>
          <strong>{etapesFaites}</strong>
          <span>étapes franchies</span>
        </div>
        <div>
          <strong>{exploitsFaits}</strong>
          <span>exploits</span>
        </div>
        <div>
          <strong>{joursEnMer}</strong>
          <span>jours en mer</span>
        </div>
        <div>
          <strong>{meilleureSerie}</strong>
          <span>meilleure série</span>
        </div>
      </div>
      {liste.length === 0 ? (
        <p className={styles.vide}>
          Ton tableau d'honneur est vide pour l'instant. Coche une étape « exploit » sur la carte,
          conquiers une île ou franchis un palier de prime : chaque victoire s'inscrira ici.
        </p>
      ) : (
        <ol className={styles.exploits}>
          {liste.map((x, i) => (
            <li key={i} className={styles.exploit} data-genre={x.genre}>
              <span className={styles.exploitIcone} aria-hidden="true">
                {x.genre === 'ile' ? '⚑' : x.genre === 'palier' ? '฿' : '★'}
              </span>
              <span className={styles.exploitTexte}>
                <strong>{x.titre}</strong>
                <span>{x.detail}</span>
              </span>
              {x.difficulte && <Cranes niveau={x.difficulte} />}
              <span className={styles.exploitDate}>{dateCourte(x.date)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
