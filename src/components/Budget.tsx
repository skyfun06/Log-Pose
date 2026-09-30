import type { PosteBudget } from '../types';
import styles from './Budget.module.css';

interface BudgetPageProps {
  salaire: number;
  postes: PosteBudget[];
  totalReparti: number;
  restant: number;
  onDefinirSalaire: (salaire: number) => void;
  onAjouterPoste: () => void;
  onModifierPoste: (id: string, patch: Partial<Omit<PosteBudget, 'id'>>) => void;
  onSupprimerPoste: (id: string) => void;
}

// Palette de segments, choisie dans les tokens du thème (or / bronze / accents).
// L'ordre est stable : la couleur d'un poste dépend de sa position dans la liste.
const COULEURS = [
  '#c9a24e',
  '#b33a2e',
  '#3f8a4c',
  '#7fb0d6',
  '#b99b5e',
  '#e7c57a',
  '#8a6a2e',
  '#d9c090',
  '#c08a2e',
  '#8f2c22',
];
const COULEUR_RESTE = 'rgba(241, 225, 188, 0.14)';

function couleurPoste(index: number): string {
  return COULEURS[index % COULEURS.length];
}

function formatEuro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

// Géométrie de l'anneau.
const R = 82;
const CX = 110;
const CY = 110;
const EPAISSEUR = 26;
const CIRCONFERENCE = 2 * Math.PI * R;

interface Arc {
  cle: string;
  couleur: string;
  longueur: number; // longueur de l'arc (portion de la circonférence)
  rotation: number; // degrés, 0 = 3h ; on part de midi (-90)
}

export function BudgetPage({
  salaire,
  postes,
  totalReparti,
  restant,
  onDefinirSalaire,
  onAjouterPoste,
  onModifierPoste,
  onSupprimerPoste,
}: BudgetPageProps) {
  // Base de l'anneau : le salaire s'il couvre la répartition, sinon le total
  // réparti (dépassement de budget → l'anneau reste plein et proportionnel).
  const base = Math.max(salaire, totalReparti);
  const reste = salaire > totalReparti ? salaire - totalReparti : 0;
  const depassement = restant < 0;

  // Segments à tracer (postes non nuls + éventuel « non réparti »).
  const segments = [
    ...postes
      .map((p, i) => ({ cle: p.id, montant: p.montant, couleur: couleurPoste(i) }))
      .filter((s) => s.montant > 0),
    ...(reste > 0 ? [{ cle: 'reste', montant: reste, couleur: COULEUR_RESTE }] : []),
  ];

  // Petit écart visuel entre segments (uniquement s'il y en a plusieurs).
  const ecart = segments.length > 1 ? 4 : 0;

  const arcs: Arc[] = [];
  if (base > 0) {
    let cumul = 0;
    for (const s of segments) {
      const longueur = Math.max(0, (s.montant / base) * CIRCONFERENCE - ecart);
      arcs.push({
        cle: s.cle,
        couleur: s.couleur,
        longueur,
        rotation: -90 + (cumul / base) * 360,
      });
      cumul += s.montant;
    }
  }

  const pourcentReparti = salaire > 0 ? Math.round((totalReparti / salaire) * 100) : 0;

  return (
    <section className={styles.page}>
      <div className={styles.carte}>
        {/* ---- En-tête : titre + salaire sur une ligne ---- */}
        <header className={styles.entete}>
          <div className={styles.titreBloc}>
            <h1 className={styles.titre}>Budget</h1>
            <p className={styles.sousTitre}>Répartis ton salaire du mois, à la barre.</p>
          </div>
          <label className={styles.salaireBloc}>
            <span className={styles.salaireLabel}>Salaire mensuel</span>
            <div className={styles.salaireChamp}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className={styles.salaireInput}
                value={salaire === 0 ? '' : salaire}
                onChange={(e) => onDefinirSalaire(Number(e.target.value))}
                placeholder="0"
              />
              <span className={styles.salaireDevise}>€</span>
            </div>
          </label>
        </header>

        <div className={styles.corps}>
          {/* ---- Colonne gauche : anneau + totaux ---- */}
          <div className={styles.colGauche}>
            <div className={styles.graphe}>
              <svg
                className={styles.donut}
                viewBox="0 0 220 220"
                role="img"
                aria-label="Répartition du budget"
              >
                <circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke="rgba(10, 6, 2, 0.5)"
                  strokeWidth={EPAISSEUR}
                />
                {arcs.map((a) => (
                  <circle
                    key={a.cle}
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke={a.couleur}
                    strokeWidth={EPAISSEUR}
                    strokeLinecap="round"
                    strokeDasharray={`${a.longueur} ${CIRCONFERENCE - a.longueur}`}
                    transform={`rotate(${a.rotation} ${CX} ${CY})`}
                    className={styles.arc}
                  />
                ))}
              </svg>

              {/* Frame centrale : gouvernail décoratif, remplaçable par ta propre
                  image (mets-la dans .frameInner à la place de <Gouvernail />). */}
              <div className={styles.frameCentre}>
                <div className={styles.frameInner}>
                  <Gouvernail />
                </div>
              </div>
            </div>

            <div className={styles.totaux}>
              <div className={styles.totalPill}>
                <span className={styles.totalLabel}>Réparti</span>
                <strong className={styles.totalValeur}>{formatEuro(totalReparti)}</strong>
                <span className={styles.totalNote}>{pourcentReparti}% du salaire</span>
              </div>
              <div className={styles.totalPill}>
                <span className={styles.totalLabel}>
                  {depassement ? 'Dépassement' : 'Reste à répartir'}
                </span>
                <strong
                  className={`${styles.totalValeur} ${depassement ? styles.negatif : styles.positif}`}
                >
                  {formatEuro(Math.abs(restant))}
                </strong>
                <span className={styles.totalNote}>
                  {depassement ? 'au-delà du salaire' : 'encore disponible'}
                </span>
              </div>
            </div>
          </div>

          {/* ---- Colonne droite : répartition ---- */}
          <div className={styles.colDroite}>
            <div className={styles.postesEntete}>
              <h2 className={styles.postesTitre}>Répartition</h2>
              <button type="button" className={styles.boutonAjouter} onClick={onAjouterPoste}>
                + Poste
              </button>
            </div>

            {postes.length === 0 ? (
              <div className={styles.vide}>
                <div className={styles.videIcone} aria-hidden="true">
                  🧭
                </div>
                <p className={styles.videTitre}>Aucun poste pour l'instant</p>
                <p className={styles.videTexte}>
                  Ajoute tes postes (loyer, courses, épargne, plaisirs…) et répartis ton salaire
                  comme bon te semble.
                </p>
              </div>
            ) : (
              <ul className={styles.liste}>
                {postes.map((p, i) => {
                  const part = salaire > 0 ? Math.round((p.montant / salaire) * 100) : 0;
                  return (
                    <li key={p.id} className={styles.poste}>
                      <span
                        className={styles.pastille}
                        style={{ background: couleurPoste(i) }}
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        className={styles.posteNom}
                        value={p.nom}
                        onChange={(e) => onModifierPoste(p.id, { nom: e.target.value })}
                        placeholder="Nom du poste"
                      />
                      <span className={styles.postePart}>{part}%</span>
                      <div className={styles.posteMontant}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          className={styles.posteInput}
                          value={p.montant === 0 ? '' : p.montant}
                          onChange={(e) =>
                            onModifierPoste(p.id, { montant: Number(e.target.value) })
                          }
                          placeholder="0"
                        />
                        <span className={styles.posteDevise}>€</span>
                      </div>
                      <button
                        type="button"
                        className={styles.posteSupprimer}
                        aria-label={`Supprimer le poste ${p.nom || 'sans nom'}`}
                        onClick={() => onSupprimerPoste(p.id)}
                      >
                        🗑
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Gouvernail (barre à roue) dessiné en SVG, dans les tons bronze du thème.
function Gouvernail() {
  const branches = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);
  return (
    <svg viewBox="0 0 100 100" className={styles.gouvernail} aria-hidden="true">
      {branches.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="6" className={styles.gRayon} />
          <circle cx="50" cy="7" r="4.5" className={styles.gPoignee} />
        </g>
      ))}
      <circle cx="50" cy="50" r="30" fill="none" className={styles.gJante} />
      <circle cx="50" cy="50" r="11" className={styles.gMoyeuFond} />
      <circle cx="50" cy="50" r="11" fill="none" className={styles.gMoyeuBord} />
      <circle cx="50" cy="50" r="3.2" className={styles.gCentre} />
    </svg>
  );
}
