import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { API_URL } from '../config';
import type { EtatReseau, IdReseau, StatsReseau, VideoReseau } from '../types';
import styles from './Reseaux.module.css';

// Plateformes de l'onglet, dans l'ordre. Celles que le serveur ne connaît pas
// encore (voir server/reseaux/index.js) s'affichent « bientôt ».
const PLATEFORMES: { id: IdReseau; nom: string; aide?: () => ReactNode }[] = [
  { id: 'tiktok', nom: 'TikTok', aide: () => <AideTiktok /> },
  { id: 'instagram', nom: 'Instagram', aide: () => <AideInstagram /> },
  { id: 'youtube', nom: 'YouTube & Shorts' },
];

const TYPES_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];

type EtatEnvoi = 'en-cours' | 'recue' | 'publiee' | 'echec';

// Une vidéo déposée : d'abord envoyée au serveur relais, puis suivie sur
// chaque plateforme visée.
interface Envoi {
  cle: string;
  nom: string;
  progression: number; // 0..1, envoi vers le serveur relais
  erreur?: string; // échec avant d'atteindre les plateformes
  plateformes: { id: IdReseau; etat: EtatEnvoi; message?: string }[];
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const nombre = (n: number) => compact.format(n);
const nomDe = (id: IdReseau) => PLATEFORMES.find((p) => p.id === id)?.nom ?? id;

function messageErreur(err: unknown) {
  return err instanceof TypeError || err instanceof SyntaxError
    ? 'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».'
    : err instanceof Error
      ? err.message
      : 'Erreur inconnue.';
}

async function appeler<T>(chemin: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(`${API_URL}/api/reseaux${chemin}`, init);
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.error ?? `Le serveur relais a répondu ${reponse.status}.`);
  return data as T;
}

type ReponseEnvoi = { plateforme: IdReseau; idEnvoi?: string; erreur?: string }[];

// Envoi brut de la vidéo au serveur relais, avec la progression (fetch ne la
// donne pas pour un envoi).
function televerser(
  fichier: File,
  vers: IdReseau[],
  legende: string,
  surProgression: (p: number) => void,
) {
  return new Promise<ReponseEnvoi>((resoudre, rejeter) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/reseaux/videos?vers=${vers.join(',')}`);
    xhr.setRequestHeader('Content-Type', fichier.type);
    if (legende) xhr.setRequestHeader('X-Reseaux-Legende', encodeURIComponent(legende));
    xhr.upload.onprogress = (e) => e.lengthComputable && surProgression(e.loaded / e.total);
    xhr.onload = () => {
      let data: { envois?: ReponseEnvoi; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* réponse vide */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.envois) resoudre(data.envois);
      else rejeter(new Error(data.error ?? `Le serveur relais a répondu ${xhr.status}.`));
    };
    xhr.onerror = () => rejeter(new TypeError('réseau'));
    xhr.send(fichier);
  });
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Suit l'envoi sur une plateforme jusqu'à ce qu'elle l'ait traité (20 min max :
// Instagram peut être long à digérer une vidéo).
async function suivre(id: IdReseau, idEnvoi: string): Promise<{ etat: EtatEnvoi; message?: string }> {
  for (let i = 0; i < 120; i++) {
    const statut = await appeler<{ etat: EtatEnvoi; raison?: string }>(
      `/${id}/videos/${encodeURIComponent(idEnvoi)}`,
    );
    if (statut.etat === 'echec') return { etat: 'echec', message: `Vidéo refusée : ${statut.raison}` };
    if (statut.etat !== 'en-cours') return { etat: statut.etat };
    await attendre(10_000);
  }
  return { etat: 'recue', message: 'Toujours en traitement : regarde dans l’appli.' };
}

export function ReseauxPage() {
  const [etats, setEtats] = useState<EtatReseau[] | null>(null);
  const [choisie, setChoisie] = useState<IdReseau>('tiktok');
  const [stats, setStats] = useState<Partial<Record<IdReseau, StatsReseau>>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Comptes cochés ou décochés pour le prochain dépôt. Par défaut, ceux qui
  // publient tout de suite en public (Instagram) sont décochés : on les vise
  // exprès, jamais par accident.
  const [choix, setChoix] = useState<Partial<Record<IdReseau, boolean>>>({});
  const [legende, setLegende] = useState('');
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [glisse, setGlisse] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async (forcer: boolean) => {
    setChargement(true);
    setErreur(null);
    try {
      const liste = await appeler<EtatReseau[]>('');
      setEtats(liste);
      const reliees = liste.filter((e) => e.connecte);
      const releves = await Promise.allSettled(
        reliees.map((e) => appeler<StatsReseau>(`/${e.id}/stats${forcer ? '?forcer=1' : ''}`)),
      );
      setStats(
        Object.fromEntries(
          releves.flatMap((r, i) => (r.status === 'fulfilled' ? [[reliees[i].id, r.value]] : [])),
        ),
      );
      const rate = releves.find((r) => r.status === 'rejected');
      if (rate) setErreur(messageErreur(rate.reason));
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger(false);
  }, [charger]);

  // Retour sur l'onglet après une connexion dans un autre onglet : on revérifie.
  const toutRelie = etats?.every((e) => e.connecte || !e.configure) ?? false;
  useEffect(() => {
    if (toutRelie) return;
    const auRetour = () => document.visibilityState === 'visible' && void charger(false);
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [toutRelie, charger]);

  const reliees = etats?.filter((e) => e.connecte) ?? [];
  const estVisee = (e: EtatReseau) => choix[e.id] ?? !e.publique;
  const cibles = reliees.filter(estVisee);
  const avecLegende = cibles.some((e) => e.legende);

  async function connecter(id: IdReseau) {
    setErreur(null);
    // Onglet ouvert tout de suite (sinon le navigateur bloque la fenêtre),
    // puis envoyé vers la plateforme une fois le lien prêt.
    const onglet = window.open('', '_blank');
    try {
      const { lien } = await appeler<{ lien: string }>(`/${id}/connexion`);
      if (onglet) onglet.location.href = lien;
      else window.location.href = lien;
    } catch (err) {
      onglet?.close();
      setErreur(messageErreur(err));
    }
  }

  async function collerAdresse(id: IdReseau, adresse: string) {
    setErreur(null);
    try {
      await appeler<EtatReseau>(`/${id}/connexion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adresse }),
      });
      void charger(true);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  async function deconnecter(id: IdReseau) {
    if (!window.confirm(`Délier le compte ${nomDe(id)} de Log Pose ?`)) return;
    try {
      const etat = await appeler<EtatReseau>(`/${id}/connexion`, { method: 'DELETE' });
      setEtats((liste) => liste?.map((e) => (e.id === id ? etat : e)) ?? null);
      setStats((avant) => {
        const reste = { ...avant };
        delete reste[id];
        return reste;
      });
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const majEnvoi = (cle: string, maj: (e: Envoi) => Partial<Envoi>) =>
    setEnvois((liste) => liste.map((e) => (e.cle === cle ? { ...e, ...maj(e) } : e)));
  const majPlateforme = (cle: string, id: IdReseau, maj: Partial<Envoi['plateformes'][number]>) =>
    majEnvoi(cle, (e) => ({ plateformes: e.plateformes.map((p) => (p.id === id ? { ...p, ...maj } : p)) }));

  async function envoyer(fichier: File, cle: string, vers: IdReseau[], texte: string) {
    try {
      const reponse = await televerser(fichier, vers, texte, (p) =>
        majEnvoi(cle, () => ({ progression: p })),
      );
      majEnvoi(cle, () => ({ progression: 1 }));
      await Promise.all(
        reponse.map(async ({ plateforme, idEnvoi, erreur: refus }) => {
          if (!idEnvoi) return majPlateforme(cle, plateforme, { etat: 'echec', message: refus });
          try {
            majPlateforme(cle, plateforme, await suivre(plateforme, idEnvoi));
          } catch (err) {
            majPlateforme(cle, plateforme, { etat: 'echec', message: messageErreur(err) });
          }
        }),
      );
    } catch (err) {
      majEnvoi(cle, () => ({ erreur: messageErreur(err) }));
    }
  }

  // Vidéos envoyées une par une (les plateformes limitent les envois rapprochés).
  async function accueillir(liste: FileList | File[]) {
    const vers = cibles.map((e) => e.id);
    if (vers.length === 0) {
      setErreur('Coche au moins un compte où envoyer la vidéo.');
      return;
    }
    // La légende part avec ce dépôt, puis le champ se vide pour le suivant.
    const texte = avecLegende ? legende.trim() : '';
    setLegende('');
    const nouveaux = Array.from(liste).map((f) => ({
      fichier: f,
      envoi: {
        cle: crypto.randomUUID(),
        nom: f.name,
        progression: 0,
        plateformes: vers.map((id) => ({ id, etat: 'en-cours' as const })),
        ...(TYPES_VIDEO.includes(f.type) ? {} : { erreur: 'Pas une vidéo MP4, MOV ou WebM.' }),
      } satisfies Envoi,
    }));
    if (nouveaux.length === 0) return;
    setEnvois((e) => [...nouveaux.map((n) => n.envoi), ...e]);
    for (const { fichier, envoi } of nouveaux) {
      if (!envoi.erreur) await envoyer(fichier, envoi.cle, vers, texte);
    }
  }

  // Glisser-déposer n'importe où sur la page.
  const peutDeposer = reliees.length > 0;
  const profondeur = useRef(0);
  function surDragEnter(e: React.DragEvent) {
    if (!peutDeposer || !e.dataTransfer.types.includes('Files')) return;
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
    if (peutDeposer) void accueillir(e.dataTransfer.files);
  }

  const etatChoisi = etats?.find((e) => e.id === choisie) ?? null;
  const plateformeChoisie = PLATEFORMES.find((p) => p.id === choisie)!;
  const destinations = cibles.map((e) => e.destination).join(', ');

  return (
    <section
      className={styles.page}
      onDragEnter={surDragEnter}
      onDragOver={(e) => peutDeposer && e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDragLeave={surDragLeave}
      onDrop={surDrop}
    >
      <input
        ref={champFichier}
        type="file"
        accept={TYPES_VIDEO.join(',')}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void accueillir(e.target.files);
          e.target.value = '';
        }}
      />

      <div className={styles.carte}>
        <header className={styles.entete}>
          <div className={styles.titreBloc}>
            <h1 className={styles.titre}>Réseaux</h1>
            <p className={styles.sousTitre}>
              Dépose une vidéo : elle part sur tes comptes reliés. Leurs stats sont juste en dessous.
            </p>
          </div>
          {reliees.length > 0 && (
            <button
              type="button"
              className={styles.bouton}
              onClick={() => void charger(true)}
              disabled={chargement}
            >
              {chargement ? 'Relevé…' : 'Actualiser'}
            </button>
          )}
        </header>

        {erreur && <p className={styles.alerte}>{erreur}</p>}

        {peutDeposer && (
          <>
            {(reliees.length > 1 || reliees.some((e) => e.publique)) && (
              <div className={styles.cibles} role="group" aria-label="Envoyer sur">
                <span className={styles.ciblesLibelle}>Envoyer sur</span>
                {reliees.map((e) => (
                  <label key={e.id} className={styles.cible}>
                    <input
                      type="checkbox"
                      checked={estVisee(e)}
                      onChange={(ev) => setChoix((c) => ({ ...c, [e.id]: ev.target.checked }))}
                    />
                    {e.nom}
                    {e.publique && <span className={styles.cibleNote}>publié tout de suite</span>}
                  </label>
                ))}
              </div>
            )}

            {avecLegende && (
              <textarea
                className={styles.legende}
                value={legende}
                onChange={(e) => setLegende(e.target.value)}
                maxLength={2200}
                rows={2}
                placeholder={`Légende pour ${cibles
                  .filter((e) => e.legende)
                  .map((e) => e.nom)
                  .join(', ')} (facultatif) : texte, #hashtags…`}
              />
            )}

            <button
              type="button"
              className={styles.depot}
              onClick={() => champFichier.current?.click()}
              disabled={cibles.length === 0}
            >
              <IconeVideo />
              <span className={styles.depotTitre}>Glisse une vidéo ici</span>
              <span className={styles.depotAide}>
                ou clique pour la choisir · MP4, MOV, WebM
                {cibles.length > 0 && <> · vers {destinations}</>}
              </span>
            </button>

            {envois.length > 0 && (
              <ul className={styles.envois}>
                {envois.map((e) => (
                  <LigneEnvoi key={e.cle} envoi={e} etats={etats ?? []} />
                ))}
              </ul>
            )}
          </>
        )}

        <div className={styles.comptes} role="tablist" aria-label="Comptes">
          {PLATEFORMES.map((p) => {
            const e = etats?.find((x) => x.id === p.id);
            const statut = !etats
              ? '…'
              : !e
                ? 'bientôt'
                : e.connecte
                  ? 'relié'
                  : e.configure
                    ? 'à relier'
                    : 'à configurer';
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={choisie === p.id}
                className={choisie === p.id ? `${styles.compte} ${styles.compteActif}` : styles.compte}
                data-statut={e?.connecte ? 'relie' : e ? 'attente' : 'bientot'}
                onClick={() => setChoisie(p.id)}
              >
                <span className={styles.compteNom}>{p.nom}</span>
                <span className={styles.compteStatut}>{statut}</span>
              </button>
            );
          })}
        </div>

        {etats && !etatChoisi && (
          <p className={styles.vide}>{plateformeChoisie.nom} arrivera bientôt ici.</p>
        )}

        {etatChoisi && !etatChoisi.configure && plateformeChoisie.aide?.()}

        {etatChoisi?.configure && !etatChoisi.connecte && (
          <Connexion
            key={etatChoisi.id}
            nom={etatChoisi.nom}
            onConnecter={() => void connecter(etatChoisi.id)}
            onColler={(a) => void collerAdresse(etatChoisi.id, a)}
          />
        )}

        {etatChoisi?.connecte && etatChoisi.manque.length > 0 && (
          <p className={styles.alerte}>
            Autorisations manquantes ({etatChoisi.manque.join(', ')}) : délie puis relie le compte
            en cochant tout.
          </p>
        )}

        {etatChoisi?.connecte && stats[etatChoisi.id] && (
          <Statistiques
            stats={stats[etatChoisi.id]!}
            onDeconnecter={() => void deconnecter(etatChoisi.id)}
          />
        )}

        {chargement && !etats && <p className={styles.vide}>Connexion aux comptes…</p>}
      </div>

      {glisse && (
        <div className={styles.voile} aria-hidden="true">
          <div className={styles.voileCadre}>
            <IconeVideo />
            Lâche pour envoyer sur {cibles.map((e) => e.nom).join(', ') || '…'}
          </div>
        </div>
      )}
    </section>
  );
}

function Statistiques({ stats, onDeconnecter }: { stats: StatsReseau; onDeconnecter: () => void }) {
  const [tri, setTri] = useState<'recentes' | 'vues'>('recentes');
  const videos = tri === 'vues' ? [...stats.videos].sort((a, b) => b.vues - a.vues) : stats.videos;
  const totalVues = stats.videos.reduce((t, v) => t + v.vues, 0);

  return (
    <>
      <div className={styles.compteurs}>
        <Compteur valeur={stats.compte.abonnes} libelle="abonnés" />
        {stats.compte.likes !== null && <Compteur valeur={stats.compte.likes} libelle="likes reçus" />}
        <Compteur valeur={totalVues} libelle="vues" />
        <Compteur valeur={stats.compte.videos} libelle="vidéos" />
      </div>

      <div className={styles.barreListe}>
        <h2 className={styles.sousTitreListe}>{stats.compte.nom ? `Publications de ${stats.compte.nom}` : 'Tes publications'}</h2>
        <div className={styles.tri} role="group" aria-label="Trier">
          {(['recentes', 'vues'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tri === t}
              className={tri === t ? `${styles.triBouton} ${styles.triActif}` : styles.triBouton}
              onClick={() => setTri(t)}
            >
              {t === 'recentes' ? 'Récentes' : 'Plus vues'}
            </button>
          ))}
        </div>
      </div>

      {videos.length === 0 ? (
        <p className={styles.vide}>Aucune publication pour l'instant.</p>
      ) : (
        <ul className={styles.videos}>
          {videos.map((v) => (
            <LigneVideo key={v.id} video={v} />
          ))}
        </ul>
      )}

      <p className={styles.pied}>
        {stats.videos.length < stats.compte.videos ? `Vues des ${stats.videos.length} dernières vidéos · ` : ''}
        relevé à{' '}
        {new Date(stats.releveLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
        <button type="button" className={styles.lien} onClick={onDeconnecter}>
          délier le compte
        </button>
      </p>
    </>
  );
}

function Compteur({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className={styles.compteur}>
      <span className={styles.compteurValeur} title={valeur.toLocaleString('fr-FR')}>
        {nombre(valeur)}
      </span>
      <span className={styles.compteurLibelle}>{libelle}</span>
    </div>
  );
}

function LigneEnvoi({ envoi, etats }: { envoi: Envoi; etats: EtatReseau[] }) {
  const versServeur = envoi.progression < 1 && !envoi.erreur;
  const fini = envoi.erreur || envoi.plateformes.every((p) => p.etat !== 'en-cours');
  const etatGlobal = envoi.erreur || envoi.plateformes.some((p) => p.etat === 'echec') ? 'echec' : fini ? 'fini' : 'en-cours';
  const texte = (p: Envoi['plateformes'][number]) => {
    switch (p.etat) {
      case 'en-cours':
        return 'Transmission…';
      case 'recue': {
        const etat = etats.find((e) => e.id === p.id);
        return `Arrivée dans ${etat?.destination ?? 'le compte'}${etat?.conseil ? ` : ${etat.conseil}` : ''}`;
      }
      case 'publiee':
        return 'Publiée ✓';
      case 'echec':
        return p.message ?? 'Échec';
    }
  };

  return (
    <li className={styles.envoi} data-etat={etatGlobal}>
      <div className={styles.envoiHaut}>
        <span className={styles.envoiNom}>{envoi.nom}</span>
        {versServeur && (
          <span className={styles.envoiEtat}>Envoi · {Math.round(envoi.progression * 100)} %</span>
        )}
      </div>
      {!fini && (
        <div className={styles.jauge}>
          <div
            className={versServeur ? styles.jaugeRemplie : `${styles.jaugeRemplie} ${styles.jaugeAttente}`}
            style={{ width: `${envoi.progression * 100}%` }}
          />
        </div>
      )}
      {envoi.erreur ? (
        <p className={styles.envoiMessage}>{envoi.erreur}</p>
      ) : (
        !versServeur && (
          <ul className={styles.envoiPlateformes}>
            {envoi.plateformes.map((p) => (
              <li key={p.id} data-etat={p.etat}>
                <strong>{nomDe(p.id)}</strong> · {texte(p)}
                {p.message && p.etat !== 'echec' && <> · {p.message}</>}
              </li>
            ))}
          </ul>
        )
      )}
    </li>
  );
}

function LigneVideo({ video }: { video: VideoReseau }) {
  const date = new Date(video.publieeLe).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const chiffres: [number | null, string][] = [
    [video.vues, 'vues'],
    [video.likes, 'likes'],
    [video.commentaires, 'comm.'],
    [video.partages, 'partages'],
  ];
  return (
    <li>
      <a className={styles.video} href={video.lien ?? undefined} target="_blank" rel="noreferrer">
        {video.couverture ? (
          <img
            className={styles.couverture}
            src={video.couverture}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.couverture} />
        )}
        <div className={styles.videoInfos}>
          <span className={styles.videoTitre}>{video.titre || 'Sans titre'}</span>
          <span className={styles.videoDate}>{date}</span>
          <div className={styles.videoStats}>
            {chiffres.map(
              ([valeur, libelle]) =>
                valeur !== null && (
                  <span key={libelle}>
                    <strong>{nombre(valeur)}</strong> {libelle}
                  </span>
                ),
            )}
          </div>
        </div>
      </a>
    </li>
  );
}

function Connexion({
  nom,
  onConnecter,
  onColler,
}: {
  nom: string;
  onConnecter: () => void;
  onColler: (adresse: string) => void;
}) {
  const [adresse, setAdresse] = useState('');
  return (
    <div className={styles.aide}>
      <p>L'appli {nom} est prête : il reste à relier ton compte (une seule fois).</p>
      <button type="button" className={styles.bouton} onClick={onConnecter}>
        Relier mon compte {nom}
      </button>
      <details className={styles.secours}>
        <summary>La page de retour ne s'est pas ouverte ?</summary>
        <p>Copie l'adresse complète de la page où {nom} t'a renvoyé, et colle-la ici :</p>
        <form
          className={styles.secoursForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (adresse.trim()) onColler(adresse.trim());
          }}
        >
          <input
            className={styles.champ}
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="https://…?code=…&state=…"
          />
          <button type="submit" className={styles.bouton}>
            Valider
          </button>
        </form>
      </details>
    </div>
  );
}

function AideInstagram() {
  return (
    <div className={styles.aide}>
      <p>
        Instagram n'est pas encore relié. À faire une seule fois (15 minutes). Attention : une vidéo
        envoyée sur Instagram est <strong>publiée tout de suite en Reel public</strong> (l'API n'a
        pas de brouillon).
      </p>
      <ol>
        <li>
          Passe ton compte Instagram en <strong>compte professionnel</strong> (Créateur ou
          Entreprise) dans les paramètres de l'appli.
        </li>
        <li>
          Sur{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
            developers.facebook.com/apps
          </a>
          , crée une appli avec le cas d'usage Instagram (« API Instagram avec connexion
          Instagram »). Elle peut rester en mode <strong>Développement</strong>.
        </li>
        <li>
          Dans « Rôles de l'app », ajoute ton compte comme <strong>Testeur Instagram</strong>, puis
          accepte l'invitation sur instagram.com (Paramètres → Apps et sites web).
        </li>
        <li>
          Dans « Configurer la connexion professionnelle Instagram », déclare l'URL de redirection{' '}
          <code>https://ton-pc.ton-reseau.ts.net/api/reseaux/instagram/retour</code>.
        </li>
        <li>
          Rends les vidéos récupérables par Instagram avec Tailscale Funnel (seules les vidéos en
          cours d'envoi sont exposées) : <code>tailscale funnel --bg --https=8443 3002</code>.
        </li>
        <li>
          Dans le fichier <code>.env</code> : <code>INSTAGRAM_APP_ID=…</code> et{' '}
          <code>INSTAGRAM_APP_SECRET=…</code> (ceux de l'app <strong>Instagram</strong>, pas de
          l'app Facebook), <code>INSTAGRAM_REDIRECT_URI=…</code> (l'adresse de l'étape 4) et{' '}
          <code>INSTAGRAM_URL_PUBLIQUE=https://ton-pc.ton-reseau.ts.net:8443</code>.
        </li>
        <li>
          Relance <code>npm run server</code> et reviens ici.
        </li>
      </ol>
    </div>
  );
}

function AideTiktok() {
  return (
    <div className={styles.aide}>
      <p>TikTok n'est pas encore relié. À faire une seule fois (10 minutes) :</p>
      <ol>
        <li>
          Sur{' '}
          <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer">
            developers.tiktok.com/apps
          </a>
          , connecte-toi et crée une appli. Reste en mode <strong>Sandbox</strong> : pas de
          validation par TikTok à attendre.
        </li>
        <li>
          Ajoute les produits <strong>Login Kit</strong> et <strong>Content Posting API</strong>,
          et les scopes <code>user.info.basic</code>, <code>user.info.stats</code>,{' '}
          <code>video.list</code>, <code>video.upload</code>.
        </li>
        <li>
          Rends l'adresse de retour accessible en https avec Tailscale :{' '}
          <code>tailscale serve --bg 3001</code>. Dans le Login Kit, déclare comme Redirect URI{' '}
          <code>https://ton-pc.ton-reseau.ts.net/api/reseaux/tiktok/retour</code> (l'adresse
          affichée par Tailscale).
        </li>
        <li>
          Dans « Sandbox settings » → <strong>Target users</strong>, ajoute ton compte TikTok.
        </li>
        <li>
          Dans le fichier <code>.env</code> : <code>TIKTOK_CLIENT_KEY=…</code>,{' '}
          <code>TIKTOK_CLIENT_SECRET=…</code> et <code>TIKTOK_REDIRECT_URI=…</code> (la même
          adresse qu'à l'étape 3).
        </li>
        <li>
          Relance <code>npm run server</code> et reviens ici.
        </li>
      </ol>
    </div>
  );
}

function IconeVideo() {
  return (
    <svg
      className={styles.icone}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5.5" width="13" height="13" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
      <path d="M9.5 9.5v5M7 12h5" />
    </svg>
  );
}
