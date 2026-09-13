import { useEffect, useState } from 'react';
import { useGameState } from './state/useGameState';
import { TopBar } from './components/TopBar';
import { WantedPoster } from './components/WantedPoster';
import { LogPoseCard } from './components/LogPoseCard';
import { MissionsCard } from './components/MissionsCard';
import { BottomBar } from './components/BottomBar';
import { PlanningPage } from './components/Planning';
import { GoingMerry } from './components/GoingMerry';
import type { Vue } from './types';
import styles from './App.module.css';

const NOM_JOUEUR = 'Louis Borrelli';

function App() {
  const [vue, setVue] = useState<Vue>('carte');

  const {
    prime,
    bounty,
    currentIle,
    totalIles,
    logPose,
    missions,
    blocsPlanning,
    ajouterGain,
    validerMission,
    echouerMission,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  } = useGameState();

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
        onChangerVue={setVue}
      />

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
              <LogPoseCard quete={currentIle.quete} progression={logPose} />
              <MissionsCard
                missions={missions}
                onValider={validerMission}
                onEchouer={echouerMission}
              />
            </div>
          </div>
        </main>
      )}

      {vue === 'planning' && (
        <PlanningPage
          blocs={blocsPlanning}
          onAjouter={ajouterBloc}
          onModifier={modifierBloc}
          onSupprimer={supprimerBloc}
        />
      )}

      {vue === 'going-merry' && (
        <GoingMerry
          blocsPlanning={blocsPlanning}
          onAjouterBloc={ajouterBloc}
          onModifierBloc={modifierBloc}
          onSupprimerBloc={supprimerBloc}
        />
      )}

      {/* L'objectif « Roi des pirates » est masqué sur la page Going Merry
          pour laisser le chat occuper tout l'écran. */}
      {vue !== 'going-merry' && <BottomBar bounty={bounty} />}
    </div>
  );
}

export default App;
