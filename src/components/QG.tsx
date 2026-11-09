import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import type {
  ComptesQG,
  EtatQG,
  IdMembreQG,
  MembreQG,
  MissionQG,
  ParcoursQG,
  PropositionParcoursQG,
  PlateformeCompteQG,
  StatutMembreQG,
  StatutMissionQG,
} from '../types';
import { Markdown } from './Markdown';
import { QGNavire, type VieQG } from './QGNavire';
import { FICHES, POSTES, type IdQG } from '../data/equipageQG';
import styles from './QG.module.css';

// Onglet « QG » : le capitaine confie des missions à son équipage. Chaque
// mission lance Claude Code sur le PC (voir server/qg/index.js), avec
// l'abonnement Claude et dans le bac à sable du dossier equipage.

const LIBELLE_STATUT: Record<StatutMembreQG, string> = {
  pause: 'En pause',
  travail: 'Au travail',
  fini: 'Fini',
  erreur: 'Erreur',
};
const LIBELLE_MISSION: Record<StatutMissionQG, string> = {
  travail: 'En cours',
  fini: 'Finie',
  erreur: 'Erreur',
  annulee: 'Annulée',
};
const NOM_PLATEFORME: Record<PlateformeCompteQG, string> = { tiktok: 'TikTok', instagram: 'Instagram' };

function messageErreur(err: unknown) {
  return err instanceof TypeError || err instanceof SyntaxError
    ? 'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».'
    : err instanceof Error
      ? err.message
      : 'Erreur inconnue.';
}

async function appeler<T>(chemin: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(`${API_URL}/api/qg${chemin}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.error ?? `Le serveur relais a répondu ${reponse.status}.`);
  return data as T;
}

// État du QG en direct (flux du serveur), reconnecté tout seul s'il coupe.
function useEtatQG() {
  const [etat, setEtat] = useState<EtatQG | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  useEffect(() => {
    const flux = new EventSource(`${API_URL}/api/qg/flux`);
    flux.onmessage = (e) => {
      setHorsLigne(false);
      try {
        setEtat(JSON.parse(e.data) as EtatQG);
      } catch {
        /* message incomplet : le suivant le remplacera */
      }
    };
    flux.onerror = () => setHorsLigne(true);
    return () => flux.close();
  }, []);
  return { etat, horsLigne };
}

// Horloge qui avance chaque seconde, seulement quand c'est utile.
function useMaintenant(actif: boolean) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [actif]);
  return maintenant;
}

function duree(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${String(s % 60).padStart(2, '0')}` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Essais sans mission : « ?qg-demo=travail » (ou pause, fini, erreur) force le
// statut de tous les membres dans la scène.
const DEMO = new URLSearchParams(location.search).get('qg-demo') as StatutMembreQG | null;

type Cible = IdMembreQG | 'capitaine';
const PORTRAITS: Cible[] = ['capitaine', 'nami', 'robin', 'franky', 'brook', 'zoro'];
const LARGEUR_PARCHEMIN = 460;
const ID_MEMBRES: IdMembreQG[] = ['nami', 'robin', 'franky', 'brook', 'zoro'];

// « Robin, cherche… » → { membre: 'robin', texte: 'cherche…' }
function lireDestinataire(saisie: string): { membre: IdMembreQG; texte: string } | null {
  const m = saisie.match(/^\s*([a-zéèA-Z]+)\s*[,:]\s*([\s\S]*)$/);
  const id = m?.[1].toLowerCase() as IdMembreQG | undefined;
  return id && ID_MEMBRES.includes(id) ? { membre: id, texte: m![2] } : null;
}

function useHorloge() {
  const lire = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const [h, setH] = useState(lire);
  useEffect(() => {
    const id = setInterval(() => setH(lire()), 15_000);
    return () => clearInterval(id);
  }, []);
  return h;
}

// Le QG plein écran : la scène, et par-dessus des commandes façon jeu.
// Échap cache toutes les commandes (mode tournage).
export function QGPage() {
  const { etat, horsLigne } = useEtatQG();
  const [choisi, setChoisi] = useState<Cible | null>(null);
  const [journal, setJournal] = useState(false);
  const [tournage, setTournage] = useState(false);
  const [vies, setVies] = useState<Partial<Record<IdQG, VieQG>>>({});
  const horloge = useHorloge();

  // Mode tournage : plein écran, sans aucune commande. Échap (ou la sortie du
  // plein écran par le navigateur) ramène tout.
  const racine = useRef<HTMLDivElement>(null);
  const basculerTournage = useCallback((actif: boolean) => {
    setTournage(actif);
    if (actif) racine.current?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      (document.activeElement as HTMLElement | null)?.blur();
      setTournage((v) => {
        if (!v) racine.current?.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        return !v;
      });
    };
    const sortie = () => {
      if (!document.fullscreenElement) setTournage(false);
    };
    window.addEventListener('keydown', touche);
    document.addEventListener('fullscreenchange', sortie);
    return () => {
      window.removeEventListener('keydown', touche);
      document.removeEventListener('fullscreenchange', sortie);
    };
  }, []);

  const membres = etat ? (DEMO ? etat.membres.map((m) => ({ ...m, statut: DEMO, activite: null })) : etat.membres) : [];
  const membre = choisi && choisi !== 'capitaine' ? (membres.find((m) => m.id === choisi) ?? null) : null;
  const parchemin = !tournage && (journal || !!choisi);
  const marge = parchemin ? Math.min(LARGEUR_PARCHEMIN, window.innerWidth * 0.45) : 0;
  const quota = etat?.quota?.utilisation;

  function choisir(id: Cible | null) {
    setChoisi(id);
    setJournal(false);
  }

  return (
    <div ref={racine} className={styles.qg}>
      <QGNavire membres={membres} choisi={choisi} prive={tournage} marge={marge} passation={etat?.passation ?? null} onChoisir={choisir} onVie={(id, vie) => setVies((v) => ({ ...v, [id]: vie }))} />

      {!tournage && (
        <>
          <header className={styles.hud}>
            <nav className={styles.portraits} aria-label="Équipage">
              {PORTRAITS.map((id) => {
                const m = membres.find((x) => x.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={choisi === id ? `${styles.portrait} ${styles.portraitChoisi}` : styles.portrait}
                    onClick={() => choisir(choisi === id ? null : id)}
                    title={m ? `${m.nom} · ${LIBELLE_STATUT[m.statut]}` : 'Le capitaine'}
                  >
                    <span className={styles.visage}>
                      <img src={`/qg/${id}-portrait.png`} alt="" draggable={false} />
                    </span>
                    {m && <span className={styles.voyant} data-statut={m.statut} />}
                  </button>
                );
              })}
            </nav>
            <div className={styles.infos}>
              {etat && (
                <span className={styles.info} title="2 membres maximum au travail en même temps (pour ménager ton quota).">
                  ⚓ {etat.auTravail}/{etat.max}
                </span>
              )}
              {quota != null && (
                <span className={quota >= 0.9 ? `${styles.info} ${styles.infoAlerte}` : styles.info} title="Part de ton abonnement Claude déjà utilisée (dernière mission).">
                  Quota {Math.round(quota * 100)} %
                </span>
              )}
              {etat?.parcours?.map((pc) => (
                <span key={pc.id} className={styles.info} title="Ordre automatique en cours">
                  🧭{' '}
                  {pc.etapes.map((e, i) => (
                    <span key={i} className={i === pc.etape ? styles.etapeActive : i < pc.etape ? styles.etapeFaite : undefined}>
                      {i > 0 && ' → '}
                      {nomDe(e.membre)}
                    </span>
                  ))}
                  <button
                    type="button"
                    className={styles.miniCroix}
                    onClick={() => {
                      if (window.confirm('Arrêter cet ordre automatique ? L’étape en cours sera annulée.')) {
                        void appeler(`/parcours/${pc.id}`, { method: 'DELETE' }).catch(() => {});
                      }
                    }}
                    aria-label="Arrêter le parcours"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <span className={styles.info}>{horloge}</span>
              <button type="button" className={styles.boutonJeu} onClick={() => { setJournal((v) => !v); setChoisi(null); }} title="Journal de bord : tous les résultats">
                📜 Journal
              </button>
              <button type="button" className={styles.boutonJeu} onClick={() => basculerTournage(true)} title="Plein écran sans aucune info (Échap pour revenir)">
                🎬 Tournage
              </button>
            </div>
          </header>

          {parchemin && (
            <aside className={styles.parchemin} style={{ width: marge }}>
              <button type="button" className={styles.fermer} onClick={() => choisir(null)} aria-label="Fermer">
                ✕
              </button>
              {journal && <JournalBord majs={etat?.auTravail ?? 0} />}
              {!journal && choisi && <CarnetMembre key={choisi} id={choisi} membre={membre} vie={vies[choisi]} />}
            </aside>
          )}

          {etat && <BarreOrdres membres={membres} choisi={choisi} etat={etat} onEnvoye={(id) => choisir(id)} />}
          {horsLigne && <p className={styles.horsLigne}>{etat ? 'Connexion au serveur perdue, nouvelle tentative…' : messageErreur(new TypeError())}</p>}
        </>
      )}
    </div>
  );
}

// Étape d'un ordre automatique : on montre l'ordre du capitaine, pas la consigne interne.
const ordreCourt = (texte: string) => texte.match(/^Ordre du capitaine : « ([\s\S]*?) »\n/)?.[1] ?? texte;

// Le carnet d'un membre (parchemin) : l'essentiel d'abord, bien lisible.
//   1. qui il est, son statut ;
//   2. ce qu'il fait et à quoi il pense, en direct ;
//   3. sa mission en cours (avec Annuler), sinon son dernier résultat ;
//   4. repliés : l'historique, les comptes suivis (Robin), et le reste de sa fiche.
function CarnetMembre({ id, membre, vie }: { id: IdQG; membre: MembreQG | null; vie?: VieQG }) {
  const fiche = FICHES[id];
  const [historique, setHistorique] = useState<MissionQG[] | null>(null);
  const [affichee, setAffichee] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const maintenant = useMaintenant(membre?.statut === 'travail');
  const idMembre = membre?.id ?? null;

  // L'historique se recharge à chaque étape de la mission en cours.
  const recharger = useCallback(async () => {
    if (!idMembre) return;
    try {
      setHistorique(await appeler<MissionQG[]>(`/missions?membre=${idMembre}`));
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }, [idMembre]);
  useEffect(() => {
    void recharger();
  }, [recharger, membre?.statut, membre?.activite]);

  const enCours = historique?.find((m) => m.statut === 'travail') ?? null;
  const resultat = historique?.find((m) => m.id === affichee) ?? historique?.find((m) => m.statut !== 'travail') ?? null;

  // Résultat affiché = vu : le membre repasse en pause.
  useEffect(() => {
    if (resultat && !resultat.vue) void appeler(`/missions/${resultat.id}/vue`, { method: 'POST' }).catch(() => {});
  }, [resultat]);

  async function annuler() {
    if (!membre || !window.confirm(`Annuler la mission de ${membre.nom} ? Le travail en cours sera perdu.`)) return;
    try {
      await appeler(`/${membre.id}/mission`, { method: 'DELETE' });
      await recharger();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const propositions = id === 'robin';
  return (
    <article className={styles.carnet} data-membre={id}>
      <header className={styles.carnetTete}>
        <span className={styles.ficheVisage}>
          <img src={`/qg/${id}-portrait.png`} alt="" draggable={false} />
        </span>
        <div className={styles.carnetIdentite}>
          <h2 className={styles.carnetNom}>{fiche.nom}</h2>
          <p className={styles.carnetPoste}>
            {fiche.poste} · {fiche.lieu}
          </p>
          {membre && (
            <span className={styles.carnetStatut} data-statut={membre.statut}>
              {LIBELLE_STATUT[membre.statut]}
              {membre.statut === 'travail' && membre.depuis && ` · ${duree(maintenant - Date.parse(membre.depuis))}`}
            </span>
          )}
        </div>
      </header>

      <section className={styles.carnetBloc}>
        <p className={styles.carnetFait}>
          {membre?.statut === 'travail' && membre.activite ? `${fiche.nom} ${membre.activite}…` : vie?.fait ? `${fiche.nom} ${vie.fait}.` : '…'}
        </p>
        {vie?.pense && <p className={styles.carnetPense}>« {vie.pense} »</p>}
      </section>

      {erreur && <p className={styles.alerte}>{erreur}</p>}

      {enCours && (
        <section className={styles.carnetBloc}>
          <h3 className={styles.carnetTitre}>Mission en cours</h3>
          <p className={styles.carnetConsigne}>{ordreCourt(enCours.texte)}</p>
          <ol className={styles.carnetEtapes}>
            {enCours.activites.slice(-4).map((a, i) => (
              <li key={i}>{a.texte}</li>
            ))}
          </ol>
          <button type="button" className={styles.carnetAnnuler} onClick={annuler}>
            Annuler la mission
          </button>
        </section>
      )}

      {resultat && (
        <section className={styles.carnetBloc}>
          <h3 className={styles.carnetTitre}>
            {affichee ? 'Mission' : 'Dernier résultat'}
            <span className={styles.carnetDate}>
              {dateCourte(resultat.debut)} · {LIBELLE_MISSION[resultat.statut]}
            </span>
          </h3>
          <p className={styles.carnetConsigne}>{ordreCourt(resultat.texte)}</p>
          {resultat.erreur && <p className={styles.alerte}>{resultat.erreur}</p>}
          {resultat.resultat && <Markdown texte={resultat.resultat} className={`${styles.markdown} ${styles.carnetMarkdown}`} />}
        </section>
      )}

      {membre && historique?.length === 0 && (
        <p className={styles.carnetVide}>Aucune mission pour l’instant. Écris-lui un ordre dans la barre en bas.</p>
      )}
      {!membre && <p className={styles.carnetVide}>C’est toi. Donne un ordre dans la barre en bas : avec un nom pour un membre, sans nom pour laisser le second choisir.</p>}

      {historique && historique.length > 1 && (
        <details className={styles.carnetPli}>
          <summary>Historique · {historique.length} missions</summary>
          <ul className={styles.historique}>
            {historique.map((m) => (
              <li key={m.id}>
                <button type="button" className={m.id === resultat?.id ? `${styles.ligne} ${styles.ligneActive}` : styles.ligne} onClick={() => setAffichee(m.id)}>
                  <span className={styles.pastille} data-statut={m.statut} title={LIBELLE_MISSION[m.statut]} />
                  <span className={styles.ligneTexte}>{m.texte}</span>
                  <span className={styles.ligneDate}>{dateCourte(m.debut)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {propositions && (
        <details className={styles.carnetPli}>
          <summary>Comptes suivis</summary>
          <ComptesSuivis />
        </details>
      )}

      <details className={styles.carnetPli}>
        <summary>En savoir plus sur {fiche.nom}</summary>
        <dl className={styles.ficheInfos}>
          <dt>Devise</dt>
          <dd>« {fiche.devise} »</dd>
          <dt>Habitudes</dt>
          <dd>{POSTES[id].habitudes.map((h) => h.quoi).join(' · ')}</dd>
          <dt>Depuis le QG</dt>
          <dd>{fiche.peut}</dd>
        </dl>
      </details>
    </article>
  );
}

// Barre d'ordres façon boîte de dialogue : « Robin, … », ou le membre choisi.
function BarreOrdres({ membres, choisi, etat, onEnvoye }: { membres: MembreQG[]; choisi: Cible | null; etat: EtatQG; onEnvoye: (id: IdMembreQG) => void }) {
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [proposition, setProposition] = useState<PropositionParcoursQG | null>(null);
  const [modifier, setModifier] = useState(false);
  const prefixe = lireDestinataire(saisie);
  const id = prefixe?.membre ?? (choisi && choisi !== 'capitaine' ? choisi : null);
  const texte = prefixe ? prefixe.texte : saisie;
  const dest = membres.find((m) => m.id === id) ?? null;
  const occupe = dest?.statut === 'travail';
  const complet = !occupe && etat.auTravail >= etat.max;
  const pret = !!dest && !!texte.trim() && !occupe && !complet && !envoi;

  // Ordre sans destinataire : le second choisit le parcours (rien n'est lancé).
  async function proposer() {
    if (!saisie.trim() || envoi) return;
    setErreur(null);
    setEnvoi(true);
    try {
      setProposition(await appeler<PropositionParcoursQG>('/parcours/proposer', { method: 'POST', body: JSON.stringify({ texte: saisie.trim() }) }));
      setModifier(false);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function lancerParcours() {
    if (!proposition || proposition.etapes.length === 0) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await appeler('/parcours', { method: 'POST', body: JSON.stringify(proposition) });
      setProposition(null);
      setSaisie('');
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyer() {
    if (!dest) return void proposer();
    if (!pret) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await appeler(`/${dest.id}/mission`, { method: 'POST', body: JSON.stringify({ texte: texte.trim() }) });
      setSaisie('');
      onEnvoye(dest.id);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  const aide = !dest
    ? 'Sans nom, le second choisit les membres pour toi (« Robin, … » pour un seul membre).'
    : occupe
      ? `${dest.nom} est déjà en mission.`
      : complet
        ? `Déjà ${etat.max} membres au travail : attends qu’un finisse.`
        : `Ordre pour ${dest.nom} · Entrée pour envoyer, Maj+Entrée pour aller à la ligne`;

  return (
    <div className={styles.ordres}>
      {proposition && (
        <div className={styles.proposition}>
          <span className={styles.propositionTitre}>
            🧭 {proposition.type} :{' '}
            {proposition.etapes.map((e, i) => (
              <span key={i} className={styles.etapeChoisie}>
                {i > 0 && ' → '}
                {nomDe(e.membre)}
                {modifier && (
                  <button
                    type="button"
                    className={styles.miniCroix}
                    onClick={() => setProposition({ ...proposition, etapes: proposition.etapes.filter((_, j) => j !== i) })}
                    aria-label={`Retirer ${nomDe(e.membre)}`}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {modifier && proposition.etapes.length < 5 && (
              <select
                className={styles.ajoutEtape}
                value=""
                onChange={(e) =>
                  setProposition({ ...proposition, etapes: [...proposition.etapes, { membre: e.target.value as IdMembreQG, consigne: '' }] })
                }
                aria-label="Ajouter une étape"
              >
                <option value="">+ étape</option>
                {ID_MEMBRES.map((id) => (
                  <option key={id} value={id}>
                    {nomDe(id)}
                  </option>
                ))}
              </select>
            )}
          </span>
          {proposition.raison && <span className={styles.ordreAide}>{proposition.raison}</span>}
          <span className={styles.propositionActions}>
            <button type="button" className={styles.boutonJeu} onClick={lancerParcours} disabled={envoi || proposition.etapes.length === 0}>
              Lancer
            </button>
            <button type="button" className={styles.boutonDiscret} onClick={() => setModifier((v) => !v)}>
              {modifier ? 'OK' : 'Modifier'}
            </button>
            <button type="button" className={styles.boutonDiscret} onClick={() => setProposition(null)}>
              Annuler
            </button>
          </span>
        </div>
      )}
      <span className={styles.destinataire}>{dest ? dest.nom : '🧭'}</span>
      <textarea
        className={styles.ordreSaisie}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void envoyer();
          }
        }}
        placeholder="Robin, étudie les vidéos qui cartonnent sur…"
        maxLength={4000}
        rows={1}
      />
      <button type="button" className={styles.boutonJeu} onClick={envoyer} disabled={dest ? !pret : !saisie.trim() || envoi}>
        {envoi ? '…' : dest ? 'Envoyer' : 'Proposer'}
      </button>
      <span className={erreur ? `${styles.ordreAide} ${styles.ordreErreur}` : styles.ordreAide}>{erreur ?? aide}</span>
    </div>
  );
}

// Journal de bord : les résultats de tout l'équipage, du plus récent au plus ancien.
function JournalBord({ majs }: { majs: number }) {
  const [liste, setListe] = useState<MissionQG[] | null>(null);
  const [ouverte, setOuverte] = useState<MissionQG | null>(null);
  const [parcours, setParcours] = useState<ParcoursQG[]>([]);
  const [parcoursOuvert, setParcoursOuvert] = useState<ParcoursQG | null>(null);
  useEffect(() => {
    appeler<MissionQG[]>('/missions')
      .then(setListe)
      .catch(() => setListe([]));
    appeler<ParcoursQG[]>('/parcours')
      .then(setParcours)
      .catch(() => setParcours([]));
  }, [majs]);

  if (parcoursOuvert) {
    const p = parcoursOuvert;
    return (
      <div className={styles.journalBord}>
        <button type="button" className={styles.retour} onClick={() => setParcoursOuvert(null)}>
          ← Journal de bord
        </button>
        <h3 className={styles.panneauTitre}>
          🧭 {p.etapes.map((e) => nomDe(e.membre)).join(' → ')}{' '}
          <span className={styles.panneauPoste}>{dateCourte(p.debut)} · {LIBELLE_PARCOURS[p.statut]}</span>
        </h3>
        <p className={styles.consigne}>« {p.texte} »</p>
        {p.erreur && <p className={styles.alerte}>{p.erreur}</p>}
        {p.resultat && <Markdown texte={p.resultat} className={styles.markdown} />}
        {p.etapes.slice(0, p.resultat ? -1 : undefined).map((e, i) =>
          e.resultat ? (
            <details key={i} className={styles.details}>
              <summary>Étape {i + 1} : le travail de {nomDe(e.membre)}</summary>
              <Markdown texte={e.resultat} className={styles.markdown} />
            </details>
          ) : null,
        )}
      </div>
    );
  }

  if (ouverte) {
    return (
      <div className={styles.journalBord}>
        <button type="button" className={styles.retour} onClick={() => setOuverte(null)}>
          ← Journal de bord
        </button>
        <h3 className={styles.panneauTitre}>
          {nomDe(ouverte.membre)}{' '}
          <span className={styles.panneauPoste}>
            {dateCourte(ouverte.debut)} · {LIBELLE_MISSION[ouverte.statut]}
          </span>
        </h3>
        <p className={styles.consigne}>« {ouverte.texte} »</p>
        {ouverte.erreur && <p className={styles.alerte}>{ouverte.erreur}</p>}
        {ouverte.resultat && <Markdown texte={ouverte.resultat} className={styles.markdown} />}
      </div>
    );
  }
  return (
    <div className={styles.journalBord}>
      <h3 className={styles.panneauTitre}>Journal de bord</h3>
      {liste?.length === 0 && <p className={styles.note}>Aucune mission pour l’instant.</p>}
      <ul className={styles.historique}>
        {parcours.map((p) => (
          <li key={p.id} data-date={p.debut}>
            <button type="button" className={styles.ligne} onClick={() => setParcoursOuvert(p)}>
              <span className={styles.pastille} data-statut={p.statut === 'annule' ? 'annulee' : p.statut} title={LIBELLE_PARCOURS[p.statut]} />
              <strong>🧭 {p.etapes.map((e) => nomDe(e.membre)).join(' → ')}</strong>
              <span className={styles.ligneTexte}>{p.texte}</span>
              <span className={styles.ligneDate}>{dateCourte(p.debut)}</span>
            </button>
          </li>
        ))}
        {liste?.filter((m) => !m.parcoursId).map((m) => (
          <li key={m.id}>
            <button type="button" className={styles.ligne} onClick={() => setOuverte(m)}>
              <span className={styles.pastille} data-statut={m.statut} title={LIBELLE_MISSION[m.statut]} />
              <strong>{nomDe(m.membre)}</strong>
              <span className={styles.ligneTexte}>{m.texte}</span>
              <span className={styles.ligneDate}>{dateCourte(m.debut)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const nomDe = (id: IdMembreQG) => id[0].toUpperCase() + id.slice(1);
const LIBELLE_PARCOURS: Record<ParcoursQG['statut'], string> = { travail: 'En cours', fini: 'Fini', erreur: 'Erreur', annule: 'Annulé' };

// Comptes suivis par Robin : ce que lisent ses skills de recherche. Robin en
// propose à la fin de ses missions ; seul le capitaine les ajoute.
function ComptesSuivis() {
  const [donnees, setDonnees] = useState<ComptesQG | null>(null);
  const [plateforme, setPlateforme] = useState<PlateformeCompteQG>('tiktok');
  const [pseudo, setPseudo] = useState('');
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    appeler<ComptesQG>('/comptes')
      .then(setDonnees)
      .catch((err) => setErreur(messageErreur(err)));
  }, []);

  async function agir(action: Promise<ComptesQG>) {
    setErreur(null);
    try {
      setDonnees(await action);
      return true;
    } catch (err) {
      setErreur(messageErreur(err));
      return false;
    }
  }

  async function ajouter() {
    const ok = await agir(appeler('/comptes', { method: 'POST', body: JSON.stringify({ plateforme, pseudo, note }) }));
    if (ok) {
      setPseudo('');
      setNote('');
    }
  }

  const tous = donnees
    ? (Object.keys(donnees.comptes) as PlateformeCompteQG[]).flatMap((p) => donnees.comptes[p].map((c) => ({ ...c, plateforme: p })))
    : [];

  return (
    <section className={styles.comptes}>
      <h4 className={styles.sousTitreBloc}>Comptes suivis</h4>

      {donnees && donnees.propositions.length > 0 && (
        <div className={styles.propositions}>
          <p className={styles.note}>Robin te propose :</p>
          <ul className={styles.listeComptes}>
            {donnees.propositions.map((c) => (
              <li key={`${c.missionId}-${c.index}`} className={styles.compte}>
                <span className={styles.plateforme} data-plateforme={c.plateforme}>
                  {NOM_PLATEFORME[c.plateforme]}
                </span>
                <span className={styles.pseudo}>{c.pseudo}</span>
                <span className={styles.compteNote}>{c.note}</span>
                <button
                  type="button"
                  className={styles.petitBouton}
                  onClick={() =>
                    agir(
                      appeler('/comptes', {
                        method: 'POST',
                        body: JSON.stringify({ ...c, proposition: { missionId: c.missionId, index: c.index } }),
                      }),
                    )
                  }
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  className={`${styles.petitBouton} ${styles.petitBoutonDiscret}`}
                  onClick={() => agir(appeler(`/propositions/${c.missionId}/${c.index}/ignorer`, { method: 'POST' }))}
                >
                  Ignorer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {donnees && tous.length === 0 && <p className={styles.note}>Aucun compte suivi pour l’instant.</p>}
      <ul className={styles.listeComptes}>
        {tous.map((c) => (
          <li key={`${c.plateforme}${c.pseudo}`} className={styles.compte}>
            <span className={styles.plateforme} data-plateforme={c.plateforme}>
              {NOM_PLATEFORME[c.plateforme]}
            </span>
            <span className={styles.pseudo}>{c.pseudo}</span>
            <span className={styles.compteNote}>{c.note}</span>
            <button
              type="button"
              className={`${styles.petitBouton} ${styles.petitBoutonDiscret}`}
              onClick={() =>
                agir(appeler(`/comptes/${c.plateforme}/${encodeURIComponent(c.pseudo.replace(/^@/, ''))}`, { method: 'DELETE' }))
              }
              aria-label={`Retirer ${c.pseudo}`}
              title="Retirer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        className={styles.ajoutCompte}
        onSubmit={(e) => {
          e.preventDefault();
          if (pseudo.trim()) void ajouter();
        }}
      >
        <select value={plateforme} onChange={(e) => setPlateforme(e.target.value as PlateformeCompteQG)} aria-label="Plateforme">
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
        </select>
        <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="@pseudo" aria-label="Pseudo" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" aria-label="Note" maxLength={140} />
        <button type="submit" className={styles.petitBouton} disabled={!pseudo.trim()}>
          Ajouter
        </button>
      </form>
      {erreur && <p className={styles.alerte}>{erreur}</p>}
    </section>
  );
}
