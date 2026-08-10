import { useState } from 'react';
import { useGameState } from './state/useGameState';
import { TopBar } from './components/TopBar';
import { WantedPoster } from './components/WantedPoster';
import { LogPoseCard } from './components/LogPoseCard';
import { MissionsCard } from './components/MissionsCard';
import { BottomBar } from './components/BottomBar';
import { PlanningPage } from './components/Planning';
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
    ajouterGain,
    validerMission,
    echouerMission,
  } = useGameState();

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

      {vue === 'carte' ? (
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
      ) : (
        <PlanningPage />
      )}

      <BottomBar bounty={bounty} />
    </div>
  );
}

export default App;
