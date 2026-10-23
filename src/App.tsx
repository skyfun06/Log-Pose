import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameState } from './state/useGameState';
import { useHabitudes } from './state/useHabitudes';
import { useBudget } from './state/useBudget';
import { useRecapNonLu, useRecaps } from './state/useRecaps';
import { useCerveau } from './state/useCerveau';
import { CATEGORIE_PAIE, moisDePaie, moisDuSalaire, montantFiche } from './data/formatCerveau';
import { TopBar } from './components/TopBar';
import { WantedPoster } from './components/WantedPoster';
import { CarteMarine } from './components/CarteMarine';
import { ProgrammeDuJourCard } from './components/ProgrammeDuJourCard';
import { HabitudesDuJourCard } from './components/HabitudesDuJourCard';
import { BottomBar } from './components/BottomBar';
import { PlanningPage } from './components/Planning';
import { HabitudesPage } from './components/Habitudes';
import { BudgetPage } from './components/Budget';
import { CourrierPage } from './components/Courrier';
import { RecapPage } from './components/Recap';
import { SecondCerveau } from './components/Cerveau';
import { Ascension, type Onglet } from './components/Ascension';
import { IleConquise } from './components/IleConquise';
import { NouvelleRecrue, RapportVigie } from './components/Vigie';
import { carnetDeBord } from './data/carnet';
import { decalerIso, isoDeDate } from './data/bilanJournee';
import { EQUIPAGE, equipageRecrute, prochaineRecrue, type Membre } from './data/equipage';
import { Ceremonie } from './components/Ceremonie';
import { Atmosphere } from './components/Atmosphere';
import { iles } from './data/iles';
import { PALIERS, indexPalier } from './data/paliers';
import type { Vue } from './types';
import styles from './App.module.css';

const NOM_JOUEUR = 'Louis Borrelli';

// Ce que Louis a déjà vu : rapport du jour, recrues déjà fêtées.
const CLE_RAPPORT_VU = 'log-pose-rapport-vu';
const CLE_EQUIPAGE_VU = 'log-pose-equipage-vu';

function App() {
  const [vue, setVue] = useState<Vue>('carte');

  // Changement de page avec transition : l'ancienne page s'efface en glissant
  // d'un côté, la nouvelle arrive de l'autre (sens = ordre des onglets).
  // Navigateur sans View Transitions, ou animations réduites : changement net.
  function changerVue(nouvelle: Vue, sens: 1 | -1) {
    if (nouvelle === vue) return;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduit) {
      setVue(nouvelle);
      return;
    }
    const racine = document.documentElement;
    racine.style.setProperty('--sens-page', String(sens));
    racine.classList.add('transition-page');
    const transition = document.startViewTransition(() => flushSync(() => setVue(nouvelle)));
    transition.finished.finally(() => racine.classList.remove('transition-page'));
  }

  const {
    prime,
    bounty,
    gains,
    palierCelebre,
    atteintLe,
    butins,
    supprimerGain,
    remettrePrimeAZero,
    celebrerPalier,
    definirButin,
    currentIle,
    totalIles,
    ilesConquises,
    etapes,
    basculerEtape,
    ajouterEtape,
    supprimerEtape,
    revenirIle,
    blocsPlanning,
    ajouterGain,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  } = useGameState();

  // Progression du personnage : le palier atteint, et le dernier célébré.
  // Le site (thème, affiche) reste sur le palier célébré tant que la une du
  // journal n'a pas été vue : il se transforme quand on lève l'ancre.
  const palierAtteint = indexPalier(prime);
  const [ascension, setAscension] = useState<Onglet | null>(null);
  const ere = PALIERS[palierCelebre].ere;
  useEffect(() => {
    document.documentElement.dataset.ere = ere;
  }, [ere]);

  // Lever l'ancre : le nouveau décor se déploie en cercle depuis le bouton
  // (voir .transition-ere dans index.css).
  function leverLancre(origine?: { x: number; y: number }) {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduit) {
      celebrerPalier();
      return;
    }
    const racine = document.documentElement;
    racine.style.setProperty('--origine-x', `${origine?.x ?? window.innerWidth / 2}px`);
    racine.style.setProperty('--origine-y', `${origine?.y ?? window.innerHeight / 2}px`);
    racine.classList.add('transition-ere');
    const transition = document.startViewTransition(() =>
      flushSync(() => {
        celebrerPalier();
        racine.dataset.ere = PALIERS[palierAtteint].ere;
      }),
    );
    transition.finished.finally(() => racine.classList.remove('transition-ere'));
  }

  const {
    habitudesQuotidiennes,
    habitudesHebdomadaires,
    habitudesDuJour,
    marques,
    joursMalades,
    aujourdhuiMalade,
    basculerJourMalade,
    ajouterHabitude,
    modifierHabitude,
    supprimerHabitude,
    marquerJour,
    cocherAujourdhui,
  } = useHabitudes();

  const {
    salaire,
    source,
    postes,
    totalReparti,
    restant,
    definirSalaire,
    lierMois,
    synchroniserSalaire,
    ajouterPoste,
    modifierPoste,
    supprimerPoste,
  } = useBudget();

  // Second cerveau : ses fiches de paie remplissent le salaire du budget
  // (toutes celles d'un même mois additionnées).
  const cerveau = useCerveau();
  const moisPaie = useMemo(() => moisDePaie(cerveau.fichiers), [cerveau.fichiers]);
  const moisSalaire = moisDuSalaire(moisPaie, source);
  const montantSalaire = moisSalaire?.total ?? null;
  useEffect(() => {
    if (montantSalaire !== null) synchroniserSalaire(montantSalaire);
  }, [montantSalaire, synchroniserSalaire]);
  const paiesSansMontant = cerveau.fichiers.filter(
    (f) => f.categorie === CATEGORIE_PAIE && montantFiche(f) === null,
  );

  const toutesHabitudes = useMemo(
    () => [...habitudesQuotidiennes, ...habitudesHebdomadaires],
    [habitudesQuotidiennes, habitudesHebdomadaires],
  );
  // Carnet de bord : jours en mer, série, équipage (voir data/carnet.ts).
  const carnet = useMemo(
    () =>
      carnetDeBord({
        habitudes: toutesHabitudes,
        marques,
        joursMalades,
        etapes,
        iles,
        gains,
      }),
    [toutesHabitudes, marques, joursMalades, etapes, gains],
  );
  const recrues = equipageRecrute(carnet.joursEnMer).length;
  const aujourdhui = isoDeDate(new Date());

  // Nouvelle recrue : dès que le nombre de jours en mer en fait rejoindre une.
  const [recrue, setRecrue] = useState<Membre | null>(null);
  useEffect(() => {
    let vus = 0;
    try {
      vus = Number(localStorage.getItem(CLE_EQUIPAGE_VU) ?? 0);
    } catch {
      /* stockage indisponible : on fête quand même */
    }
    if (recrues > vus) {
      setRecrue(EQUIPAGE[recrues - 1]);
      try {
        localStorage.setItem(CLE_EQUIPAGE_VU, String(recrues));
      } catch {
        /* rien */
      }
    }
  }, [recrues]);

  // Rapport de la vigie : une fois par jour, s'il y a un passé à raconter.
  const [rapport, setRapport] = useState(false);
  useEffect(() => {
    let vu: string | null = null;
    try {
      vu = localStorage.getItem(CLE_RAPPORT_VU);
    } catch {
      /* rien */
    }
    if (vu !== aujourdhui && [...carnet.jours.keys()].some((d) => d < aujourdhui)) setRapport(true);
    // Une seule vérification à l'ouverture (et au changement de jour).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aujourdhui]);
  function fermerRapport() {
    setRapport(false);
    try {
      localStorage.setItem(CLE_RAPPORT_VU, aujourdhui);
    } catch {
      /* rien */
    }
  }
  const hier = carnet.jours.get(decalerIso(aujourdhui, -1)) ?? null;
  const derniereSortie =
    [...carnet.jours.keys()]
      .filter((d) => d < aujourdhui)
      .sort()
      .pop() ?? null;
  const toutConquis = ilesConquises[currentIle.id] !== undefined;
  const etapesActuelles = etapes[currentIle.id] ?? [];
  const totalPoids = etapesActuelles.reduce((t, e) => t + e.difficulte, 0);
  const capDuJour = toutConquis
    ? null
    : {
        ile: currentIle,
        etape: etapesActuelles.find((e) => !e.faiteLe) ?? null,
        avancement: totalPoids
          ? etapesActuelles.reduce((t, e) => t + (e.faiteLe ? e.difficulte : 0), 0) / totalPoids
          : 0,
      };

  // Conquête d'une île : la scène s'ouvre quand le navire a accosté.
  const [conquete, setConquete] = useState<{ ileId: number; depuis: string | null } | null>(null);
  const [conqueteVisible, setConqueteVisible] = useState(false);
  const basculerEtapeEtFeter = useCallback(
    (ileId: number, etapeId: string) => {
      const idx = iles.findIndex((i) => i.id === ileId);
      const precedente = iles[idx - 1];
      const r = basculerEtape(ileId, etapeId);
      if (r?.conquise) {
        setConquete({ ileId, depuis: precedente ? (ilesConquises[precedente.id] ?? null) : null });
        setConqueteVisible(false);
      }
      return r;
    },
    [basculerEtape, ilesConquises],
  );
  // Filet de sécurité : si le navire ne signale pas son arrivée (carte non
  // affichée), la scène s'ouvre quand même.
  useEffect(() => {
    if (!conquete || conqueteVisible) return;
    const t = setTimeout(() => setConqueteVisible(true), 8000);
    return () => clearTimeout(t);
  }, [conquete, conqueteVisible]);
  const ileConquise = conquete ? iles.find((i) => i.id === conquete.ileId) : undefined;

  // Une seule grande fenêtre à la fois, par ordre d'importance.
  const fenetre =
    palierAtteint > palierCelebre
      ? 'ceremonie'
      : conquete && conqueteVisible
        ? 'conquete'
        : recrue
          ? 'recrue'
          : rapport
            ? 'rapport'
            : null;

  const recaps = useRecaps(blocsPlanning, habitudesDuJour, {
    habitudes: toutesHabitudes,
    marques,
    joursMalades,
  });
  const recapNonLu = useRecapNonLu(recaps.recaps[0]?.cle ?? null, vue === 'recap');

  // ⚠️ TEMPORAIRE — mesure des dimensions rendues (à RETIRER après usage).
  // Se relance à chaque changement de vue. Depuis la console tu peux aussi
  // rappeler window.mesurer() à la main (utile pour la cale, après « Entrer dans le Merry »).
  useEffect(() => {
    const mesurer = () => {
      const cibles: [string, string][] = [
        ['Affiche WANTED', '[class*="affiche"]'],
        ['Carte Log pose', '[class*="carte"]:has([class*="quete"])'],
        ['Carte Missions', '[class*="carte"]:has([class*="liste"])'],
        ['Fond pont Merry', '[class*="niveau"][class*="pont"]'],
        ['Fond cale Merry', '[class*="niveau"][class*="cale"]'],
      ];
      console.log(`--- Mesures Log Pose (vue: ${vue}) ---`);
      cibles.forEach(([nom, sel]) => {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          console.log(
            `${nom}: ${Math.round(r.width)} x ${Math.round(r.height)} px (ratio ${(r.width / r.height).toFixed(2)}:1)`,
          );
        } else {
          console.log(`${nom}: introuvable (va sur la bonne page pour le mesurer)`);
        }
      });
    };
    const id = requestAnimationFrame(() => setTimeout(mesurer, 100));
    (window as unknown as { mesurer?: () => void }).mesurer = mesurer;
    return () => cancelAnimationFrame(id);
  }, [vue]);

  const fondStyle = currentIle.backgroundImage
    ? {
        backgroundImage: `url(${currentIle.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: currentIle.couleurFallback };

  return (
    <>
      <div className={styles.page} style={fondStyle}>
        <TopBar
          numero={currentIle.numero}
          arc={currentIle.arc}
          titre={currentIle.titre}
          totalIles={totalIles}
          vue={vue}
          onChangerVue={changerVue}
          nouveautes={{ recap: recapNonLu }}
        />

        <div className={styles.vue}>
          {vue === 'carte' && (
            <main className={styles.contenu}>
              <div className={styles.ligne}>
                <WantedPoster
                  nom={NOM_JOUEUR}
                  bounty={bounty}
                  rang={palierCelebre}
                  onAjouterGain={ajouterGain}
                  onOuvrirAscension={() => setAscension('route')}
                />

                <div className={styles.colonneDroite}>
                  <CarteMarine
                    iles={iles}
                    ileActuelle={currentIle}
                    ilesConquises={ilesConquises}
                    niveauNavire={PALIERS[palierCelebre].navire}
                    etapes={etapes}
                    carnet={{ serie: carnet.serie, recrues, totalEquipage: EQUIPAGE.length }}
                    onBasculerEtape={basculerEtapeEtFeter}
                    onAjouterEtape={ajouterEtape}
                    onSupprimerEtape={supprimerEtape}
                    onRevenir={revenirIle}
                    onOuvrirCarnet={() => setAscension('equipage')}
                    onFinNavigation={() => conquete && setConqueteVisible(true)}
                  />
                  <div className={styles.bord}>
                    <HabitudesDuJourCard
                      habitudesDuJour={habitudesDuJour}
                      aujourdhuiMalade={aujourdhuiMalade}
                      onCocherHabitude={cocherAujourdhui}
                      onOuvrirHabitudes={() => changerVue('habitudes', 1)}
                    />
                    <ProgrammeDuJourCard
                      blocs={blocsPlanning}
                      onOuvrirPlanning={() => changerVue('planning', 1)}
                    />
                  </div>
                </div>
              </div>
            </main>
          )}

          {vue === 'recap' && (
            <RecapPage
              {...recaps}
              habitudesDuJour={habitudesDuJour}
              onCocherHabitude={cocherAujourdhui}
              toutesHabitudes={toutesHabitudes}
              marquesHabitudes={marques}
              joursMalades={joursMalades}
            />
          )}

          {vue === 'planning' && (
            <PlanningPage
              blocs={blocsPlanning}
              onAjouter={ajouterBloc}
              onModifier={modifierBloc}
              onSupprimer={supprimerBloc}
            />
          )}

          {vue === 'habitudes' && (
            <HabitudesPage
              quotidiennes={habitudesQuotidiennes}
              hebdomadaires={habitudesHebdomadaires}
              marques={marques}
              joursMalades={joursMalades}
              onBasculerMalade={basculerJourMalade}
              onAjouter={ajouterHabitude}
              onModifier={modifierHabitude}
              onSupprimer={supprimerHabitude}
              onMarquer={marquerJour}
            />
          )}

          {vue === 'budget' && (
            <BudgetPage
              salaire={salaire}
              postes={postes}
              totalReparti={totalReparti}
              restant={restant}
              onDefinirSalaire={definirSalaire}
              liaison={{
                source,
                mois: moisPaie,
                retenu: moisSalaire,
                enLecture: paiesSansMontant.some(
                  (f) => f.analyse.etat === 'attente' || f.analyse.etat === 'en-cours',
                ),
                sansMontant: paiesSansMontant,
              }}
              onLierMois={lierMois}
              onOuvrirCerveau={() => changerVue('going-merry', 1)}
              onAjouterPoste={ajouterPoste}
              onModifierPoste={modifierPoste}
              onSupprimerPoste={supprimerPoste}
            />
          )}

          {vue === 'courrier' && <CourrierPage />}

          {vue === 'going-merry' && <SecondCerveau cerveau={cerveau} />}
        </div>

        {/* L'objectif « Roi des pirates » est masqué sur la page Going Merry
          (second cerveau) pour lui laisser toute la hauteur. */}
        {vue !== 'going-merry' && (
          <BottomBar prime={prime} onOuvrirAscension={() => setAscension('route')} />
        )}
      </div>

      <Atmosphere ere={ere} />

      {/* Hors de .page : sa règle « > * { position: relative } » casserait le
          position: fixed des fenêtres. */}
      {ascension && (
        <Ascension
          ongletInitial={ascension}
          iles={iles}
          etapes={etapes}
          ilesConquises={ilesConquises}
          joursEnMer={carnet.joursEnMer}
          serie={carnet.serie}
          meilleureSerie={carnet.meilleureSerie}
          prime={prime}
          gains={gains}
          atteintLe={atteintLe}
          butins={butins}
          onDefinirButin={definirButin}
          onSupprimerGain={supprimerGain}
          onRemettreAZero={remettrePrimeAZero}
          onFermer={() => setAscension(null)}
        />
      )}

      {fenetre === 'conquete' && ileConquise && (
        <IleConquise
          ile={ileConquise}
          etapes={etapes[ileConquise.id] ?? []}
          depuis={conquete?.depuis ?? null}
          suivante={iles[iles.indexOf(ileConquise) + 1] ?? null}
          totalConquises={Object.keys(ilesConquises).length}
          totalIles={iles.length}
          onContinuer={() => {
            setConquete(null);
            setConqueteVisible(false);
          }}
        />
      )}

      {fenetre === 'recrue' && recrue && (
        <NouvelleRecrue membre={recrue} onFermer={() => setRecrue(null)} />
      )}

      {fenetre === 'rapport' && (
        <RapportVigie
          hier={hier}
          derniereSortie={derniereSortie}
          serie={carnet.serie}
          meilleureSerie={carnet.meilleureSerie}
          joursEnMer={carnet.joursEnMer}
          prochaine={prochaineRecrue(carnet.joursEnMer)}
          cap={capDuJour}
          onFermer={fermerRapport}
        />
      )}

      {fenetre === 'ceremonie' && (
        <Ceremonie
          nom={NOM_JOUEUR}
          depuis={palierCelebre}
          jusqua={palierAtteint}
          prime={prime}
          butins={butins}
          onLeverLancre={leverLancre}
        />
      )}
    </>
  );
}

export default App;
