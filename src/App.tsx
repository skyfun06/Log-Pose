import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameState } from './state/useGameState';
import { useHabitudes } from './state/useHabitudes';
import { useBudget } from './state/useBudget';
import { useRecapNonLu, useRecaps } from './state/useRecaps';
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
import { GoingMerry } from './components/GoingMerry';
import { iles } from './data/iles';
import type { Vue } from './types';
import styles from './App.module.css';

const NOM_JOUEUR = 'Louis Borrelli';

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
    currentIle,
    totalIles,
    logPose,
    blocsPlanning,
    ajouterGain,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  } = useGameState();

  const {
    habitudes,
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
    postes,
    totalReparti,
    restant,
    definirSalaire,
    ajouterPoste,
    modifierPoste,
    supprimerPoste,
  } = useBudget();

  const recaps = useRecaps(blocsPlanning, habitudesDuJour);
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
                prime={prime}
                onAjouterGain={ajouterGain}
              />

              <div className={styles.colonneDroite}>
                <CarteMarine iles={iles} ileActuelle={currentIle} progression={logPose} />
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

        {vue === 'recap' && <RecapPage {...recaps} />}

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
            onAjouterPoste={ajouterPoste}
            onModifierPoste={modifierPoste}
            onSupprimerPoste={supprimerPoste}
          />
        )}

        {vue === 'courrier' && <CourrierPage />}

        {vue === 'going-merry' && (
          <GoingMerry
            blocsPlanning={blocsPlanning}
            onAjouterBloc={ajouterBloc}
            onModifierBloc={modifierBloc}
            onSupprimerBloc={supprimerBloc}
            habitudes={habitudes}
            marquesHabitudes={marques}
            onAjouterHabitude={ajouterHabitude}
            onModifierHabitude={modifierHabitude}
            onSupprimerHabitude={supprimerHabitude}
            onMarquerHabitude={marquerJour}
          />
        )}
      </div>

      {/* L'objectif « Roi des pirates » est masqué sur la page Going Merry
          pour laisser le chat occuper tout l'écran. */}
      {vue !== 'going-merry' && <BottomBar prime={prime} />}
    </div>
  );
}

export default App;
