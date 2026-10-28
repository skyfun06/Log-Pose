import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCategoriesCerveau } from '../state/useCategoriesCerveau';
import {
  correspondAuFiltre,
  dateFiche,
  dateLisible,
  montantFiche,
  montantLisible,
  tailleLisible,
} from '../data/formatCerveau';
import { urlFichier, type Cerveau } from '../state/useCerveau';
import type { FicheCerveau, InfosCerveau } from '../types';
import { CerveauForm } from './CerveauForm';
import { IconeCategorie, Vignette } from './CerveauIcones';
import { GrapheCerveau } from './GrapheCerveau';
import base from './BlocForm.module.css';
import styles from './Cerveau.module.css';

const SUGGESTIONS = [
  'Ma dernière fiche de paie',
  "Les factures d'électricité",
  'Le design que j’ai rangé récemment',
];

const CLE_AFFICHAGE = 'log-pose-cale-affichage';

interface Depot {
  file: File[];
  total: number; // fichiers déposés depuis le début du dépôt
  ranges: number; // dont rangés (les autres ont été passés)
}

const DEPOT_VIDE: Depot = { file: [], total: 0, ranges: 0 };

// Petit texte d'état de la lecture par Ollama.
function etatLecture(fiche: FicheCerveau): string | null {
  switch (fiche.analyse.etat) {
    case 'attente':
      return 'En file pour la lecture';
    case 'en-cours':
      return 'La vigie lit le fichier…';
    case 'echec':
      return 'Lecture ratée';
    default:
      return null;
  }
}

// Le second cerveau, sur la page du Going Merry : à gauche on demande, à
// droite la cale où sont rangés les fichiers. L'état vit dans App : la page
// Budget s'en sert aussi (fiches de paie).
export function SecondCerveau({ cerveau }: { cerveau: Cerveau }) {
  const { fichiers } = cerveau;

  // Dépôt en cours : les fichiers qui attendent leur formulaire, un par un.
  const [depot, setDepot] = useState<Depot>(DEPOT_VIDE);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<FicheCerveau | null>(null);
  const [glisse, setGlisse] = useState(false);
  // Sur petit écran, une seule colonne à la fois.
  const [colonne, setColonne] = useState<'demander' | 'cale'>('demander');
  const champFichier = useRef<HTMLInputElement>(null);

  const accueillir = useCallback((liste: FileList | File[]) => {
    const nouveaux = Array.from(liste).filter((f) => f.size > 0);
    if (nouveaux.length === 0) return;
    setDepot((d) =>
      d.file.length === 0
        ? { file: nouveaux, total: nouveaux.length, ranges: 0 }
        : { ...d, file: [...d.file, ...nouveaux], total: d.total + nouveaux.length },
    );
  }, []);

  function suivant(range: boolean) {
    setDepot((d) => ({ ...d, file: d.file.slice(1), ranges: d.ranges + (range ? 1 : 0) }));
  }
  const finDepot = useCallback(() => setDepot(DEPOT_VIDE), []);

  // Glisser-déposer n'importe où sur la page.
  const profondeur = useRef(0);
  function surDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    profondeur.current += 1;
    setGlisse(true);
  }
  function surDragLeave() {
    profondeur.current = Math.max(0, profondeur.current - 1);
    if (profondeur.current === 0) setGlisse(false);
  }
  function surDrop(e: React.DragEvent) {
    e.preventDefault();
    profondeur.current = 0;
    setGlisse(false);
    accueillir(e.dataTransfer.files);
  }

  // Ctrl+V d'une image ou d'un fichier (hors champ de texte).
  useEffect(() => {
    const surColler = (e: ClipboardEvent) => {
      const fichiersColles = Array.from(e.clipboardData?.files ?? []);
      if (fichiersColles.length === 0) return;
      e.preventDefault();
      accueillir(fichiersColles);
    };
    window.addEventListener('paste', surColler);
    return () => window.removeEventListener('paste', surColler);
  }, [accueillir]);

  const parId = useMemo(() => new Map(fichiers.map((f) => [f.id, f])), [fichiers]);
  const ficheOuverte = ouverte ? parId.get(ouverte) ?? null : null;
  const ouvrir = (id: string) => setOuverte(id);

  const enCours = depot.file[0];
  const numero = depot.total - depot.file.length + 1;

  return (
    <section
      className={styles.page}
      onDragEnter={surDragEnter}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDragLeave={surDragLeave}
      onDrop={surDrop}
    >
      <input
        ref={champFichier}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) accueillir(e.target.files);
          e.target.value = '';
        }}
      />

      <div className={styles.bascule} role="tablist" aria-label="Second cerveau">
        <button
          type="button"
          role="tab"
          aria-selected={colonne === 'demander'}
          className={colonne === 'demander' ? `${styles.basculeBouton} ${styles.basculeActif}` : styles.basculeBouton}
          onClick={() => setColonne('demander')}
        >
          Demander
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={colonne === 'cale'}
          className={colonne === 'cale' ? `${styles.basculeBouton} ${styles.basculeActif}` : styles.basculeBouton}
          onClick={() => setColonne('cale')}
        >
          La cale · {fichiers.length}
        </button>
      </div>

      <div className={styles.cadre} data-colonne={colonne}>
        <Conversation cerveau={cerveau} parId={parId} onOuvrir={ouvrir} />
        <Cale
          fichiers={fichiers}
          charge={cerveau.charge}
          erreur={cerveau.erreur}
          onDeposer={() => champFichier.current?.click()}
          onOuvrir={ouvrir}
        />
      </div>

      {glisse && (
        <div className={styles.voileDepot} aria-hidden="true">
          <div className={styles.voileCadre}>
            <IconeCategorie nom="Autre" className={styles.voileIcone} />
            Lâche pour ranger dans la cale
          </div>
        </div>
      )}

      {enCours && (
        <CerveauForm
          key={numero}
          fichier={enCours}
          position={{ numero, total: depot.total }}
          onValider={async (infos) => {
            await cerveau.deposer(enCours, infos);
            suivant(true);
            setColonne('cale');
          }}
          onAnnuler={() => suivant(false)}
        />
      )}
      {!enCours && depot.total > 1 && depot.ranges > 0 && (
        <Toast
          texte={`${depot.ranges} fichier${depot.ranges > 1 ? 's' : ''} rangé${depot.ranges > 1 ? 's' : ''} dans la cale.`}
          onFin={finDepot}
        />
      )}

      {ficheOuverte && !enEdition && (
        <Detail
          fiche={ficheOuverte}
          onFermer={() => setOuverte(null)}
          onModifier={() => setEnEdition(ficheOuverte)}
          onSupprimer={async () => {
            await cerveau.supprimer(ficheOuverte.id);
            setOuverte(null);
          }}
          onRelire={() => cerveau.relire(ficheOuverte.id)}
        />
      )}
      {enEdition && (
        <CerveauForm
          fiche={enEdition}
          onValider={async (infos: InfosCerveau) => {
            await cerveau.modifier(enEdition.id, infos);
            setEnEdition(null);
          }}
          onAnnuler={() => setEnEdition(null)}
        />
      )}
    </section>
  );
}

// ---------- Conversation ----------

function Conversation({
  cerveau,
  parId,
  onOuvrir,
}: {
  cerveau: Cerveau;
  parId: Map<string, FicheCerveau>;
  onOuvrir: (id: string) => void;
}) {
  const { messages, reflechit, pistes, demander, effacerChat } = cerveau;
  const [saisie, setSaisie] = useState('');
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, reflechit, pistes]);

  function envoyer(texte = saisie) {
    if (!texte.trim() || reflechit) return;
    setSaisie('');
    void demander(texte);
  }

  const pistesConnues = pistes.map((id) => parId.get(id)).filter((f): f is FicheCerveau => !!f);

  return (
    <div className={`${styles.panneau} ${styles.conversation}`}>
      <header className={styles.entete}>
        <div>
          <h1 className={styles.titre}>Second cerveau</h1>
          <p className={styles.sousTitre}>Demande, la vigie fouille la cale pour toi.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className={styles.boutonDiscret} onClick={effacerChat} disabled={reflechit}>
            Effacer
          </button>
        )}
      </header>

      <div className={styles.fil}>
        {messages.length === 0 && !reflechit && (
          <div className={styles.accueil}>
            <p>Dis-moi ce que tu cherches, avec tes mots.</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={styles.suggestion} onClick={() => envoyer(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const trouves = (m.ids ?? []).map((id) => parId.get(id)).filter((f): f is FicheCerveau => !!f);
          return (
            <div key={i} className={m.role === 'user' ? styles.bulleMoi : styles.bulleVigie}>
              <p className={styles.bulleTexte}>{m.content}</p>
              {trouves.length > 0 && <Trouvailles fiches={trouves} onOuvrir={onOuvrir} />}
              {m.role === 'assistant' && (m.ids?.length ?? 0) > trouves.length && (
                <p className={styles.bulleNote}>Certains fichiers ont été retirés de la cale depuis.</p>
              )}
            </div>
          );
        })}

        {reflechit && (
          <div className={styles.bulleVigie}>
            <p className={styles.reflexion}>
              La vigie fouille la cale
              <span className={styles.points} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </p>
            {pistesConnues.length > 0 && (
              <>
                <p className={styles.bulleNote}>Premières pistes :</p>
                <Trouvailles fiches={pistesConnues} onOuvrir={onOuvrir} />
              </>
            )}
          </div>
        )}
        <div ref={fin} />
      </div>

      <form
        className={styles.saisie}
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <input
          type="text"
          className={styles.saisieChamp}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Ex : ma fiche de paie de septembre"
          aria-label="Ta question"
          maxLength={500}
        />
        <button type="submit" className={styles.boutonOr} disabled={reflechit || !saisie.trim()}>
          Demander
        </button>
      </form>
    </div>
  );
}

// Les fichiers cités dans une réponse.
function Trouvailles({ fiches, onOuvrir }: { fiches: FicheCerveau[]; onOuvrir: (id: string) => void }) {
  return (
    <ul className={styles.trouvailles}>
      {fiches.map((f) => {
        const date = dateFiche(f);
        const montant = montantFiche(f);
        return (
          <li key={f.id}>
            <button type="button" className={styles.trouvaille} onClick={() => onOuvrir(f.id)}>
              <Vignette fiche={f} className={styles.vignettePetite} />
              <span className={styles.trouvailleTexte}>
                <span className={styles.trouvailleNom}>{f.nom}</span>
                <span className={styles.meta}>
                  {[f.categorie, dateLisible(date), montantLisible(montant)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- La cale ----------

function Cale({
  fichiers,
  charge,
  erreur,
  onDeposer,
  onOuvrir,
}: {
  fichiers: FicheCerveau[];
  charge: boolean;
  erreur: string | null;
  onDeposer: () => void;
  onOuvrir: (id: string) => void;
}) {
  const [filtre, setFiltre] = useState('');
  const [categorie, setCategorie] = useState<string | null>(null);
  const [affichage, setAffichage] = useState<'graphe' | 'grille'>(() => {
    try {
      return localStorage.getItem(CLE_AFFICHAGE) === 'grille' ? 'grille' : 'graphe';
    } catch {
      return 'graphe';
    }
  });
  function choisirAffichage(choix: 'graphe' | 'grille') {
    setAffichage(choix);
    try {
      localStorage.setItem(CLE_AFFICHAGE, choix);
    } catch {
      /* préférence non gardée, tant pis */
    }
  }

  const toutesCategories = useCategoriesCerveau();
  const comptes = useMemo(() => {
    const parCategorie = new Map<string, number>();
    for (const f of fichiers) parCategorie.set(f.categorie, (parCategorie.get(f.categorie) ?? 0) + 1);
    return parCategorie;
  }, [fichiers]);

  const visibles = fichiers.filter(
    (f) => (!categorie || f.categorie === categorie) && correspondAuFiltre(f, filtre),
  );
  // Catégories connues d'abord, puis celles venues d'ailleurs.
  const categories = [
    ...toutesCategories.map((c) => c.nom).filter((n) => comptes.has(n)),
    ...[...comptes.keys()].filter((n) => !toutesCategories.some((c) => c.nom === n)),
  ];

  return (
    <div className={`${styles.panneau} ${styles.cale}`}>
      <header className={styles.entete}>
        <div>
          <h2 className={styles.titre}>La cale</h2>
          <p className={styles.sousTitre}>
            {fichiers.length === 0
              ? 'Glisse un fichier ici, ou colle-le avec Ctrl+V.'
              : `${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''} à bord.`}
          </p>
        </div>
        <div className={styles.enteteActions}>
          {fichiers.length > 0 && (
            <div className={styles.affichage} role="group" aria-label="Affichage de la cale">
              {(['graphe', 'grille'] as const).map((choix) => (
                <button
                  key={choix}
                  type="button"
                  aria-pressed={affichage === choix}
                  className={affichage === choix ? `${styles.affichageBouton} ${styles.affichageActif}` : styles.affichageBouton}
                  onClick={() => choisirAffichage(choix)}
                >
                  {choix === 'graphe' ? 'Graphe' : 'Grille'}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={styles.boutonOr} onClick={onDeposer}>
            + Déposer
          </button>
        </div>
      </header>

      {erreur && <p className={styles.alerte}>{erreur}</p>}

      {charge && fichiers.length === 0 && !erreur && (
        <button type="button" className={styles.zoneVide} onClick={onDeposer}>
          <IconeCategorie nom="Autre" className={styles.zoneVideIcone} />
          <span className={styles.zoneVideTitre}>Ta cale est vide</span>
          <span>
            Factures, fiches de paie, designs qui te plaisent… Dépose-les ici : tu les retrouveras
            juste en demandant.
          </span>
        </button>
      )}

      {fichiers.length > 0 && (
        <>
          <div className={styles.filtres}>
            <input
              type="search"
              className={styles.filtreChamp}
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Filtrer la cale…"
              aria-label="Filtrer la cale"
            />
            {categories.length > 1 && (
              <div className={styles.puces}>
                <button
                  type="button"
                  className={categorie === null ? `${styles.puce} ${styles.puceActive}` : styles.puce}
                  onClick={() => setCategorie(null)}
                >
                  Tout
                </button>
                {categories.map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    className={categorie === nom ? `${styles.puce} ${styles.puceActive}` : styles.puce}
                    onClick={() => setCategorie(categorie === nom ? null : nom)}
                  >
                    {nom} <span className={styles.puceCompte}>{comptes.get(nom)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibles.length === 0 ? (
            <p className={styles.rien}>Rien dans la cale ne correspond.</p>
          ) : affichage === 'graphe' ? (
            <GrapheCerveau
              fichiers={visibles}
              onOuvrir={onOuvrir}
              onCategorie={(nom) => setCategorie(categorie === nom ? null : nom)}
            />
          ) : (
            <ul className={styles.grille}>
              {visibles.map((f) => (
                <li key={f.id}>
                  <CarteFichier fiche={f} onOuvrir={() => onOuvrir(f.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CarteFichier({ fiche, onOuvrir }: { fiche: FicheCerveau; onOuvrir: () => void }) {
  const etat = etatLecture(fiche);
  const date = dateFiche(fiche);
  const montant = montantFiche(fiche);
  return (
    <button type="button" className={styles.carte} onClick={onOuvrir}>
      <Vignette fiche={fiche} className={styles.vignetteCarte} />
      <span className={styles.carteCorps}>
        <span className={styles.carteNom}>{fiche.nom}</span>
        <span className={styles.meta}>
          {[fiche.categorie, dateLisible(date)].filter(Boolean).join(' · ')}
        </span>
        {montant !== null && <span className={styles.carteMontant}>{montantLisible(montant)}</span>}
        {etat && (
          <span className={fiche.analyse.etat === 'echec' ? `${styles.etat} ${styles.etatEchec}` : styles.etat}>
            {etat}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------- Fiche détaillée ----------

function Detail({
  fiche,
  onFermer,
  onModifier,
  onSupprimer,
  onRelire,
}: {
  fiche: FicheCerveau;
  onFermer: () => void;
  onModifier: () => void;
  onSupprimer: () => Promise<void>;
  onRelire: () => Promise<void>;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  async function agir(action: () => Promise<void>) {
    setOccupe(true);
    setErreur('');
    try {
      await action();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setOccupe(false);
    }
  }

  const { type } = fiche.fichier;
  const url = urlFichier(fiche.id);
  const analyse = fiche.analyse;
  const date = dateFiche(fiche);
  const montant = montantFiche(fiche);
  const etat = etatLecture(fiche);

  return (
    <div className={base.overlay} onClick={onFermer}>
      <div
        className={styles.detail}
        role="dialog"
        aria-modal="true"
        aria-label={fiche.nom}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.detailApercu}>
          {type.startsWith('image/') ? (
            <img src={url} alt={fiche.nom} />
          ) : type === 'application/pdf' ? (
            <iframe src={url} title={fiche.nom} />
          ) : (
            <Vignette fiche={fiche} className={styles.vignetteGrande} />
          )}
        </div>

        <div className={styles.detailInfos}>
          <div className={styles.detailTete}>
            <span className={styles.detailCategorie}>
              <IconeCategorie nom={fiche.categorie} className={styles.detailCategorieIcone} />
              {fiche.categorie}
            </span>
            <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
              ×
            </button>
          </div>
          <h2 className={styles.detailNom}>{fiche.nom}</h2>

          <dl className={styles.proprietes}>
            {date && (
              <>
                <dt>Date</dt>
                <dd>
                  {dateLisible(date)}
                  {!fiche.date && <span className={styles.repere}> · repérée par la vigie</span>}
                </dd>
              </>
            )}
            {montant !== null && (
              <>
                <dt>Montant</dt>
                <dd>
                  {montantLisible(montant)}
                  {fiche.montant === null && <span className={styles.repere}> · repéré par la vigie</span>}
                </dd>
              </>
            )}
            <dt>Rangé le</dt>
            <dd>{dateLisible(fiche.ajouteLe)}</dd>
            <dt>Fichier</dt>
            <dd className={styles.coupe}>
              {fiche.fichier.nomOrigine} · {tailleLisible(fiche.fichier.taille)}
            </dd>
          </dl>

          {fiche.note && <p className={styles.detailNote}>« {fiche.note} »</p>}

          {analyse.etat === 'faite' && analyse.resume && (
            <div className={styles.lecture}>
              <span className={styles.lectureTitre}>Ce qu'en a lu la vigie</span>
              <p>{analyse.resume}</p>
              {analyse.motsCles.length > 0 && (
                <div className={styles.motsCles}>
                  {analyse.motsCles.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {etat && (
            <p className={analyse.etat === 'echec' ? styles.alerte : styles.bulleNote}>
              {analyse.etat === 'echec' ? `${etat} : ${analyse.raison}` : etat}
            </p>
          )}
          {analyse.etat === 'sans-objet' && <p className={styles.bulleNote}>{analyse.raison}</p>}
          {erreur && <p className={styles.alerte}>{erreur}</p>}

          <div className={styles.actions}>
            <a className={styles.boutonOr} href={url} target="_blank" rel="noreferrer">
              Ouvrir
            </a>
            <a className={styles.boutonBois} href={urlFichier(fiche.id, true)}>
              Télécharger
            </a>
            <button type="button" className={styles.boutonBois} onClick={onModifier}>
              Modifier
            </button>
            {analyse.etat === 'echec' && (
              <button type="button" className={styles.boutonBois} disabled={occupe} onClick={() => agir(onRelire)}>
                Relire
              </button>
            )}
            {confirmer ? (
              <button
                type="button"
                className={styles.boutonDanger}
                disabled={occupe}
                onClick={() => agir(onSupprimer)}
              >
                Vraiment supprimer ?
              </button>
            ) : (
              <button type="button" className={styles.boutonDiscret} onClick={() => setConfirmer(true)}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ texte, onFin }: { texte: string; onFin: () => void }) {
  useEffect(() => {
    const id = setTimeout(onFin, 3200);
    return () => clearTimeout(id);
  }, [onFin]);
  return (
    <div className={styles.toast} role="status">
      {texte}
    </div>
  );
}
