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

// Palette « trésor » : joyaux nautiques harmonieux (or, rubis, émeraude,
// saphir, cuivre, turquoise, bronze, terracotta, olive doré, sable). L'ordre
// est stable : la couleur d'un poste dépend de sa position dans la liste.
const COULEURS = [
  '#E3B23C', // or
  '#C0453B', // rubis
  '#3E9A6B', // émeraude
  '#4F8FB0', // saphir
  '#D98A4E', // ambre cuivré
  '#6FB2A4', // turquoise
  '#B99B5E', // bronze
  '#C06A5A', // terracotta
  '#8CA85B', // olive doré
  '#D8C58A', // sable
];
const COULEUR_RESTE = 'rgba(241, 225, 188, 0.12)';

function couleurPoste(index: number): string {
  return COULEURS[index % COULEURS.length];
}

// ---- Petites maths de couleur pour les dégradés des segments ----
function estHex(c: string): boolean {
  return c.startsWith('#');
}

function hexVersRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const plein = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(plein, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function melanger([r, g, b]: [number, number, number], vers: [number, number, number], t: number): string {
  const c = (a: number, z: number) => Math.round(a + (z - a) * t);
  return `rgb(${c(r, vers[0])}, ${c(g, vers[1])}, ${c(b, vers[2])})`;
}

function eclaircir(hex: string, t: number): string {
  return melanger(hexVersRgb(hex), [255, 255, 255], t);
}

function assombrir(hex: string, t: number): string {
  return melanger(hexVersRgb(hex), [0, 0, 0], t);
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
const RAYON_ETIQUETTE = 100; // où sont posés les noms des postes
const SPAN_MIN_ETIQUETTE = 12; // n'étiquette que les parts assez grandes (degrés)

function tronquer(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

interface Arc {
  cle: string;
  nom: string;
  couleur: string;
  longueur: number; // longueur de l'arc (portion de la circonférence)
  rotation: number; // degrés, 0 = 3h ; on part de midi (-90)
  spanDeg: number; // ouverture angulaire du segment
  midAngle: number; // angle du milieu du segment (pour l'étiquette)
  pct: number; // part en % du salaire (ou de la base si pas de salaire)
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
      .map((p, i) => ({
        cle: p.id,
        nom: p.nom.trim() || 'Sans nom',
        montant: p.montant,
        couleur: couleurPoste(i),
      }))
      .filter((s) => s.montant > 0),
    ...(reste > 0
      ? [{ cle: 'reste', nom: 'Non réparti', montant: reste, couleur: COULEUR_RESTE }]
      : []),
  ];

  // Petit écart visuel entre segments (uniquement s'il y en a plusieurs).
  const ecart = segments.length > 1 ? 4 : 0;

  const arcs: Arc[] = [];
  if (base > 0) {
    let cumul = 0;
    for (const s of segments) {
      const longueur = Math.max(0, (s.montant / base) * CIRCONFERENCE - ecart);
      const rotation = -90 + (cumul / base) * 360;
      const spanDeg = (s.montant / base) * 360;
      arcs.push({
        cle: s.cle,
        nom: s.nom,
        couleur: s.couleur,
        longueur,
        rotation,
        spanDeg,
        midAngle: rotation + spanDeg / 2,
        pct: Math.round((salaire > 0 ? s.montant / salaire : s.montant / base) * 100),
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
                <defs>
                  {/* Halo doré doux sous les segments */}
                  <filter id="lueurAnneau" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow
                      dx="0"
                      dy="0"
                      stdDeviation="3"
                      floodColor="#f5de72"
                      floodOpacity="0.3"
                    />
                  </filter>
                  {/* Un dégradé « joyau » par segment : lumière venant du haut */}
                  {arcs.map((a) =>
                    estHex(a.couleur) ? (
                      <linearGradient
                        key={a.cle}
                        id={`grad-${a.cle}`}
                        gradientUnits="userSpaceOnUse"
                        x1="110"
                        y1="26"
                        x2="110"
                        y2="194"
                      >
                        <stop offset="0%" stopColor={eclaircir(a.couleur, 0.28)} />
                        <stop offset="50%" stopColor={a.couleur} />
                        <stop offset="100%" stopColor={assombrir(a.couleur, 0.18)} />
                      </linearGradient>
                    ) : null,
                  )}
                </defs>

                {/* Fins anneaux d'encadrement (dorés, translucides) */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={R + 19}
                  fill="none"
                  stroke="rgba(231, 197, 122, 0.2)"
                  strokeWidth="1"
                />
                <circle
                  cx={CX}
                  cy={CY}
                  r={R - 19}
                  fill="none"
                  stroke="rgba(231, 197, 122, 0.14)"
                  strokeWidth="1"
                />

                {/* Piste de fond */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke="rgba(10, 6, 2, 0.5)"
                  strokeWidth={EPAISSEUR}
                />

                {/* Segments */}
                <g filter="url(#lueurAnneau)">
                  {arcs.map((a) => (
                    <circle
                      key={a.cle}
                      cx={CX}
                      cy={CY}
                      r={R}
                      fill="none"
                      stroke={estHex(a.couleur) ? `url(#grad-${a.cle})` : a.couleur}
                      strokeWidth={EPAISSEUR}
                      strokeLinecap="round"
                      strokeDasharray={`${a.longueur} ${CIRCONFERENCE - a.longueur}`}
                      transform={`rotate(${a.rotation} ${CX} ${CY})`}
                      className={styles.arc}
                    />
                  ))}
                </g>

                {/* Étiquettes : nom + % de chaque poste, posés autour de l'anneau */}
                {arcs
                  .filter((a) => a.spanDeg >= SPAN_MIN_ETIQUETTE)
                  .map((a) => {
                    const rad = (a.midAngle * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const xInterne = CX + (R + EPAISSEUR / 2) * cos;
                    const yInterne = CY + (R + EPAISSEUR / 2) * sin;
                    const xExterne = CX + RAYON_ETIQUETTE * cos;
                    const yExterne = CY + RAYON_ETIQUETTE * sin;
                    const ancre = cos >= 0 ? 'start' : 'end';
                    const xTexte = xExterne + (cos >= 0 ? 3 : -3);
                    return (
                      <g key={`lbl-${a.cle}`}>
                        <line
                          x1={xInterne}
                          y1={yInterne}
                          x2={xExterne}
                          y2={yExterne}
                          className={styles.etiquetteTrait}
                        />
                        <text
                          x={xTexte}
                          y={yExterne}
                          textAnchor={ancre}
                          dominantBaseline="middle"
                          className={styles.etiquette}
                        >
                          {tronquer(a.nom, 9)} {a.pct}%
                        </text>
                      </g>
                    );
                  })}
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
              <button type="button" className={styles.boutonAjouter} onClick={() => onAjouterPoste()}>
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
                        style={{
                          background: `linear-gradient(155deg, ${eclaircir(
                            couleurPoste(i),
                            0.3,
                          )}, ${couleurPoste(i)} 55%, ${assombrir(couleurPoste(i), 0.16)})`,
                        }}
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
